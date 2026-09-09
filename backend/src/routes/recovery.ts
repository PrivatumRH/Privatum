import { Router, type Request, type Response } from "express";
import { isAddress, isHex } from "viem";
import { query } from "../db/index";
import { decryptSecret, encryptSecret, hashApiKey, signUserOpHash } from "../crypto";
import { base32Decode, base32Encode, buildOtpAuthUri, generateTotpSecret, verifyTotp } from "../totp";

export const recoveryRouter = Router();

// 1. Initialize TOTP 2FA setup
recoveryRouter.post("/v1/wallets/:address/totp/setup", async (req: Request, res: Response): Promise<void> => {
  const address = req.params.address?.toLowerCase();
  if (!address || !isAddress(address)) {
    res.status(400).json({ error: "Invalid wallet address", code: "INVALID_ADDRESS" });
    return;
  }

  const authHeader = req.headers.authorization || "";
  const apiKey = authHeader.replace(/^Bearer\s+/i, "").trim();
  const apiKeyHash = hashApiKey(apiKey);

  try {
    const walletRes = await query("SELECT address, api_key_hash FROM wallets WHERE address = $1", [address]);
    if (walletRes.rows.length === 0) {
      res.status(404).json({ error: "Wallet not found", code: "NOT_FOUND" });
      return;
    }
    if (walletRes.rows[0].api_key_hash !== apiKeyHash) {
      res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
      return;
    }

    const secretBuf = generateTotpSecret();
    const base32 = base32Encode(secretBuf);
    const encSecret = encryptSecret(base32);

    await query(
      `INSERT INTO totp_recovery (wallet_address, totp_secret_encrypted, enabled)
       VALUES ($1, $2, FALSE)
       ON CONFLICT (wallet_address)
       DO UPDATE SET totp_secret_encrypted = $2, enabled = FALSE, updated_at = NOW()`,
      [address, encSecret]
    );

    res.status(200).json({
      secret: base32,
      uri: buildOtpAuthUri(base32, address),
    });
  } catch (error) {
    console.error("[recovery] TOTP setup error:", error);
    res.status(500).json({ error: "Internal error during TOTP setup", code: "INTERNAL_ERROR" });
  }
});

// 2. Confirm and lock in TOTP setup
recoveryRouter.post("/v1/wallets/:address/totp/confirm", async (req: Request, res: Response): Promise<void> => {
  const address = req.params.address?.toLowerCase();
  if (!address || !isAddress(address)) {
    res.status(400).json({ error: "Invalid wallet address", code: "INVALID_ADDRESS" });
    return;
  }

  const authHeader = req.headers.authorization || "";
  const apiKey = authHeader.replace(/^Bearer\s+/i, "").trim();
  const apiKeyHash = hashApiKey(apiKey);

  const { code } = req.body;
  if (!code || !/^\d{6}$/.test(code)) {
    res.status(400).json({ error: "A 6-digit TOTP code is required", code: "INVALID_CODE" });
    return;
  }

  try {
    const walletRes = await query("SELECT address, api_key_hash FROM wallets WHERE address = $1", [address]);
    if (walletRes.rows.length === 0 || walletRes.rows[0].api_key_hash !== apiKeyHash) {
      res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
      return;
    }

    const totpRes = await query(
      "SELECT totp_secret_encrypted FROM totp_recovery WHERE wallet_address = $1",
      [address]
    );
    if (totpRes.rows.length === 0) {
      res.status(400).json({ error: "TOTP not initiated. Call /totp/setup first", code: "NO_SETUP" });
      return;
    }

    const base32 = decryptSecret(totpRes.rows[0].totp_secret_encrypted);
    const secretBuf = base32Decode(base32);

    if (!verifyTotp(secretBuf, code)) {
      res.status(400).json({ error: "Invalid 6-digit verification code", code: "VERIFICATION_FAILED" });
      return;
    }

    await query("UPDATE totp_recovery SET enabled = TRUE, updated_at = NOW() WHERE wallet_address = $1", [address]);

    res.status(200).json({ ok: true, enabled: true, message: "TOTP rescue recovery enabled" });
  } catch (error) {
    console.error("[recovery] TOTP confirm error:", error);
    res.status(500).json({ error: "Internal error during TOTP confirmation", code: "INTERNAL_ERROR" });
  }
});

// 3. Emergency Recovery: Co-sign key rotation using TOTP authorization
recoveryRouter.post("/v1/wallets/:address/recover", async (req: Request, res: Response): Promise<void> => {
  const address = req.params.address?.toLowerCase();
  if (!address || !isAddress(address)) {
    res.status(400).json({ error: "Invalid wallet address", code: "INVALID_ADDRESS" });
    return;
  }

  const { code, userOpHash } = req.body;
  if (!code || !/^\d{6}$/.test(code)) {
    res.status(400).json({ error: "Valid 6-digit TOTP code is required for recovery", code: "INVALID_CODE" });
    return;
  }

  if (!userOpHash || !isHex(userOpHash) || userOpHash.length !== 66) {
    res.status(400).json({ error: "userOpHash must be a 32-byte 0x-prefixed hex string", code: "INVALID_HASH" });
    return;
  }

  try {
    const totpRes = await query(
      "SELECT totp_secret_encrypted, enabled FROM totp_recovery WHERE wallet_address = $1",
      [address]
    );

    if (totpRes.rows.length === 0 || !totpRes.rows[0].enabled) {
      res.status(400).json({ error: "TOTP recovery is not enabled for this wallet", code: "RECOVERY_DISABLED" });
      return;
    }

    const base32 = decryptSecret(totpRes.rows[0].totp_secret_encrypted);
    const secretBuf = base32Decode(base32);

    if (!verifyTotp(secretBuf, code)) {
      res.status(401).json({ error: "Invalid 6-digit recovery code", code: "INVALID_2FA" });
      return;
    }

    const walletRes = await query("SELECT shard_b_encrypted FROM wallets WHERE address = $1", [address]);
    if (walletRes.rows.length === 0) {
      res.status(404).json({ error: "Wallet not found", code: "NOT_FOUND" });
      return;
    }

    const shardBPrivKey = decryptSecret(walletRes.rows[0].shard_b_encrypted) as `0x${string}`;
    const { signature, signer } = await signUserOpHash(shardBPrivKey, userOpHash);

    await query(
      `INSERT INTO cosign_audit (wallet_address, user_op_hash, status, shard_b_signature)
       VALUES ($1, $2, $3, $4)`,
      [address, userOpHash, "RECOVERY_APPROVED", signature]
    );

    res.status(200).json({
      status: "RECOVERY_APPROVED",
      userOpHash,
      signatureB: signature,
      signerAddress: signer,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[recovery] Recovery error:", error);
    res.status(500).json({ error: "Internal error during emergency recovery", code: "INTERNAL_ERROR" });
  }
});
