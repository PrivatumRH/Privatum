import { Router, type Request, type Response } from "express";
import { createPublicClient, http, isHex } from "viem";

export const bundlerRouter = Router();

const rpcUrl = process.env.ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
const chainId = Number(process.env.ROBINHOOD_CHAIN_ID) || 4663;

const publicClient = createPublicClient({
  transport: http(rpcUrl),
});

// Broadcast UserOperation directly to Robinhood Chain
bundlerRouter.post("/v1/bundler/userop", async (req: Request, res: Response): Promise<void> => {
  const { userOp, entryPoint } = req.body;

  if (!userOp || !userOp.sender || !userOp.signature) {
    res.status(400).json({ error: "Missing required userOp fields", code: "INVALID_USEROP" });
    return;
  }

  // Verify 130-byte combined 2-of-3 signature
  if (!isHex(userOp.signature) || userOp.signature.length !== 262) { // 0x + 130 bytes (260 hex chars)
    res.status(400).json({
      error: "UserOp signature must be 130 bytes (two concatenated 65-byte ECDSA signatures)",
      code: "INVALID_SIGNATURE_LENGTH",
    });
    return;
  }

  try {
    // Submit userOp via eth_sendUserOperation to RPC node
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "eth_sendUserOperation",
        params: [userOp, entryPoint || process.env.ENTRY_POINT_ADDRESS || "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"],
      }),
    });

    const result = await response.json() as any;

    if (result.error) {
      res.status(400).json({
        error: result.error.message || "Failed to submit UserOp",
        code: "BUNDLER_ERROR",
        details: result.error,
      });
      return;
    }

    res.status(200).json({
      status: "SUBMITTED",
      userOpHash: result.result,
      chainId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[bundler] Broadcast error:", error);
    res.status(500).json({ error: "Internal bundler submission error", code: "INTERNAL_ERROR" });
  }
});
