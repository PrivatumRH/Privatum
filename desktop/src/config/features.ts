export type FeatureKey =
  | "wallet"
  | "private_send"
  | "updater"
  | "swaps"
  | "cross_chain"
  | "nfts"
  | "multi_wallet"
  | "rwa_equities"
  | "gasless_staking";

export const FEATURE_MILESTONES: Record<FeatureKey, string> = {
  wallet: "0.1.0",
  private_send: "0.1.1",
  updater: "0.1.1",
  swaps: "0.1.2",
  cross_chain: "0.1.3",
  nfts: "0.1.4",
  multi_wallet: "0.1.5",
  rwa_equities: "0.1.6",
  gasless_staking: "0.1.7",
};

export const RELEASE_VERSIONS = ["0.1.0", "0.1.1", "0.1.2", "0.1.3", "0.1.4", "0.1.5", "0.1.6", "0.1.7"] as const;
export type ReleaseVersion = typeof RELEASE_VERSIONS[number];

function parseSemver(v: string): number[] {
  const clean = v.replace(/^v/, "").split("-")[0];
  const parts = clean.split(".").map((p) => parseInt(p, 10) || 0);
  while (parts.length < 3) parts.push(0);
  return parts;
}

export function compareSemver(a: string, b: string): number {
  const [aMaj, aMin, aPat] = parseSemver(a);
  const [bMaj, bMin, bPat] = parseSemver(b);
  if (aMaj !== bMaj) return aMaj - bMaj;
  if (aMin !== bMin) return aMin - bMin;
  return aPat - bPat;
}

export function isFeatureActive(
  feature: FeatureKey,
  appVersion: string,
  previewVersionOverride?: string | null
): boolean {
  const activeVersion = previewVersionOverride || (import.meta.env.DEV ? "0.1.7" : appVersion);
  const milestone = FEATURE_MILESTONES[feature];
  return compareSemver(activeVersion, milestone) >= 0;
}
