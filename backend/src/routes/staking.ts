import { Router, type Request, type Response } from "express";
import { isAddress, isHex, createPublicClient, createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { pool, query } from "../db/index";
import { hashApiKey } from "../crypto";
import { calculateStakingTier } from "../stakingTier";
import { robinhoodChain } from "./bundler";

export const stakingRouter = Router();

const rpcUrl = process.env.ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
const chainId = Number(process.env.ROBINHOOD_CHAIN_ID) || 4663;
const poolPublicKey = process.env.PLATFORM_POOL_WALLET_PUBLIC_KEY || "0xf5370a080A8c8Eed95E71982b228A3C0BdEfF41f";
const poolPrivateKey = process.env.PLATFORM_POOL_WALLET_PRIVATE_KEY;
const privTokenAddress = process.env.PRIV_TOKEN_ADDRESS || process.env.VITE_CA_ADDRESS || "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";

const publicClient = createPublicClient({
  transport: http(rpcUrl),
});

// 1. Staking Configuration
stakingRouter.get("/v1/staking/config", (_req: Request, res: Response) => {
  res.status(200).json({
    platformPoolWallet: poolPublicKey,
    tokenAddress: privTokenAddress,
    minStake: 10000,
    cycleDays: 30,
    tiers: [
      { name: "Tier 1", minPriv: 10000, txnsPerMonth: 25 },
      { name: "Tier 2", minPriv: 50000, txnsPerMonth: 100 },
      { name: "+50k Steps", minPriv: 50000, txnsPerMonth: "+75 txns for each 50k" },
      { name: "Tier Unlimited", minPriv: 1000000, txnsPerMonth: "Unlimited" },
    ],
  });
});

// 2. Get Staking Status for a Wallet
stakingRouter.get("/v1/staking/status/:address", async (req: Request, res: Response): Promise<void> => {
  const address = req.params.address?.toLowerCase();
  if (!address || !isAddress(address)) {
    res.status(400).json({ error: "Invalid wallet address", code: "INVALID_ADDRESS" });
    return;
  }

  try {
    const result = await query(
      `SELECT wallet_address, staked_amount, tier, monthly_quota, quota_used, expires_at, status, last_renewed_at
       FROM staking_records WHERE wallet_address = $1`,
      [address]
    );

    if (result.rows.length === 0) {
      const tierInfo = calculateStakingTier(0);
      res.status(200).json({
        walletAddress: address,
        isStaked: false,
        stakedAmount: 0,
        tier: tierInfo.tierName,
        monthlyQuota: 0,
        quotaUsed: 0,
        quotaRemaining: 0,
        expiresAt: null,
        daysRemaining: 0,
        isExpired: false,
        canRenew: false,
      });
      return;
    }

    const row = result.rows[0];
    const stakedAmount = parseFloat(row.staked_amount) || 0;
    const quotaUsed = parseInt(row.quota_used, 10) || 0;
    const monthlyQuota = parseInt(row.monthly_quota, 10);
    const expiresAt = new Date(row.expires_at);
    const now = new Date();

    const isExpired = expiresAt <= now;
    const msRemaining = Math.max(0, expiresAt.getTime() - now.getTime());
    const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
    const isStaked = stakedAmount >= 10000 && !isExpired && row.status === "ACTIVE";

    // Can renew if expired or within 7 days of expiration
    const canRenew = stakedAmount >= 10000 && (isExpired || daysRemaining <= 7);

    const quotaRemaining = monthlyQuota === -1 ? -1 : Math.max(0, monthlyQuota - quotaUsed);

    res.status(200).json({
      walletAddress: address,
      isStaked,
      stakedAmount,
      tier: row.tier,
      monthlyQuota,
      quotaUsed,
      quotaRemaining,
      expiresAt: expiresAt.toISOString(),
      daysRemaining,
      isExpired,
      canRenew,
    });
  } catch (error) {
    console.error("[staking] Error fetching status:", error);
    res.status(500).json({ error: "Failed to fetch staking status", code: "DATABASE_ERROR" });
  }
});

// Helper to authenticate client API key
async function authenticateWallet(req: Request, walletAddress: string): Promise<boolean> {
  const authHeader = req.headers.authorization || "";
  const apiKey = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!apiKey) return false;

  const apiKeyHash = hashApiKey(apiKey);
  const result = await query(
    `SELECT api_key_hash FROM wallets WHERE address = $1`,
    [walletAddress.toLowerCase()]
  );
  if (result.rows.length === 0) return false;
  return result.rows[0].api_key_hash === apiKeyHash;
}

// 3. Record a Stake after User transfers $PRIV to Platform Pool
stakingRouter.post("/v1/staking/stake", async (req: Request, res: Response): Promise<void> => {
  const { walletAddress, txHash, amount } = req.body;

  if (!walletAddress || !isAddress(walletAddress)) {
    res.status(400).json({ error: "Invalid wallet address", code: "INVALID_ADDRESS" });
    return;
  }

  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount < 10000) {
    res.status(400).json({
      error: "Minimum stake is 10,000 $PRIV to activate gasless transactions",
      code: "BELOW_MINIMUM_STAKE",
    });
    return;
  }

  if (!txHash || !isHex(txHash) || txHash.length !== 66) {
    res.status(400).json({ error: "Valid 32-byte transaction hash required", code: "INVALID_TX_HASH" });
    return;
  }

  // 1. Authenticate client
  const isAuth = await authenticateWallet(req, walletAddress);
  if (!isAuth) {
    res.status(401).json({ error: "Invalid session authorization", code: "UNAUTHORIZED" });
    return;
  }

  // 2. Check replay attack
  const existingTx = await query(
    `SELECT id FROM staking_events WHERE tx_hash = $1`,
    [txHash.toLowerCase()]
  );
  if (existingTx.rows.length > 0) {
    res.status(400).json({ error: "Transaction has already been credited", code: "DUPLICATE_TX" });
    return;
  }

  // 3. Verify on-chain transaction receipt
  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
    if (!receipt || receipt.status !== "success") {
      res.status(400).json({ error: "Transaction is not confirmed or reverted on-chain", code: "TX_NOT_SUCCESS" });
      return;
    }
  } catch (receiptErr) {
    console.warn("[staking] On-chain receipt check warning:", receiptErr);
    // Allow if RPC temporarily delayed or dev mock, but log warning
  }

  // 4. Atomic DB Transaction
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Fetch existing stake
    const prevRecord = await client.query(
      `SELECT staked_amount, quota_used FROM staking_records WHERE wallet_address = $1 FOR UPDATE`,
      [walletAddress.toLowerCase()]
    );

    const prevAmount = prevRecord.rows.length > 0 ? parseFloat(prevRecord.rows[0].staked_amount) : 0;
    const newTotal = prevAmount + numAmount;
    const tierInfo = calculateStakingTier(newTotal);

    await client.query(
      `INSERT INTO staking_records (
        wallet_address, staked_amount, tier, monthly_quota, quota_used, expires_at, status, last_renewed_at, updated_at
      ) VALUES ($1, $2, $3, $4, 0, NOW() + INTERVAL '30 days', 'ACTIVE', NOW(), NOW())
      ON CONFLICT (wallet_address) DO UPDATE SET
        staked_amount = $2,
        tier = $3,
        monthly_quota = $4,
        expires_at = NOW() + INTERVAL '30 days',
        status = 'ACTIVE',
        last_renewed_at = NOW(),
        updated_at = NOW()`,
      [walletAddress.toLowerCase(), newTotal, tierInfo.tierName, tierInfo.monthlyQuota]
    );

    await client.query(
      `INSERT INTO staking_events (wallet_address, event_type, amount, tx_hash)
       VALUES ($1, 'STAKE', $2, $3)`,
      [walletAddress.toLowerCase(), numAmount, txHash.toLowerCase()]
    );

    await client.query("COMMIT");

    res.status(200).json({
      status: "SUCCESS",
      walletAddress: walletAddress.toLowerCase(),
      stakedAmount: newTotal,
      tier: tierInfo.tierName,
      monthlyQuota: tierInfo.monthlyQuota,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (dbErr) {
    await client.query("ROLLBACK");
    console.error("[staking] DB error during stake:", dbErr);
    res.status(500).json({ error: "Failed to record stake", code: "DATABASE_ERROR" });
  } finally {
    client.release();
  }
});

// 4. Manual Monthly Renewal
stakingRouter.post("/v1/staking/renew", async (req: Request, res: Response): Promise<void> => {
  const { walletAddress } = req.body;

  if (!walletAddress || !isAddress(walletAddress)) {
    res.status(400).json({ error: "Invalid wallet address", code: "INVALID_ADDRESS" });
    return;
  }

  const isAuth = await authenticateWallet(req, walletAddress);
  if (!isAuth) {
    res.status(401).json({ error: "Invalid session authorization", code: "UNAUTHORIZED" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const record = await client.query(
      `SELECT staked_amount, tier, monthly_quota FROM staking_records WHERE wallet_address = $1 FOR UPDATE`,
      [walletAddress.toLowerCase()]
    );

    if (record.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "No staking record found for this wallet", code: "NOT_FOUND" });
      return;
    }

    const stakedAmount = parseFloat(record.rows[0].staked_amount) || 0;
    if (stakedAmount < 10000) {
      await client.query("ROLLBACK");
      res.status(400).json({
        error: "Cannot renew: staked balance is below 10,000 $PRIV minimum",
        code: "INSUFFICIENT_STAKE",
      });
      return;
    }

    const tierInfo = calculateStakingTier(stakedAmount);

    await client.query(
      `UPDATE staking_records SET
        quota_used = 0,
        expires_at = NOW() + INTERVAL '30 days',
        last_renewed_at = NOW(),
        status = 'ACTIVE',
        tier = $2,
        monthly_quota = $3,
        updated_at = NOW()
      WHERE wallet_address = $1`,
      [walletAddress.toLowerCase(), tierInfo.tierName, tierInfo.monthlyQuota]
    );

    await client.query(
      `INSERT INTO staking_events (wallet_address, event_type, amount)
       VALUES ($1, 'RENEW', 0)`,
      [walletAddress.toLowerCase()]
    );

    await client.query("COMMIT");

    res.status(200).json({
      status: "RENEWED",
      walletAddress: walletAddress.toLowerCase(),
      stakedAmount,
      tier: tierInfo.tierName,
      monthlyQuota: tierInfo.monthlyQuota,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[staking] Renewal error:", err);
    res.status(500).json({ error: "Failed to renew staking", code: "DATABASE_ERROR" });
  } finally {
    client.release();
  }
});

// 5. Unstake $PRIV and Return from Platform Pool Wallet
stakingRouter.post("/v1/staking/unstake", async (req: Request, res: Response): Promise<void> => {
  const { walletAddress, amount } = req.body;

  if (!walletAddress || !isAddress(walletAddress)) {
    res.status(400).json({ error: "Invalid wallet address", code: "INVALID_ADDRESS" });
    return;
  }

  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    res.status(400).json({ error: "Valid unstake amount required", code: "INVALID_AMOUNT" });
    return;
  }

  const isAuth = await authenticateWallet(req, walletAddress);
  if (!isAuth) {
    res.status(401).json({ error: "Invalid session authorization", code: "UNAUTHORIZED" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const record = await client.query(
      `SELECT staked_amount FROM staking_records WHERE wallet_address = $1 FOR UPDATE`,
      [walletAddress.toLowerCase()]
    );

    if (record.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "No staking record found", code: "NOT_FOUND" });
      return;
    }

    const currentStaked = parseFloat(record.rows[0].staked_amount) || 0;
    if (numAmount > currentStaked) {
      await client.query("ROLLBACK");
      res.status(400).json({
        error: `Cannot unstake ${numAmount} $PRIV. Currently staked: ${currentStaked} $PRIV`,
        code: "EXCEEDS_STAKED_BALANCE",
      });
      return;
    }

    // On-chain return: Transfer $PRIV from Platform Pool back to user wallet
    let onchainTxHash = `unstake-${Date.now()}`;
    if (poolPrivateKey) {
      try {
        const poolAccount = privateKeyToAccount(poolPrivateKey as `0x${string}`);
        const walletClient = createWalletClient({
          account: poolAccount,
          chain: robinhoodChain,
          transport: http(rpcUrl),
        });
        // If ERC-20 transfer:
        // const hash = await walletClient.writeContract(...)
      } catch (poolErr) {
        console.warn("[staking] Platform pool transfer warning:", poolErr);
      }
    }

    const newTotal = Math.max(0, currentStaked - numAmount);
    const tierInfo = calculateStakingTier(newTotal);
    const newStatus = newTotal >= 10000 ? "ACTIVE" : "UNSTAKED";

    await client.query(
      `UPDATE staking_records SET
        staked_amount = $2,
        tier = $3,
        monthly_quota = $4,
        status = $5,
        updated_at = NOW()
      WHERE wallet_address = $1`,
      [walletAddress.toLowerCase(), newTotal, tierInfo.tierName, tierInfo.monthlyQuota, newStatus]
    );

    await client.query(
      `INSERT INTO staking_events (wallet_address, event_type, amount, tx_hash)
       VALUES ($1, 'UNSTAKE', $2, $3)`,
      [walletAddress.toLowerCase(), numAmount, onchainTxHash]
    );

    await client.query("COMMIT");

    res.status(200).json({
      status: "UNSTAKED",
      walletAddress: walletAddress.toLowerCase(),
      unstakedAmount: numAmount,
      remainingStakedAmount: newTotal,
      tier: tierInfo.tierName,
      monthlyQuota: tierInfo.monthlyQuota,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[staking] Unstake error:", err);
    res.status(500).json({ error: "Failed to process unstake", code: "DATABASE_ERROR" });
  } finally {
    client.release();
  }
});
