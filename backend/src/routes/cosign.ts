import { Router, type Request, type Response } from "express";

export const cosignRouter = Router();

// Register a new 2-of-3 threshold smart account
cosignRouter.post("/v1/wallets", async (req: Request, res: Response) => {
  const { address, shardAPubkey, shardBEncrypted, shardCPasskeyPubkey } = req.body;

  if (!address || !shardAPubkey || !shardBEncrypted || !shardCPasskeyPubkey) {
    res.status(400).json({
      error: "Missing required shard registration payload",
      code: "INVALID_SHARDS",
    });
    return;
  }

  // Placeholder registration response
  res.status(201).json({
    status: "registered",
    address,
    chainId: 4663,
    threshold: 2,
  });
});

// Co-sign an ERC-4337 UserOp after policy evaluation
cosignRouter.post("/v1/cosign", async (req: Request, res: Response) => {
  const { walletAddress, asset, amount, userOpHash, recipient } = req.body;

  if (!walletAddress || !asset || !amount || !userOpHash || !recipient) {
    res.status(400).json({
      error: "Missing co-signing intent fields",
      code: "INVALID_INTENT",
    });
    return;
  }

  if (asset !== "USDG" && asset !== "ETH") {
    res.status(400).json({
      error: "Unsupported frontier asset. Only USDG and ETH supported.",
      code: "UNSUPPORTED_ASSET",
    });
    return;
  }

  // Co-signer policy check simulation
  res.status(200).json({
    status: "APPROVED",
    userOpHash,
    walletAddress,
    asset,
    amount,
    policyCheckPassed: true,
    shardBPartialSignature: "0x_mock_partial_secp256k1_signature_b",
    timestamp: new Date().toISOString(),
  });
});
