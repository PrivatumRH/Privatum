import { Router, type Request, type Response } from "express";
import { isAddress, isHex } from "viem";
import { query } from "../db/index";
import { decryptSecret, hashApiKey, signUserOpHash } from "../crypto";

export const cosignRouter = Router();

// Authenticate client and co-sign an ERC-4337 userOpHash
cosignRouter.post("/v1/wallets/:address/cosign", async (req: Request, res: Response): Promise<void> => {
  const address = req.params.address?.toLowerCase();
  if (!address || !isAddress(address)) {
    res.status(400).json({ error: "Invalid wallet address", code: "INVALID_ADDRESS" });
    return;
  }

  // 1. Authenticate client session via API key
  const authHeader = req.headers.authorization || "";
  const apiKey = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!apiKey) {
    res.status(401).json({ error: "Authorization Bearer token required", code: "UNAUTHORIZED" });
    return;
  }

  const apiKeyHash = hashApiKey(apiKey);

  try {
    const walletResult = await query(
      `SELECT address, shard_b_address, shard_b_encrypted, api_key_hash
       FROM wallets WHERE address = $1`,
      [address]
    );

    if (walletResult.rows.length === 0) {
      res.status(404).json({ error: "Wallet not found", code: "NOT_FOUND" });
      return;
    }

    const wallet = walletResult.rows[0];
    if (wallet.api_key_hash !== apiKeyHash) {
      res.status(401).json({ error: "Invalid API key authorization", code: "INVALID_CREDENTIALS" });
      return;
    }

    // 2. Validate userOpHash
    const { userOpHash } = req.body;
    if (!userOpHash || !isHex(userOpHash) || userOpHash.length !== 66) {
      res.status(400).json({
        error: "userOpHash must be a valid 32-byte 0x-prefixed hex string",
        code: "INVALID_USER_OP_HASH",
      });
      return;
    }

    // 3. Decrypt Shard B strictly in memory
    const shardBPrivKey = decryptSecret(wallet.shard_b_encrypted) as `0x${string}`;

    // 4. Generate RFC 6979 deterministic ECDSA signature
    const { signature, signer } = await signUserOpHash(shardBPrivKey, userOpHash);

    // 5. Record to audit log
    await query(
      `INSERT INTO cosign_audit (wallet_address, user_op_hash, status, shard_b_signature)
       VALUES ($1, $2, $3, $4)`,
      [address, userOpHash, "APPROVED", signature]
    );

    res.status(200).json({
      status: "APPROVED",
      userOpHash,
      signatureB: signature,
      signerAddress: signer,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cosign] Co-signing error:", error);
    res.status(500).json({ error: "Co-signing service error", code: "COSIGN_ERROR" });
  }
});
