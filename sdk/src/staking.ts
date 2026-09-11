import type { Address, Hex } from "viem";
import { DEFAULT_API_URL } from "./chain.js";
import type { StakingConfigResponse, StakingStatusResponse } from "./types.js";
import type { PrivatumWallet } from "./wallet.js";

/**
 * Calculates staking tier and monthly transaction quota according to protocol rules:
 * - 10k PRIV: 25 txns/month
 * - 50k PRIV: 100 txns/month
 * - Every 50k increment above 50k: +75 txns/month
 * - 1M PRIV or more: Unlimited (-1)
 */
export function calculateStakingTier(stakedAmount: number) {
  if (stakedAmount >= 1_000_000) {
    return { tierName: "Tier Unlimited", monthlyQuota: -1, isEligible: true, minAmount: 1_000_000 };
  }
  if (stakedAmount < 10_000) {
    return { tierName: "No Staking", monthlyQuota: 0, isEligible: false, minAmount: 0 };
  }
  if (stakedAmount < 50_000) {
    return { tierName: "Tier 1", monthlyQuota: 25, isEligible: true, minAmount: 10_000 };
  }
  const steps = Math.floor((stakedAmount - 50_000) / 50_000);
  const quota = 100 + steps * 75;
  return {
    tierName: `Tier ${2 + steps}`,
    monthlyQuota: quota,
    isEligible: true,
    minAmount: 50_000 + steps * 50_000,
  };
}

/**
 * Fetch platform pool wallet and tier schedule
 */
export async function getStakingConfig(apiUrl?: string): Promise<StakingConfigResponse> {
  const url = (apiUrl || DEFAULT_API_URL).replace(/\/$/, "");
  const res = await fetch(`${url}/v1/staking/config`);
  if (!res.ok) {
    throw new Error(`Failed to fetch staking config: ${res.statusText}`);
  }
  return (await res.json()) as StakingConfigResponse;
}

/**
 * Fetch staking status for a specific wallet address
 */
export async function getStakingStatus(
  walletAddress: Address,
  apiUrl?: string
): Promise<StakingStatusResponse> {
  const url = (apiUrl || DEFAULT_API_URL).replace(/\/$/, "");
  const res = await fetch(`${url}/v1/staking/status/${walletAddress}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch staking status: ${res.statusText}`);
  }
  return (await res.json()) as StakingStatusResponse;
}

/**
 * Record a completed $PRIV stake transaction with the backend
 */
export async function recordStake(params: {
  wallet: PrivatumWallet;
  txHash: Hex;
  amount: number;
}): Promise<any> {
  const { wallet, txHash, amount } = params;
  const res = await fetch(`${wallet.apiUrl}/v1/staking/stake`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${wallet.apiKey}`,
    },
    body: JSON.stringify({
      walletAddress: wallet.address,
      txHash,
      amount,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to record stake (${res.status}): ${err}`);
  }
  return await res.json();
}

/**
 * Manually renew monthly gasless pass (resets quota for 30 days)
 */
export async function renewStaking(wallet: PrivatumWallet): Promise<any> {
  const res = await fetch(`${wallet.apiUrl}/v1/staking/renew`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${wallet.apiKey}`,
    },
    body: JSON.stringify({
      walletAddress: wallet.address,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to renew staking (${res.status}): ${err}`);
  }
  return await res.json();
}

/**
 * Request unstaking of $PRIV back to user wallet
 */
export async function unstakePriv(params: {
  wallet: PrivatumWallet;
  amount: number;
}): Promise<any> {
  const { wallet, amount } = params;
  const res = await fetch(`${wallet.apiUrl}/v1/staking/unstake`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${wallet.apiKey}`,
    },
    body: JSON.stringify({
      walletAddress: wallet.address,
      amount,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to unstake (${res.status}): ${err}`);
  }
  return await res.json();
}
