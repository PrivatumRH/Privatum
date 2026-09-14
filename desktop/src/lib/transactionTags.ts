/**
 * Transaction Tagging & Cost-Center Labels for PRIVATUM Desktop.
 *
 * Provides institutional accounting categories, tag metadata,
 * color mappings, and filtering primitives with zero external telemetry.
 */

export type TransactionTag =
  | "Payroll"
  | "Vendor"
  | "Treasury"
  | "Tax Deductible"
  | "Operations"
  | "Personal"
  | "Staking"
  | "Other";

export const TRANSACTION_TAGS: readonly TransactionTag[] = [
  "Payroll",
  "Vendor",
  "Treasury",
  "Tax Deductible",
  "Operations",
  "Personal",
  "Staking",
  "Other",
] as const;

export interface TagStyle {
  label: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
  dotClass: string;
  description: string;
}

export const TAG_CONFIG: Record<TransactionTag, TagStyle> = {
  Payroll: {
    label: "Payroll",
    textClass: "text-violet-300",
    bgClass: "bg-violet-500/10",
    borderClass: "border-violet-500/25",
    dotClass: "bg-violet-400",
    description: "Employee compensation, contractor payouts, and bonuses",
  },
  Vendor: {
    label: "Vendor",
    textClass: "text-sky-300",
    bgClass: "bg-sky-500/10",
    borderClass: "border-sky-500/25",
    dotClass: "bg-sky-400",
    description: "External service providers, software subscriptions, and suppliers",
  },
  Treasury: {
    label: "Treasury",
    textClass: "text-amber-300",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-500/25",
    dotClass: "bg-amber-400",
    description: "Internal capital allocation, liquidity reserves, and rebalancing",
  },
  "Tax Deductible": {
    label: "Tax Deductible",
    textClass: "text-emerald-300",
    bgClass: "bg-emerald-500/10",
    borderClass: "border-emerald-500/25",
    dotClass: "bg-emerald-400",
    description: "Qualified business expenses, charitable donations, and deductible costs",
  },
  Operations: {
    label: "Operations",
    textClass: "text-cyan-300",
    bgClass: "bg-cyan-500/10",
    borderClass: "border-cyan-500/25",
    dotClass: "bg-cyan-400",
    description: "Day-to-day business operations, tooling, and utility fees",
  },
  Personal: {
    label: "Personal",
    textClass: "text-rose-300",
    bgClass: "bg-rose-500/10",
    borderClass: "border-rose-500/25",
    dotClass: "bg-rose-400",
    description: "Personal withdrawals, discretionary spending, and personal transfers",
  },
  Staking: {
    label: "Staking",
    textClass: "text-indigo-300",
    bgClass: "bg-indigo-500/10",
    borderClass: "border-indigo-500/25",
    dotClass: "bg-indigo-400",
    description: "Validator staking deposits, yields, and protocol deposits",
  },
  Other: {
    label: "Other",
    textClass: "text-slate-300",
    bgClass: "bg-slate-500/10",
    borderClass: "border-slate-500/25",
    dotClass: "bg-slate-400",
    description: "Uncategorized or miscellaneous transfers",
  },
};

/**
 * Validates whether an arbitrary string matches a recognized TransactionTag.
 */
export function isKnownTag(value: unknown): value is TransactionTag {
  return typeof value === "string" && (TRANSACTION_TAGS as readonly string[]).includes(value);
}

/**
 * Returns the styling configuration for a given tag, or a fallback default.
 */
export function getTagConfig(tag?: TransactionTag | null): TagStyle | null {
  if (!tag || !isKnownTag(tag)) return null;
  return TAG_CONFIG[tag];
}

/**
 * Filters a list of transactions by the selected cost-center tag.
 */
export function filterTransactionsByTag<T extends { tag?: TransactionTag }>(
  transactions: T[],
  tagFilter: TransactionTag | "all"
): T[] {
  if (tagFilter === "all") return transactions;
  return transactions.filter((tx) => tx.tag === tagFilter);
}
