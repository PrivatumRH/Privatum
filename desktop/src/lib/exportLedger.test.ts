import { describe, it, expect } from "bun:test";
import {
  exportToCsv,
  exportToJson,
  filterTransactionsByDate,
  getExportFilename,
  type ExportableTransaction,
} from "./exportLedger";
import type { Contact } from "./contacts";

describe("Local Ledger Export", () => {
  const mockContacts: Contact[] = [
    {
      id: "c1",
      name: "Alice",
      address: "0x3c204d1697b85d2a7e1d79459d619a852d11e0dc",
      category: "Personal",
      createdAt: 1000,
    },
    {
      id: "c2",
      name: "Acme, Inc.",
      address: "0x999999cf1046e68e36e1aa2e0e07105eddd80000",
      category: "Work",
      createdAt: 2000,
    },
  ];

  const now = 1789310000000;
  const mockTransactions: ExportableTransaction[] = [
    {
      id: "tx-1",
      hash: "0xaaaa111122223333444455556666777788889999aaaabbbbccccddddeeeeffff",
      type: "send",
      counterparty: "0x3c204d1697b85d2a7e1d79459d619a852d11e0dc",
      amount: "250",
      asset: "USDG",
      timestamp: now - 1000 * 60 * 60 * 2, // 2 hours ago
      status: "confirmed",
      tag: "Payroll",
      note: "August core dev retainer",
    },
    {
      id: "tx-2",
      hash: "0xbbbb111122223333444455556666777788889999aaaabbbbccccddddeeeeffff",
      type: "send",
      counterparty: "0x999999cf1046e68e36e1aa2e0e07105eddd80000",
      amount: "50",
      asset: "USDG",
      timestamp: now - 1000 * 60 * 60 * 24 * 10, // 10 days ago
      status: "confirmed",
      tag: "Vendor",
      note: "Cloud infra monthly",
    },
    {
      id: "tx-3",
      hash: "0xcccc111122223333444455556666777788889999aaaabbbbccccddddeeeeffff",
      type: "receive",
      counterparty: "0x1111111111111111111111111111111111111111",
      amount: "0.5",
      asset: "ETH",
      timestamp: now - 1000 * 60 * 60 * 24 * 45, // 45 days ago
      status: "confirmed",
    },
  ];

  it("filters transactions by 7d and 30d windows", () => {
    const all = filterTransactionsByDate(mockTransactions, "all", now);
    expect(all.length).toBe(3);

    const last30d = filterTransactionsByDate(mockTransactions, "30d", now);
    expect(last30d.length).toBe(2);
    expect(last30d.map((t) => t.id)).toEqual(["tx-1", "tx-2"]);

    const last7d = filterTransactionsByDate(mockTransactions, "7d", now);
    expect(last7d.length).toBe(1);
    expect(last7d[0].id).toBe("tx-1");
  });

  it("exports valid RFC-4180 CSV with headers and escaped fields", () => {
    const csv = exportToCsv(mockTransactions, mockContacts, "0xmywallet");
    const lines = csv.split("\r\n");

    expect(lines[0]).toBe(
      "Date (UTC),Time (UTC),Timestamp,Type,Asset,Amount,USD Estimate,Cost Center / Tag,Internal Note,Counterparty Address,Counterparty Name,Status,Transaction Hash,Explorer Link"
    );
    expect(lines.length).toBe(4);

    // Line 1 should resolve Alice and Payroll tag
    expect(lines[1]).toContain("SEND");
    expect(lines[1]).toContain("USDG");
    expect(lines[1]).toContain("Payroll");
    expect(lines[1]).toContain("August core dev retainer");
    expect(lines[1]).toContain("Alice");
    expect(lines[1]).toContain("250.00");

    // Line 2 should properly escape "Acme, Inc." due to embedded comma
    expect(lines[2]).toContain("Vendor");
    expect(lines[2]).toContain('"Acme, Inc."');

    // Line 3 should handle untagged transaction gracefully
    expect(lines[3]).toContain("RECEIVE");
    expect(lines[3]).toContain("ETH");
  });

  it("exports structured JSON with full audit metadata and tags", () => {
    const jsonStr = exportToJson(mockTransactions, mockContacts, "0xmywallet");
    const parsed = JSON.parse(jsonStr);

    expect(parsed.format).toBe("privatum-ledger-export");
    expect(parsed.version).toBe("1.0");
    expect(parsed.walletAddress).toBe("0xmywallet");
    expect(parsed.totalRecords).toBe(3);
    expect(parsed.transactions.length).toBe(3);

    const first = parsed.transactions[0];
    expect(first.counterpartyName).toBe("Alice");
    expect(first.counterpartyCategory).toBe("Personal");
    expect(first.tag).toBe("Payroll");
    expect(first.note).toBe("August core dev retainer");
    expect(first.explorerUrl).toContain("robinhoodchain.blockscout.com/tx/0xaaaa");

    const third = parsed.transactions[2];
    expect(third.tag).toBeNull();
    expect(third.note).toBeNull();
  });

  it("handles empty transaction history cleanly", () => {
    const csv = exportToCsv([], []);
    expect(csv).toBe(
      "Date (UTC),Time (UTC),Timestamp,Type,Asset,Amount,USD Estimate,Cost Center / Tag,Internal Note,Counterparty Address,Counterparty Name,Status,Transaction Hash,Explorer Link"
    );

    const json = JSON.parse(exportToJson([], []));
    expect(json.totalRecords).toBe(0);
    expect(json.transactions).toEqual([]);
  });

  it("formats standardized export filenames", () => {
    const fixedDate = new Date("2026-09-13T12:00:00.000Z");
    expect(getExportFilename("csv", fixedDate)).toBe("privatum-ledger-2026-09-13.csv");
    expect(getExportFilename("json", fixedDate)).toBe("privatum-ledger-2026-09-13.json");
  });
});
