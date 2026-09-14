/**
 * Local Transaction History & Ledger Export for PRIVATUM Desktop.
 *
 * Provides deterministic RFC-4180 CSV and structured JSON generation
 * with zero server calls or telemetry.
 */

import type { Contact } from "./contacts";
import { findContactByAddress } from "./contacts";
import { estimateUsdValue } from "./spendGuardrails";
import type { TransactionTag } from "./transactionTags";
export { filterTransactionsByTag } from "./transactionTags";

export type LedgerDateFilter = "all" | "30d" | "7d";
export type LedgerExportFormat = "csv" | "json";

export interface ExportableTransaction {
  id: string;
  hash: string;
  type: "send" | "receive";
  counterparty: string;
  amount: string;
  asset: "USDG" | "ETH";
  timestamp: number;
  status: "confirmed" | "pending";
  tag?: TransactionTag;
  note?: string;
}

/**
 * Filters transactions according to the selected time window.
 */
export function filterTransactionsByDate<T extends { timestamp: number }>(
  transactions: T[],
  filter: LedgerDateFilter,
  now = Date.now()
): T[] {
  if (filter === "all") return transactions;

  const windowMs =
    filter === "7d"
      ? 7 * 24 * 60 * 60 * 1000
      : 30 * 24 * 60 * 60 * 1000;

  const cutoff = now - windowMs;
  return transactions.filter((t) => t.timestamp >= cutoff);
}

/**
 * Escapes a field according to RFC-4180 CSV specifications.
 */
function escapeCsvField(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates an RFC-4180 compliant CSV string from a transaction list.
 */
export function exportToCsv(
  transactions: ExportableTransaction[],
  contacts: Contact[] = [],
  walletAddress = ""
): string {
  const headers = [
    "Date (UTC)",
    "Time (UTC)",
    "Timestamp",
    "Type",
    "Asset",
    "Amount",
    "USD Estimate",
    "Cost Center / Tag",
    "Internal Note",
    "Counterparty Address",
    "Counterparty Name",
    "Status",
    "Transaction Hash",
    "Explorer Link",
  ];

  const rows: string[] = [];
  rows.push(headers.join(","));

  for (const tx of transactions) {
    const d = new Date(tx.timestamp);
    const dateUtc = isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
    const timeUtc = isNaN(d.getTime()) ? "" : d.toISOString().slice(11, 19);
    const matchedContact = findContactByAddress(contacts, tx.counterparty);
    const usdEstimate = estimateUsdValue(tx.amount, tx.asset).toFixed(2);
    const explorerLink = tx.hash
      ? `https://robinhoodchain.blockscout.com/tx/${tx.hash}`
      : "";

    const row = [
      escapeCsvField(dateUtc),
      escapeCsvField(timeUtc),
      escapeCsvField(tx.timestamp),
      escapeCsvField(tx.type.toUpperCase()),
      escapeCsvField(tx.asset),
      escapeCsvField(tx.amount),
      escapeCsvField(usdEstimate),
      escapeCsvField(tx.tag || ""),
      escapeCsvField(tx.note || ""),
      escapeCsvField(tx.counterparty),
      escapeCsvField(matchedContact?.name || ""),
      escapeCsvField(tx.status),
      escapeCsvField(tx.hash),
      escapeCsvField(explorerLink),
    ];

    rows.push(row.join(","));
  }

  return rows.join("\r\n");
}

/**
 * Formats transactions into structured audit JSON.
 */
export function exportToJson(
  transactions: ExportableTransaction[],
  contacts: Contact[] = [],
  walletAddress = ""
): string {
  const auditBundle = {
    format: "privatum-ledger-export",
    version: "1.0",
    walletAddress: walletAddress || "unspecified",
    exportedAt: new Date().toISOString(),
    totalRecords: transactions.length,
    transactions: transactions.map((tx) => {
      const d = new Date(tx.timestamp);
      const matchedContact = findContactByAddress(contacts, tx.counterparty);
      const usdEstimate = Number(estimateUsdValue(tx.amount, tx.asset).toFixed(2));

      return {
        id: tx.id,
        hash: tx.hash,
        type: tx.type,
        asset: tx.asset,
        amount: tx.amount,
        usdEstimate,
        tag: tx.tag || null,
        note: tx.note || null,
        counterparty: tx.counterparty,
        counterpartyName: matchedContact?.name || null,
        counterpartyCategory: matchedContact?.category || null,
        timestamp: tx.timestamp,
        isoDate: isNaN(d.getTime()) ? null : d.toISOString(),
        status: tx.status,
        explorerUrl: tx.hash
          ? `https://robinhoodchain.blockscout.com/tx/${tx.hash}`
          : null,
      };
    }),
  };

  return JSON.stringify(auditBundle, null, 2);
}

/**
 * Generates the standardized export filename.
 */
export function getExportFilename(format: LedgerExportFormat, date = new Date()): string {
  const dateStr = date.toISOString().slice(0, 10);
  return `privatum-ledger-${dateStr}.${format}`;
}

/**
 * Triggers a client-side file download via browser Blob and object URL.
 */
export function downloadLedgerFile(
  content: string,
  filename: string,
  mimeType: string
): void {
  if (typeof window === "undefined") return;

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
