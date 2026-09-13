/**
 * Browser entry point for the Privatum receipt verifier.
 *
 * Imports the app's own verification module rather than reimplementing it, and
 * is bundled into a single self-contained HTML file by
 * `scripts/build-web-verifier.ts`. Nothing is fetched at runtime: the page
 * works from file://, offline, with the network disconnected.
 */

import {
  parseReceiptBundle,
  verifyReceiptBundle,
  type CheckStatus,
  type SignedReceiptBundle,
  type VerificationReport,
} from "../src/lib/assistant/receiptExport";
import { hexToBytes, recoverMessageAddress, type Hex } from "viem";

const STATUS_WORD: Record<CheckStatus, string> = {
  pass: "VERIFIED",
  fail: "FAILED",
  unverifiable: "UNPROVEN",
  skipped: "N/A",
};

async function recoverSigner(digest: string, signature: string): Promise<string> {
  return await recoverMessageAddress({
    message: { raw: hexToBytes(digest as Hex) },
    signature: signature as Hex,
  });
}

const $ = (id: string) => document.getElementById(id)!;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

function renderError(message: string): void {
  $("results").innerHTML = `<div class="verdict verdict-fail">
      <span class="verdict-word">Could not read</span>
      <span class="verdict-sub">${escapeHtml(message)}</span>
    </div>`;
  $("results").classList.remove("hidden");
}

function renderReport(bundle: SignedReceiptBundle, report: VerificationReport): void {
  const failed = report.checks.filter((c) => c.status === "fail").length;

  const verdict = report.valid
    ? `<div class="verdict verdict-pass">
         <span class="verdict-word">No check failed</span>
         <span class="verdict-sub">Every provable claim in this receipt holds.</span>
       </div>`
    : `<div class="verdict verdict-fail">
         <span class="verdict-word">${failed} check${failed === 1 ? "" : "s"} failed</span>
         <span class="verdict-sub">This receipt does not describe the content attached to it.</span>
       </div>`;

  const rows = report.checks
    .map(
      (c) => `<tr class="row-${c.status}">
        <td class="cell-status"><span class="pill pill-${c.status}">${STATUS_WORD[c.status]}</span></td>
        <td class="cell-label">${escapeHtml(c.label)}</td>
        <td class="cell-detail">${escapeHtml(c.detail)}</td>
      </tr>`
    )
    .join("");

  const meta = `<dl class="meta">
      <div><dt>Format</dt><dd>${escapeHtml(bundle.format || "-")}</dd></div>
      <div><dt>App version</dt><dd>${escapeHtml(bundle.appVersion || "-")}</dd></div>
      <div><dt>Engine</dt><dd>${escapeHtml(bundle.receipt?.engine || "-")}</dd></div>
      <div><dt>Signed by</dt><dd class="mono">${escapeHtml(bundle.wallet || "not signed")}</dd></div>
    </dl>`;

  const transcript = `<details class="transcript">
      <summary>Transcript this receipt commits to</summary>
      <div class="transcript-body">
        <h4>Prompt</h4>
        <pre>${escapeHtml(bundle.transcript?.input ?? "")}</pre>
        <h4>Response</h4>
        <pre>${escapeHtml(bundle.transcript?.output ?? "")}</pre>
      </div>
    </details>`;

  const caveat =
    report.unverifiableCount > 0
      ? `<div class="caveat">
           <h4>What this page just proved</h4>
           <p>The transcript above really does hash to the values inside the receipt, and
              the bundle has not been edited since it was signed. Your browser recomputed
              those digests locally; nothing was taken on trust.</p>
           <h4>What it cannot prove</h4>
           <p>That the stated code and model are what actually produced the response.
              Those hashes are self-reported by the build that wrote the receipt, and a
              modified build could report the original values. Only attestation from
              hardware the operator cannot forge would close that gap, which is why those
              rows read <strong>UNPROVEN</strong> rather than showing you a wall of green.</p>
         </div>`
      : "";

  $("results").innerHTML = `${verdict}${meta}
    <table class="checks"><tbody>${rows}</tbody></table>
    ${transcript}${caveat}`;
  $("results").classList.remove("hidden");
}

async function handleText(text: string): Promise<void> {
  const bundle = parseReceiptBundle(text);
  if (!bundle) {
    renderError("That file is not valid JSON.");
    return;
  }

  try {
    // No expectedCodeHashes: this page is not the build that produced the
    // receipt, so it has no standing to judge code provenance. Reporting those
    // checks as unproven is the honest answer.
    const report = await verifyReceiptBundle(bundle, { recoverSigner });
    renderReport(bundle, report);
  } catch (err: any) {
    renderError(err?.message || String(err));
  }
}

function readFile(file: File): void {
  const reader = new FileReader();
  reader.onload = () => void handleText(String(reader.result ?? ""));
  reader.onerror = () => renderError("Could not read that file.");
  reader.readAsText(file);
}

function wire(): void {
  const drop = $("drop");
  const picker = $("picker") as HTMLInputElement;
  const paste = $("paste") as HTMLTextAreaElement;

  drop.addEventListener("click", () => picker.click());
  drop.addEventListener("keydown", (e) => {
    const key = (e as KeyboardEvent).key;
    if (key === "Enter" || key === " ") {
      e.preventDefault();
      picker.click();
    }
  });

  picker.addEventListener("change", () => {
    const f = picker.files?.[0];
    if (f) readFile(f);
  });

  for (const evt of ["dragenter", "dragover"]) {
    drop.addEventListener(evt, (e) => {
      e.preventDefault();
      drop.classList.add("dragging");
    });
  }
  for (const evt of ["dragleave", "drop"]) {
    drop.addEventListener(evt, (e) => {
      e.preventDefault();
      drop.classList.remove("dragging");
    });
  }
  drop.addEventListener("drop", (e) => {
    const f = (e as DragEvent).dataTransfer?.files?.[0];
    if (f) readFile(f);
  });

  $("verify-pasted").addEventListener("click", () => {
    const text = paste.value.trim();
    if (text) void handleText(text);
  });

  $("clear").addEventListener("click", () => {
    paste.value = "";
    picker.value = "";
    $("results").classList.add("hidden");
    $("results").innerHTML = "";
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wire);
} else {
  wire();
}
