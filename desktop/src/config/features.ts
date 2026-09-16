export type FeatureKey =
  | "wallet"
  | "private_send"
  | "updater"
  | "swaps"
  | "cross_chain"
  | "nfts"
  | "multi_wallet"
  | "rwa_equities"
  | "gasless_staking"
  | "bridge_rebates"
  | "disposable_pay_links"
  | "address_guard"
  | "panic_freeze"
  | "spending_guardrails"
  | "address_book"
  | "portfolio_sparkline"
  | "transaction_receipt"
  | "recent_contacts"
  | "inference_receipt"
  | "transaction_risk_score"
  | "inference_receipt_export"
  | "threshold_visual"
  | "guardrail_budget_bar"
  | "contact_autocomplete"
  | "ai_intelligence"
  | "ledger_export"
  | "starred_contacts"
  | "global_hotkeys"
  | "balance_diff"
  | "transaction_tagging"
  | "vault_backup"
  | "session_lock"
  | "transfer_blacklist"
  | "transfer_whitelist"
  | "clipboard_sanitizer";

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
  bridge_rebates: "0.1.8",
  disposable_pay_links: "0.1.9",
  address_guard: "0.1.10",
  panic_freeze: "0.1.11",
  spending_guardrails: "0.1.12",
  address_book: "0.1.13",
  portfolio_sparkline: "0.1.14",
  transaction_receipt: "0.1.15",
  recent_contacts: "0.1.16",
  inference_receipt: "0.1.17",
  transaction_risk_score: "0.1.19",
  inference_receipt_export: "0.1.20",
  threshold_visual: "0.1.22",
  guardrail_budget_bar: "0.1.23",
  contact_autocomplete: "0.1.24",
  ai_intelligence: "0.1.25",
  ledger_export: "0.1.26",
  starred_contacts: "0.1.27",
  global_hotkeys: "0.1.28",
  balance_diff: "0.1.29",
  transaction_tagging: "0.1.30",
  vault_backup: "0.1.31",
  session_lock: "0.1.32",
  transfer_blacklist: "0.1.33",
  transfer_whitelist: "0.1.34",
  clipboard_sanitizer: "0.1.35",
};

export const RELEASE_VERSIONS = [
  "0.1.0",
  "0.1.1",
  "0.1.2",
  "0.1.3",
  "0.1.4",
  "0.1.5",
  "0.1.6",
  "0.1.7",
  "0.1.8",
  "0.1.9",
  "0.1.10",
  "0.1.11",
  "0.1.12",
  "0.1.13",
  "0.1.14",
  "0.1.15",
  "0.1.16",
  "0.1.17",
  "0.1.18",
  "0.1.19",
  "0.1.20",
  "0.1.21",
  "0.1.22",
  "0.1.23",
  "0.1.24",
  "0.1.25",
  "0.1.26",
  "0.1.27",
  "0.1.28",
  "0.1.29",
  "0.1.30",
  "0.1.31",
  "0.1.32",
  "0.1.33",
  "0.1.34",
  "0.1.35",
] as const;
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
  const latestRelease = RELEASE_VERSIONS[RELEASE_VERSIONS.length - 1];
  const activeVersion = previewVersionOverride || (import.meta.env.DEV ? latestRelease : appVersion);
  const milestone = FEATURE_MILESTONES[feature];
  return compareSemver(activeVersion, milestone) >= 0;
}
