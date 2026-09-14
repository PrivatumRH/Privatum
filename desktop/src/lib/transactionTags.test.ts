import { describe, it, expect } from "bun:test";
import {
  TRANSACTION_TAGS,
  TAG_CONFIG,
  isKnownTag,
  getTagConfig,
  filterTransactionsByTag,
  TransactionTag,
} from "./transactionTags";

describe("Transaction Tags Engine", () => {
  it("defines all 8 standard institutional tags", () => {
    expect(TRANSACTION_TAGS).toHaveLength(8);
    expect(TRANSACTION_TAGS).toContain("Payroll");
    expect(TRANSACTION_TAGS).toContain("Vendor");
    expect(TRANSACTION_TAGS).toContain("Treasury");
    expect(TRANSACTION_TAGS).toContain("Tax Deductible");
    expect(TRANSACTION_TAGS).toContain("Operations");
    expect(TRANSACTION_TAGS).toContain("Personal");
    expect(TRANSACTION_TAGS).toContain("Staking");
    expect(TRANSACTION_TAGS).toContain("Other");
  });

  it("validates known tags accurately", () => {
    expect(isKnownTag("Payroll")).toBe(true);
    expect(isKnownTag("Vendor")).toBe(true);
    expect(isKnownTag("UnknownTag")).toBe(false);
    expect(isKnownTag(null)).toBe(false);
    expect(isKnownTag(undefined)).toBe(false);
    expect(isKnownTag(123)).toBe(false);
  });

  it("returns styling config for known tags", () => {
    const payrollConfig = getTagConfig("Payroll");
    expect(payrollConfig).not.toBeNull();
    expect(payrollConfig?.label).toBe("Payroll");
    expect(payrollConfig?.textClass).toContain("text-violet");

    const taxConfig = getTagConfig("Tax Deductible");
    expect(taxConfig).not.toBeNull();
    expect(taxConfig?.dotClass).toContain("bg-emerald-400");

    expect(getTagConfig("Invalid" as any)).toBeNull();
    expect(getTagConfig(undefined)).toBeNull();
  });

  it("filters transactions by cost-center tag", () => {
    const sampleTxs = [
      { id: "1", tag: "Payroll" as TransactionTag, amount: "100" },
      { id: "2", tag: "Vendor" as TransactionTag, amount: "50" },
      { id: "3", tag: "Payroll" as TransactionTag, amount: "200" },
      { id: "4", amount: "75" }, // untagged
    ];

    const allTxs = filterTransactionsByTag(sampleTxs, "all");
    expect(allTxs).toHaveLength(4);

    const payrollTxs = filterTransactionsByTag(sampleTxs, "Payroll");
    expect(payrollTxs).toHaveLength(2);
    expect(payrollTxs.map((t) => t.id)).toEqual(["1", "3"]);

    const vendorTxs = filterTransactionsByTag(sampleTxs, "Vendor");
    expect(vendorTxs).toHaveLength(1);
    expect(vendorTxs[0].id).toBe("2");

    const stakingTxs = filterTransactionsByTag(sampleTxs, "Staking");
    expect(stakingTxs).toHaveLength(0);
  });
});
