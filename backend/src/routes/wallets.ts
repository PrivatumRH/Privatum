import { Router, type Request, type Response } from "express";
import { isAddress } from "viem";
import { query } from "../db/index";
import { encryptSecret, generateApiKey, generateShardKey, hashApiKey } from "../crypto";

export const walletsRouter = Router();

// Register a new 2-of-3 threshold smart account
walletsRouter.post("/v1/wallets", async (req: Request, res: Response): Promise<void> => {
  const { address, shardAAddress, shardCAddress } = req.body;

  if (!address || !shardAAddress || !shardCAddress) {
    res.status(400).json({
      error: "address, shardAAddress, and shardCAddress are required",
      code: "MISSING_FIELDS",
    });
    return;
  }

  if (!isAddress(address) || !isAddress(shardAAddress) || !isAddress(shardCAddress)) {
    res.status(400).json({
      error: "address, shardAAddress, and shardCAddress must be valid Ethereum addresses",
      code: "INVALID_ADDRESSES",
    });
    return;
  }

  const walletAddress = address.toLowerCase();
  const shardA = shardAAddress.toLowerCase();
  const shardC = shardCAddress.toLowerCase();

  try {
    // Check if wallet already registered
    const existing = await query("SELECT address FROM wallets WHERE address = $1", [walletAddress]);
    if (existing.rows.length > 0) {
      res.status(409).json({
        error: "Wallet is already registered",
        code: "ALREADY_REGISTERED",
      });
      return;
    }

    // Generate independent Shard B on backend
    const shardB = generateShardKey();
    const encShardB = encryptSecret(shardB.privateKey);
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);

    await query(
      `INSERT INTO wallets (
        address, chain_id, shard_a_address, shard_b_address,
        shard_b_encrypted, shard_c_address, api_key_hash, threshold
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        walletAddress,
        4663,
        shardA,
        shardB.address.toLowerCase(),
        encShardB,
        shardC,
        apiKeyHash,
        2,
      ]
    );

    res.status(201).json({
      address: walletAddress,
      chainId: 4663,
      shardAAddress: shardA,
      shardBAddress: shardB.address.toLowerCase(),
      shardCAddress: shardC,
      threshold: 2,
      apiKey,
    });
  } catch (error) {
    console.error("[wallets] Registration error:", error);
    res.status(500).json({
      error: "Internal server error during wallet registration",
      code: "INTERNAL_ERROR",
    });
  }
});

// Retrieve public wallet configuration
walletsRouter.get("/v1/wallets/:address", async (req: Request, res: Response): Promise<void> => {
  const address = req.params.address?.toLowerCase();
  if (!address || !isAddress(address)) {
    res.status(400).json({ error: "Invalid wallet address", code: "INVALID_ADDRESS" });
    return;
  }

  try {
    const result = await query(
      `SELECT address, chain_id, shard_a_address, shard_b_address,
              shard_c_address, threshold, created_at
       FROM wallets WHERE address = $1`,
      [address]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Wallet not found", code: "NOT_FOUND" });
      return;
    }

    const row = result.rows[0];
    res.status(200).json({
      address: row.address,
      chainId: row.chain_id,
      shardAAddress: row.shard_a_address,
      shardBAddress: row.shard_b_address,
      shardCAddress: row.shard_c_address,
      threshold: row.threshold,
      createdAt: row.created_at,
    });
  } catch (error) {
    console.error("[wallets] Get error:", error);
    res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
});
