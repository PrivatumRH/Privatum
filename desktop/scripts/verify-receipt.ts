#!/usr/bin/env bun
/**
 * Privatum Standalone Inference Receipt Verifier
 * ==============================================
 *
 * Checks an exported receipt bundle WITHOUT running, trusting, or contacting
 * the Privatum app. Everything is local: no network calls, no API, no keys.
 *
 *   bun scripts/verify-receipt.ts <bundle.json>
 *   bun scripts/verify-receipt.ts <bundle.json> --json
 *   bun scripts/verify-receipt.ts <bundle.json> --strict
 *
 * Exit codes:
 *   0  no check failed
 *   1  at least one check failed (or, with --strict, anything unproven)
 *   2  bad usage / unreadable file
 *
 * This deliberately imports the SAME verification module the desktop app runs
 * (`src/lib/assistant/receiptExport.ts`) rather than reimplementing it. A
 * second copy of the logic would be free to drift, and a verifier that drifts
 * from the thing it verifies is worse than no verifier at all.
 */

import { readFileSync } from "node:fs";
import {
  parseReceiptBundle,
  verifyReceiptBundle,
  type CheckStatus,
  type VerificationReport,
} from "../src/lib/assistant/receiptExport";

const SYMBOL: Record<CheckStatus, string> = {
  pass: "PASS",
  fail: "FAIL",
  unverifiable: "UNPROVEN",
  skipped: "N/A",
};

const COLOR: Record<CheckStatus, string> = {
  pass: "\x1b[32m",
  fail: "\x1b[31m",
  unverifiable: "\x1b[33m",
  skipped: "\x1b[90m",
};

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[90m";

/** Disable colour when piped, or when NO_COLOR is set. */
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: string, text: string) => (useColor ? `${code}${text}${RESET}` : text);

function usage(): never {
  console.error(
    [
      "Privatum standalone inference receipt verifier",
      "",
      "Usage:",
      "  bun scripts/verify-receipt.ts <bundle.json> [options]",
      "",
      "Options:",
      "  --json     Emit the full report as JSON instead of a table",
      "  --strict   Also exit non-zero when checks are unprovable (for CI)",
      "  --help     Show this message",
    ].join("\n")
  );
  process.exit(2);
}

/**
 * Signature recovery needs secp256k1 public-key recovery, which Node's crypto
 * does not expose. viem is used when resolvable; without it the signature is
 * reported as unproven rather than silently passed.
 */
async function loadRecoverSigner(): Promise<
  ((digest: string, signature: string) => Promise<string>) | undefined
> {
  try {
    const viem = await import("viem");
    return async (digest: string, signature: string) =>
      await viem.recoverMessageAddress({
        message: { raw: viem.hexToBytes(digest as `0x${string}`) },
        signature: signature as `0x${string}`,
      });
  } catch {
    return undefined;
  }
}

function printReport(report: VerificationReport, path: string, signerAvailable: boolean): void {
  const width = Math.max(...report.checks.map((c) => c.label.length));

  console.log("");
  console.log(paint(BOLD, "Privatum Inference Receipt Verification"));
  console.log(paint(DIM, path));
  console.log("");

  for (const c of report.checks) {
    const label = c.label.padEnd(width);
    const status = paint(COLOR[c.status], SYMBOL[c.status].padEnd(8));
    console.log(`  ${status} ${label}  ${paint(DIM, c.detail)}`);
  }

  console.log("");
  if (report.valid) {
    console.log(paint("\x1b[32m" + BOLD, "  No check failed."));
  } else {
    const failed = report.checks.filter((c) => c.status === "fail");
    console.log(
      paint("\x1b[31m" + BOLD, `  ${failed.length} check${failed.length === 1 ? "" : "s"} failed.`)
    );
  }

  if (report.unverifiableCount > 0) {
    console.log("");
    console.log(paint(DIM, "  What this tool proves:"));
    console.log(
      paint(DIM, "    The transcript really does hash to the values in the receipt, and the")
    );
    console.log(
      paint(DIM, "    bundle has not been edited since it was signed. Those are arithmetic")
    );
    console.log(paint(DIM, "    facts you just recomputed yourself."));
    console.log("");
    console.log(paint(DIM, "  What it cannot prove:"));
    console.log(
      paint(DIM, "    That the stated code and model are what actually produced the output.")
    );
    console.log(
      paint(DIM, "    Those hashes are self-reported by the build, and a modified build could")
    );
    console.log(
      paint(DIM, "    report the original values. Only attested hardware closes that gap.")
    );
  }

  if (!signerAvailable && report.checks.some((c) => c.id === "signature" && c.status === "unverifiable")) {
    console.log("");
    console.log(
      paint(DIM, "  Note: viem was not resolvable, so the signature was not checked. Run this")
    );
    console.log(paint(DIM, "  from the desktop/ directory after `bun install`."));
  }

  console.log("");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) usage();

  const asJson = args.includes("--json");
  const strict = args.includes("--strict");
  const path = args.find((a) => !a.startsWith("--"));
  if (!path) usage();

  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch (err: any) {
    console.error(`Could not read ${path}: ${err?.message || err}`);
    process.exit(2);
  }

  const bundle = parseReceiptBundle(raw);
  if (!bundle) {
    console.error(`${path} is not valid JSON.`);
    process.exit(2);
  }

  const recoverSigner = await loadRecoverSigner();

  // No expectedCodeHashes is passed on purpose. This tool is not the build that
  // produced the receipt, so it has no standing to judge code provenance - it
  // reports those checks as unproven, which is the honest answer.
  const report = await verifyReceiptBundle(bundle, { recoverSigner });

  if (asJson) {
    console.log(JSON.stringify({ file: path, ...report }, null, 2));
  } else {
    printReport(report, path, !!recoverSigner);
  }

  const blocked = !report.valid || (strict && report.unverifiableCount > 0);
  process.exit(blocked ? 1 : 0);
}

main().catch((err) => {
  console.error(`Verifier crashed: ${err?.stack || err}`);
  process.exit(2);
});
