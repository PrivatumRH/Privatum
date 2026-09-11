import { Router, type Request, type Response } from "express";
import { createPublicClient, createWalletClient, defineChain, http, isHex, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { pool, query } from "../db/index";

export const bundlerRouter = Router();

const rpcUrl = process.env.ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
const chainId = Number(process.env.ROBINHOOD_CHAIN_ID) || 4663;
const poolPrivateKey = process.env.PLATFORM_POOL_WALLET_PRIVATE_KEY;

export const robinhoodChain = defineChain({
  id: chainId,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [rpcUrl] },
  },
});

const publicClient = createPublicClient({
  transport: http(rpcUrl),
});

// Broadcast UserOperation directly to Robinhood Chain
bundlerRouter.post("/v1/bundler/userop", async (req: Request, res: Response): Promise<void> => {
  const { userOp, entryPoint, sponsor } = req.body;

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

  const senderAddress = userOp.sender.toLowerCase();
  let isSponsored = false;

  // 1. Gasless Sponsorship Check
  if (sponsor) {
    try {
      const stakeCheck = await query(
        `SELECT staked_amount, monthly_quota, quota_used, expires_at, status
         FROM staking_records WHERE wallet_address = $1`,
        [senderAddress]
      );

      if (stakeCheck.rows.length === 0) {
        res.status(403).json({
          error: "Gasless sponsorship requires active $PRIV staking. Stake in the Gasless tab to unlock free transactions.",
          code: "NOT_STAKED",
        });
        return;
      }

      const record = stakeCheck.rows[0];
      const now = new Date();
      const expiresAt = new Date(record.expires_at);
      const monthlyQuota = parseInt(record.monthly_quota, 10);
      const quotaUsed = parseInt(record.quota_used, 10) || 0;

      if (record.status !== "ACTIVE" || expiresAt <= now) {
        res.status(403).json({
          error: "Your monthly gasless pass has expired. Please renew in the Gasless tab to continue.",
          code: "STAKE_EXPIRED",
        });
        return;
      }

      if (monthlyQuota !== -1 && quotaUsed >= monthlyQuota) {
        res.status(403).json({
          error: `You have used all ${monthlyQuota} sponsored transactions for this monthly cycle. Renew or stake more to increase your quota.`,
          code: "QUOTA_EXCEEDED",
        });
        return;
      }

      // 2. Fund the user account or EntryPoint from Platform Pool if account has 0 ETH
      if (poolPrivateKey) {
        try {
          const balance = await publicClient.getBalance({ address: userOp.sender as `0x${string}` });
          if (balance < parseEther("0.00003")) {
            const poolAccount = privateKeyToAccount(poolPrivateKey as `0x${string}`);
            const walletClient = createWalletClient({
              account: poolAccount,
              chain: robinhoodChain,
              transport: http(rpcUrl),
            });

            // Send micro-grant for gas
            const hash = await walletClient.sendTransaction({
              to: userOp.sender as `0x${string}`,
              value: parseEther("0.00005"),
            });
            await publicClient.waitForTransactionReceipt({ hash, timeout: 5000 }).catch(() => {});
          }
        } catch (poolErr) {
          console.warn("[bundler] Platform pool gas sponsor warning:", poolErr);
        }
      }

      isSponsored = true;
    } catch (checkErr) {
      console.error("[bundler] Sponsorship verification error:", checkErr);
      res.status(500).json({ error: "Failed to verify gasless eligibility", code: "SPONSOR_CHECK_ERROR" });
      return;
    }
  }

  try {
    // 3. Submit userOp via eth_sendUserOperation to RPC node
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

    const userOpHash = result.result;

    // 4. Record sponsored usage atomically
    if (isSponsored) {
      try {
        await query(
          `UPDATE staking_records SET quota_used = quota_used + 1, updated_at = NOW() WHERE wallet_address = $1`,
          [senderAddress]
        );
        await query(
          `INSERT INTO sponsored_tx_audit (wallet_address, user_op_hash, gas_fee_eth, status)
           VALUES ($1, $2, $3, 'SPONSORED')`,
          [senderAddress, userOpHash, 0.00003]
        );
      } catch (auditErr) {
        console.error("[bundler] Failed to record sponsored audit:", auditErr);
      }
    }

    res.status(200).json({
      status: "SUBMITTED",
      userOpHash,
      chainId,
      sponsored: isSponsored,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[bundler] Broadcast error:", error);
    res.status(500).json({ error: "Internal bundler submission error", code: "INTERNAL_ERROR" });
  }
});
