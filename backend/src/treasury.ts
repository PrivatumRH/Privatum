import { encodeFunctionData, isAddress, type Address } from "viem";
import { pool } from "./db/index";
import {
  ERC20_ABI,
  POOL_ADDRESS,
  PRIV_TOKEN_ADDRESS,
  getPoolPrivBalance,
  getPoolWalletClient,
  getPublicClient,
  loadPoolAccount,
} from "./poolWallet";
import { SETTLEMENT_CHAIN_ID } from "./relay";

/**
 * Bridge rebate payouts, settled from the platform pool wallet.
 *
 * Rebates are paid from PRIV the pool already holds rather than by market-buying
 * per claim: PRIV has roughly $4.8k of on-chain liquidity, where a $1.3k buy
 * already costs ~14% in slippage.
 *
 * The pool also custodies PRIV staked for gasless transactions. That stake is
 * user property owed back on unstake, so it is treated as a reserve that rebate
 * payouts may never draw against - a payout is refused when it would breach it,
 * rather than quietly spending someone's staking principal.
 */

/** Payouts stay simulated until this is exactly "true". */
export const PAYOUTS_ENABLED = process.env.REBATE_PAYOUTS_ENABLED?.trim() === "true";

/** Hard ceiling per claim, in PRIV wei. Bounds the blast radius of a mispriced claim. */
export const MAX_PAYOUT_WEI = BigInt(
  process.env.REBATE_MAX_PAYOUT_WEI || (10_000_000n * 10n ** 18n).toString()
);

/** Maximum claims a single run will process. */
export const MAX_PAYOUTS_PER_RUN = Number(process.env.REBATE_MAX_PAYOUTS_PER_RUN || 25);

export interface PayoutResult {
  claimId: string;
  recipient: string;
  privWei: string;
  outcome: "dry_run" | "sent" | "success" | "failed" | "skipped";
  txHash?: string;
  error?: string;
}

export interface PoolSolvency {
  address: string;
  chainId: number;
  /** PRIV the pool currently holds. */
  privBalanceWei: string | null;
  /** PRIV owed back to stakers - untouchable by rebate payouts. */
  stakedReserveWei: string;
  /** PRIV promised to rebate claims not yet paid. */
  pendingRebateWei: string;
  /** Balance minus stake reserve: what rebates may actually draw on. */
  availableForRebatesWei: string | null;
  /** True when the pool cannot cover stake plus promised rebates. */
  underfunded: boolean;
  pendingClaims: number;
  activeStakers: number;
}

export interface TreasuryStatus extends PoolSolvency {
  configured: boolean;
  payoutsEnabled: boolean;
  signerAvailable: boolean;
  privToken: string;
}

/**
 * PRIV owed back to stakers, in wei.
 *
 * `staking_records.staked_amount` is a decimal PRIV quantity, so it is scaled to
 * wei here. Only ACTIVE records are owed - UNSTAKED and EXPIRED are not.
 */
export async function getStakedReserveWei(): Promise<{ wei: bigint; stakers: number }> {
  const result = await pool.query(
    `SELECT COALESCE(SUM(staked_amount), 0)::TEXT AS total, COUNT(*)::INT AS count
     FROM staking_records WHERE status = 'ACTIVE'`
  );
  const decimal = result.rows[0].total as string;
  return { wei: privDecimalToWei(decimal), stakers: result.rows[0].count };
}

/** Scales a decimal PRIV amount ("10000.5000") to wei without floating point. */
export function privDecimalToWei(amount: string | number): bigint {
  const text = String(amount ?? "0").trim();
  if (!/^-?\d*\.?\d*$/.test(text) || text === "" || text === ".") return 0n;
  const negative = text.startsWith("-");
  const [whole = "0", fraction = ""] = text.replace("-", "").split(".");
  const wei = BigInt(whole || "0") * 10n ** 18n + BigInt((fraction + "0".repeat(18)).slice(0, 18) || "0");
  return negative ? -wei : wei;
}

/** PRIV already promised to rebate claims but not yet paid. */
export async function getPendingRebateWei(): Promise<{ wei: bigint; claims: number }> {
  const result = await pool.query(
    `SELECT COALESCE(SUM(priv_wei), 0)::TEXT AS total, COUNT(*)::INT AS count
     FROM rebate_claims WHERE status IN ('pending', 'paying')`
  );
  return { wei: BigInt(result.rows[0].total), claims: result.rows[0].count };
}

export async function getPoolSolvency(): Promise<PoolSolvency> {
  const [staked, rebates] = await Promise.all([getStakedReserveWei(), getPendingRebateWei()]);

  let balanceWei: bigint | null = null;
  try {
    balanceWei = await getPoolPrivBalance();
  } catch (error) {
    console.error("[treasury] Pool PRIV balance read failed:", error);
  }

  const available = balanceWei === null ? null : balanceWei - staked.wei;

  return {
    address: POOL_ADDRESS,
    chainId: SETTLEMENT_CHAIN_ID,
    privBalanceWei: balanceWei?.toString() ?? null,
    stakedReserveWei: staked.wei.toString(),
    pendingRebateWei: rebates.wei.toString(),
    availableForRebatesWei: available === null ? null : (available > 0n ? available : 0n).toString(),
    underfunded: balanceWei !== null && balanceWei < staked.wei + rebates.wei,
    pendingClaims: rebates.claims,
    activeStakers: staked.stakers,
  };
}

export async function getTreasuryStatus(): Promise<TreasuryStatus> {
  const solvency = await getPoolSolvency();

  let signerAvailable = false;
  try {
    signerAvailable = loadPoolAccount() !== null;
  } catch (error) {
    console.error("[treasury] Pool signer unavailable:", error);
  }

  return {
    ...solvency,
    configured: solvency.privBalanceWei !== null,
    payoutsEnabled: PAYOUTS_ENABLED,
    signerAvailable,
    privToken: PRIV_TOKEN_ADDRESS,
  };
}

async function recordAttempt(
  claimId: string,
  privWei: bigint,
  outcome: string,
  txHash?: string,
  error?: string
) {
  await pool.query(
    `INSERT INTO rebate_payout_attempts (claim_id, treasury_address, priv_wei, tx_hash, outcome, error)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [claimId, POOL_ADDRESS, privWei.toString(), txHash ?? null, outcome, error ?? null]
  );
}

/**
 * Pays out pending rebate claims from the pool.
 *
 * Each claim is locked out of `pending` in a committed transaction before
 * anything is broadcast, so two concurrent runs cannot pay the same claim.
 * The staking reserve is re-checked per claim, so a run stops cleanly once the
 * spendable surplus is exhausted instead of eating into stake.
 */
export async function processPendingPayouts(
  options: { limit?: number; dryRun?: boolean } = {}
): Promise<PayoutResult[]> {
  const limit = Math.min(options.limit ?? MAX_PAYOUTS_PER_RUN, MAX_PAYOUTS_PER_RUN);
  const dryRun = options.dryRun ?? !PAYOUTS_ENABLED;

  const signer = dryRun ? null : getPoolWalletClient();
  if (!dryRun && !signer) {
    throw new Error("No pool wallet signer configured");
  }

  const publicClient = getPublicClient();
  const staked = await getStakedReserveWei();

  let balanceWei: bigint;
  try {
    balanceWei = await getPoolPrivBalance();
  } catch (error) {
    throw new Error(`Could not read pool PRIV balance: ${(error as Error).message}`);
  }

  // Only the surplus above staked principal is spendable on rebates.
  let spendable = balanceWei - staked.wei;

  const candidates = await pool.query(
    `SELECT id, user_address, priv_wei FROM rebate_claims
     WHERE status = 'pending' ORDER BY created_at ASC LIMIT $1`,
    [limit]
  );

  const results: PayoutResult[] = [];

  for (const claim of candidates.rows) {
    const privWei = BigInt(claim.priv_wei);
    const recipient = claim.user_address as Address;

    if (!isAddress(recipient)) {
      await recordAttempt(claim.id, privWei, "failed", undefined, "Invalid recipient");
      results.push({ claimId: claim.id, recipient, privWei: claim.priv_wei, outcome: "failed", error: "Invalid recipient" });
      continue;
    }

    if (privWei <= 0n || privWei > MAX_PAYOUT_WEI) {
      const error = `Payout of ${privWei} wei is outside the permitted range`;
      await recordAttempt(claim.id, privWei, "failed", undefined, error);
      results.push({ claimId: claim.id, recipient, privWei: claim.priv_wei, outcome: "failed", error });
      continue;
    }

    // Refuse rather than broadcast a transfer that would breach the stake
    // reserve or simply revert for want of balance.
    if (privWei > spendable) {
      const error =
        `Pool has ${balanceWei} PRIV wei with ${staked.wei} reserved for stakers; ` +
        `${privWei} exceeds the ${spendable > 0n ? spendable : 0n} available for rebates`;
      await recordAttempt(claim.id, privWei, "failed", undefined, error);
      results.push({ claimId: claim.id, recipient, privWei: claim.priv_wei, outcome: "skipped", error });
      continue;
    }

    if (dryRun) {
      await recordAttempt(claim.id, privWei, "dry_run");
      results.push({ claimId: claim.id, recipient, privWei: claim.priv_wei, outcome: "dry_run" });
      spendable -= privWei;
      continue;
    }

    const client = await pool.connect();
    let locked = false;
    try {
      await client.query("BEGIN");
      const lock = await client.query(
        `UPDATE rebate_claims
         SET status = 'paying', payout_attempts = payout_attempts + 1, updated_at = NOW()
         WHERE id = $1 AND status = 'pending' RETURNING id`,
        [claim.id]
      );
      await client.query("COMMIT");
      locked = lock.rows.length > 0;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      console.error("[treasury] Lock failed:", error);
    } finally {
      client.release();
    }

    if (!locked) {
      results.push({ claimId: claim.id, recipient, privWei: claim.priv_wei, outcome: "skipped" });
      continue;
    }

    try {
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [recipient, privWei],
      });

      // Simulate first: a revert here costs nothing and leaves no half-state.
      await publicClient.call({ account: POOL_ADDRESS, to: PRIV_TOKEN_ADDRESS, data });

      const txHash = await signer!.client.sendTransaction({
        account: signer!.account,
        chain: null,
        to: PRIV_TOKEN_ADDRESS,
        data,
      });

      await recordAttempt(claim.id, privWei, "sent", txHash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      const succeeded = receipt.status === "success";

      await pool.query(
        `UPDATE rebate_claims
         SET status = $1, tx_hash = $2, paid_at = CASE WHEN $1 = 'paid' THEN NOW() ELSE NULL END,
             last_error = $3, updated_at = NOW()
         WHERE id = $4`,
        [succeeded ? "paid" : "failed", txHash, succeeded ? null : "Transaction reverted", claim.id]
      );
      await recordAttempt(
        claim.id,
        privWei,
        succeeded ? "success" : "failed",
        txHash,
        succeeded ? undefined : "Transaction reverted"
      );

      if (succeeded) spendable -= privWei;

      results.push({
        claimId: claim.id,
        recipient,
        privWei: claim.priv_wei,
        outcome: succeeded ? "success" : "failed",
        txHash,
      });
    } catch (error) {
      const message = (error as Error).message?.slice(0, 500) ?? "Unknown payout error";
      await pool.query(
        `UPDATE rebate_claims SET status = 'failed', last_error = $1, updated_at = NOW() WHERE id = $2`,
        [message, claim.id]
      );
      await recordAttempt(claim.id, privWei, "failed", undefined, message);
      results.push({ claimId: claim.id, recipient, privWei: claim.priv_wei, outcome: "failed", error: message });
    }
  }

  return results;
}
