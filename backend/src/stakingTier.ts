export interface StakingTierInfo {
  tierName: string;
  monthlyQuota: number; // -1 for unlimited
  isEligible: boolean;
  minAmount: number;
  nextTierAmount?: number;
  nextTierQuota?: number;
}

export function calculateStakingTier(stakedAmount: number): StakingTierInfo {
  if (stakedAmount >= 1_000_000) {
    return {
      tierName: "Tier Unlimited",
      monthlyQuota: -1,
      isEligible: true,
      minAmount: 1_000_000,
    };
  }
  if (stakedAmount < 10_000) {
    return {
      tierName: "No Staking",
      monthlyQuota: 0,
      isEligible: false,
      minAmount: 0,
      nextTierAmount: 10_000,
      nextTierQuota: 25,
    };
  }
  if (stakedAmount < 50_000) {
    return {
      tierName: "Tier 1",
      monthlyQuota: 25,
      isEligible: true,
      minAmount: 10_000,
      nextTierAmount: 50_000,
      nextTierQuota: 100,
    };
  }

  // 50,000 -> 100 txns
  // Every +50k increment -> +75 txns
  const steps = Math.floor((stakedAmount - 50_000) / 50_000);
  const quota = 100 + steps * 75;
  const nextSteps = steps + 1;
  const nextTierAmount = 50_000 + nextSteps * 50_000;
  const nextQuota = nextTierAmount >= 1_000_000 ? -1 : 100 + nextSteps * 75;

  return {
    tierName: `Tier ${2 + steps}`,
    monthlyQuota: quota,
    isEligible: true,
    minAmount: 50_000 + steps * 50_000,
    nextTierAmount: nextTierAmount > 1_000_000 ? 1_000_000 : nextTierAmount,
    nextTierQuota: nextQuota,
  };
}
