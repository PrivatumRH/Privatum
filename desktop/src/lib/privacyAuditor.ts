export type PrivacyFindingSeverity = "pass" | "warn" | "fail";

export interface PrivacyFinding {
  id: string;
  severity: PrivacyFindingSeverity;
  title: string;
  detail: string;
}

export interface PrivacyAudit {
  score: number;
  label: "Strong Unlinkability" | "Linkage Warning" | "High Linkability";
  summary: string;
  findings: PrivacyFinding[];
}

interface AuditTransaction {
  type: "send" | "receive";
  counterparty: string;
  amount: string;
  asset: string;
  timestamp: number;
}

export function auditPrivacy(params: {
  recipient: string;
  amount: string;
  asset: string;
  isStealthSend: boolean;
  transactions: AuditTransaction[];
  now?: number;
}): PrivacyAudit {
  const { recipient, amount, asset, isStealthSend, transactions, now = Date.now() } = params;
  const cleanRecipient = recipient.trim().toLowerCase();
  const findings: PrivacyFinding[] = [];
  let score = isStealthSend ? 95 : 35;

  const isMetaAddress = cleanRecipient.startsWith("st:eth:0x") || cleanRecipient.replace(/^0x/, "").length === 132;
  if (isStealthSend && isMetaAddress) {
    findings.push({ id: "one_time_destination", severity: "pass", title: "One-time destination", detail: "ERC-5564 derives a fresh destination address for this payment." });
  } else if (isStealthSend) {
    score -= 45;
    findings.push({ id: "direct_destination", severity: "fail", title: "Direct address in privacy mode", detail: "A direct recipient address does not provide stealth-address unlinkability." });
  } else {
    findings.push({ id: "direct_destination", severity: "warn", title: "Direct-address exposure", detail: "This transfer publicly links the sending account and recipient on-chain." });
  }

  const sends = transactions.filter((tx) => tx.type === "send");
  const repeatedRecipient = sends.some((tx) => tx.counterparty.trim().toLowerCase() === cleanRecipient);
  if (repeatedRecipient) {
    score -= 25;
    findings.push({ id: "recipient_reuse", severity: "warn", title: "Recipient reuse", detail: "This destination appears in prior local transfer history and may aid address clustering." });
  }
  const sameAmount = sends.filter((tx) => tx.asset === asset && Number(tx.amount) === Number(amount));
  if (sameAmount.length > 0) {
    score -= 15;
    findings.push({ id: "amount_fingerprint", severity: "warn", title: "Repeated amount", detail: "The exact amount matches a previous outgoing transfer, creating a simple correlation signal." });
  }
  const recentSend = sends.some((tx) => now - tx.timestamp >= 0 && now - tx.timestamp < 10 * 60 * 1000);
  if (recentSend) {
    score -= 10;
    findings.push({ id: "timing_correlation", severity: "warn", title: "Timing correlation", detail: "A recent outgoing payment may make closely sequenced activity easier to correlate." });
  }
  if (!findings.some((finding) => finding.severity === "warn" || finding.severity === "fail")) {
    findings.push({ id: "no_local_linkage", severity: "pass", title: "No local linkage signal", detail: "No recipient reuse, amount fingerprint, or rapid-transfer correlation was found locally." });
  }

  score = Math.max(0, Math.min(100, score));
  const label = score >= 80 ? "Strong Unlinkability" : score >= 55 ? "Linkage Warning" : "High Linkability";
  const summary = score >= 80
    ? "The planned payment has strong local unlinkability characteristics."
    : score >= 55
    ? "This payment has correlation signals worth reviewing before signing."
    : "Multiple local signals could make this payment easier to link to prior activity.";
  return { score, label, summary, findings };
}
