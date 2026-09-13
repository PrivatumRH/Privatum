/**
 * Verifiable Receipt Export & Offline Verifier - Privatum v0.1.20
 *
 * Turns an InferenceReceipt into a self-contained, optionally signed bundle that
 * a third party can check WITHOUT trusting Privatum.
 *
 * What a verifier can actually prove, on its own:
 *   - inputHash  == sha256(transcript.input)
 *   - outputHash == sha256(transcript.output)
 *   - shortRef   == outputHash[0..8]
 *   - digest     == sha256(DOMAIN_TAG || canonical payload)
 *   - signature  recovers to the wallet address named in the bundle
 *
 * What a verifier CANNOT prove, and which this module therefore never claims:
 *   - codeHash / modelHash. Those are digests the build computes over its own
 *     source. A modified build could report the original values. They are only
 *     ever reported as "matches the build checking this receipt" or "unknown
 *     build" - never as "verified". Attested hardware (0.1.21+) is what would
 *     close that gap.
 */

import type { InferenceReceipt } from "./inferenceReceipt";
import { sha256hex } from "./sha256";

export const RECEIPT_BUNDLE_FORMAT = "privatum-receipt/1";

/**
 * Domain separation tag. The signed digest is sha256(TAG || canonical), so the
 * signer can never be steered onto an attacker-chosen 32-byte value - producing
 * a digest that collides with a UserOperation hash would require a SHA-256
 * preimage attack.
 */
export const RECEIPT_DOMAIN_TAG = "PRIVATUM-INFERENCE-RECEIPT-v1\n";

/** The plaintext the receipt's hashes commit to. */
export interface ReceiptTranscript {
  /** Prompt AFTER the redaction gateway - this is what inputHash covers. */
  input: string;
  /** Assistant response text - this is what outputHash covers. */
  output: string;
}

export interface SignedReceiptBundle {
  format: typeof RECEIPT_BUNDLE_FORMAT;
  appVersion: string;
  receipt: InferenceReceipt;
  transcript: ReceiptTranscript;
  /** Signer address, present only when the bundle was signed. */
  wallet?: string;
  /** sha256(DOMAIN_TAG || canonical payload), 0x-prefixed. */
  digest: string;
  /** EIP-191 signature over the digest bytes, present only when signed. */
  signature?: string;
}

export type CheckStatus = "pass" | "fail" | "unverifiable" | "skipped";

export interface VerificationCheck {
  id:
    | "format"
    | "input_hash"
    | "output_hash"
    | "short_ref"
    | "digest"
    | "signature"
    | "code_hash"
    | "model_hash"
    | "timestamp";
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface VerificationReport {
  /** True only when every check that CAN fail passed. Unverifiable never blocks. */
  valid: boolean;
  checks: VerificationCheck[];
  /** Checks that are structurally outside what an offline verifier can prove. */
  unverifiableCount: number;
}

export interface VerifyOptions {
  /**
   * Hashes of the build performing the verification. When supplied, a matching
   * codeHash means "produced by this same build" - still not third-party proof,
   * but it detects a receipt from an unknown or altered build.
   */
  expectedCodeHashes?: { detCodeHash?: string; wasmCodeHash?: string; wasmModelHash?: string };
  /** Tolerated clock skew for the timestamp sanity check. Default 24h. */
  maxFutureSkewMs?: number;
  /** Injected for deterministic tests. */
  now?: number;
  /**
   * Recovers the signer address from an EIP-191 signature over raw digest bytes.
   * Injected so the core verifier stays dependency-free and runnable anywhere.
   */
  recoverSigner?: (digest: string, signature: string) => Promise<string>;
}

/**
 * Deterministic JSON with lexicographically sorted keys and no whitespace.
 * Both signer and verifier must produce byte-identical output or the digest
 * check fails, so key order can never be left to engine insertion order.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

/** The exact subset of the bundle that the digest commits to. */
export function bundlePayload(
  receipt: InferenceReceipt,
  transcript: ReceiptTranscript,
  appVersion: string
) {
  return {
    format: RECEIPT_BUNDLE_FORMAT,
    appVersion,
    receipt,
    transcript,
  };
}

export async function computeBundleDigest(
  receipt: InferenceReceipt,
  transcript: ReceiptTranscript,
  appVersion: string
): Promise<string> {
  const canonical = canonicalJson(bundlePayload(receipt, transcript, appVersion));
  return `0x${await sha256hex(RECEIPT_DOMAIN_TAG + canonical)}`;
}

/**
 * Builds an exportable bundle. `signDigest` is optional - an unsigned bundle is
 * still fully checkable for hash integrity, it just is not bound to a wallet.
 */
export async function buildReceiptBundle(params: {
  receipt: InferenceReceipt;
  transcript: ReceiptTranscript;
  appVersion: string;
  walletAddress?: string;
  signDigest?: (digest: string) => Promise<string>;
}): Promise<SignedReceiptBundle> {
  const { receipt, transcript, appVersion, walletAddress, signDigest } = params;
  const digest = await computeBundleDigest(receipt, transcript, appVersion);

  const bundle: SignedReceiptBundle = {
    format: RECEIPT_BUNDLE_FORMAT,
    appVersion,
    receipt,
    transcript,
    digest,
  };

  if (signDigest && walletAddress) {
    bundle.wallet = walletAddress;
    bundle.signature = await signDigest(digest);
  }

  return bundle;
}

function check(
  id: VerificationCheck["id"],
  label: string,
  status: CheckStatus,
  detail: string
): VerificationCheck {
  return { id, label, status, detail };
}

/**
 * Offline verifier. Re-derives every hash it can from the transcript and
 * reports each check independently, so a caller can see exactly which parts of
 * the receipt are proven and which are merely asserted.
 */
export async function verifyReceiptBundle(
  bundle: SignedReceiptBundle,
  options: VerifyOptions = {}
): Promise<VerificationReport> {
  const checks: VerificationCheck[] = [];
  const { expectedCodeHashes, maxFutureSkewMs = 24 * 60 * 60 * 1000, now = Date.now() } = options;

  // --- Structure -----------------------------------------------------------
  const structurallySound =
    bundle?.format === RECEIPT_BUNDLE_FORMAT &&
    !!bundle.receipt &&
    !!bundle.transcript &&
    typeof bundle.transcript.input === "string" &&
    typeof bundle.transcript.output === "string";

  checks.push(
    check(
      "format",
      "Bundle format",
      structurallySound ? "pass" : "fail",
      structurallySound
        ? `Recognized as ${RECEIPT_BUNDLE_FORMAT}.`
        : `Not a well-formed ${RECEIPT_BUNDLE_FORMAT} bundle.`
    )
  );

  if (!structurallySound) {
    return { valid: false, checks, unverifiableCount: 0 };
  }

  const { receipt, transcript } = bundle;

  // --- Hash re-derivation (the part that is genuinely provable) ------------
  const derivedInput = await sha256hex(transcript.input);
  checks.push(
    check(
      "input_hash",
      "Input hash",
      derivedInput === receipt.inputHash ? "pass" : "fail",
      derivedInput === receipt.inputHash
        ? "sha256(transcript.input) matches the receipt."
        : `Mismatch. Transcript hashes to ${derivedInput.slice(0, 16)}..., receipt claims ${String(receipt.inputHash).slice(0, 16)}...`
    )
  );

  const derivedOutput = await sha256hex(transcript.output);
  checks.push(
    check(
      "output_hash",
      "Output hash",
      derivedOutput === receipt.outputHash ? "pass" : "fail",
      derivedOutput === receipt.outputHash
        ? "sha256(transcript.output) matches the receipt."
        : `Mismatch. Transcript hashes to ${derivedOutput.slice(0, 16)}..., receipt claims ${String(receipt.outputHash).slice(0, 16)}...`
    )
  );

  const shortRefOk = receipt.shortRef === String(receipt.outputHash).slice(0, 8);
  checks.push(
    check(
      "short_ref",
      "Short reference",
      shortRefOk ? "pass" : "fail",
      shortRefOk ? "shortRef is the first 8 chars of outputHash." : "shortRef does not derive from outputHash."
    )
  );

  // --- Digest --------------------------------------------------------------
  const derivedDigest = await computeBundleDigest(receipt, transcript, bundle.appVersion);
  const digestOk = derivedDigest === bundle.digest;
  checks.push(
    check(
      "digest",
      "Bundle digest",
      digestOk ? "pass" : "fail",
      digestOk
        ? "Digest recomputes over the canonical payload."
        : "Digest does not match the canonical payload - the bundle was altered after signing."
    )
  );

  // --- Signature -----------------------------------------------------------
  if (!bundle.signature || !bundle.wallet) {
    checks.push(
      check(
        "signature",
        "Wallet signature",
        "skipped",
        "Bundle is unsigned. Hash integrity still holds, but it is not bound to any wallet."
      )
    );
  } else if (!options.recoverSigner) {
    checks.push(
      check(
        "signature",
        "Wallet signature",
        "unverifiable",
        "Bundle is signed, but no signature recovery function was supplied to this verifier."
      )
    );
  } else {
    try {
      const recovered = await options.recoverSigner(bundle.digest, bundle.signature);
      const matches = recovered.toLowerCase() === bundle.wallet.toLowerCase();
      if (!matches) {
        checks.push(
          check(
            "signature",
            "Wallet signature",
            "fail",
            `Signature recovers to ${recovered}, which is not the declared signer ${bundle.wallet}.`
          )
        );
      } else if (!digestOk) {
        // The signature is authentic but covers the ORIGINAL payload, not this
        // one. Reporting a bare "pass" here would let a reader skim the list
        // and conclude the wallet vouched for content it never signed.
        checks.push(
          check(
            "signature",
            "Wallet signature",
            "fail",
            `Signature is genuinely from ${bundle.wallet}, but it covers a different payload - this bundle was altered after signing.`
          )
        );
      } else {
        checks.push(check("signature", "Wallet signature", "pass", `Signed by ${bundle.wallet}.`));
      }
    } catch (err: any) {
      checks.push(
        check("signature", "Wallet signature", "fail", `Recovery failed: ${err?.message || String(err)}`)
      );
    }
  }

  // --- Code / model provenance (structurally unverifiable offline) ---------
  const isWasm = receipt.engine === "client-cpu-wasm";
  const expectedCode = isWasm ? expectedCodeHashes?.wasmCodeHash : expectedCodeHashes?.detCodeHash;
  const expectedModel = isWasm ? expectedCodeHashes?.wasmModelHash : expectedCodeHashes?.detCodeHash;

  if (!expectedCode) {
    checks.push(
      check(
        "code_hash",
        "Code provenance",
        "unverifiable",
        "No reference build supplied. A code hash cannot be checked against the code that produced it without attested hardware."
      )
    );
  } else {
    const codeMatches = expectedCode === receipt.codeHash;
    checks.push(
      check(
        "code_hash",
        "Code provenance",
        codeMatches ? "pass" : "unverifiable",
        codeMatches
          ? "Code hash matches the build running this check - same pipeline source."
          : "Code hash is from a different build. Not proof of tampering; it may simply be an older or newer release."
      )
    );
  }

  if (!expectedModel) {
    checks.push(
      check(
        "model_hash",
        "Model provenance",
        "unverifiable",
        "No reference build supplied. Model identity is self-asserted until inference runs on attested hardware."
      )
    );
  } else {
    const modelMatches = expectedModel === receipt.modelHash;
    checks.push(
      check(
        "model_hash",
        "Model provenance",
        modelMatches ? "pass" : "unverifiable",
        modelMatches
          ? "Model hash matches the build running this check."
          : "Model hash is from a different build."
      )
    );
  }

  // --- Timestamp sanity ----------------------------------------------------
  const tsSane = typeof receipt.ts === "number" && receipt.ts > 0 && receipt.ts <= now + maxFutureSkewMs;
  checks.push(
    check(
      "timestamp",
      "Timestamp",
      tsSane ? "pass" : "fail",
      tsSane
        ? new Date(receipt.ts).toISOString()
        : "Timestamp is absent, zero, or implausibly far in the future."
    )
  );

  return {
    valid: checks.every((c) => c.status !== "fail"),
    checks,
    unverifiableCount: checks.filter((c) => c.status === "unverifiable").length,
  };
}

/** Parses untrusted JSON text into a bundle, without assuming it is valid. */
export function parseReceiptBundle(json: string): SignedReceiptBundle | null {
  try {
    // Strip a UTF-8 BOM. Bundles that have been opened and re-saved by a
    // Windows editor (Notepad, PowerShell's Set-Content) pick one up, and it
    // would otherwise make a perfectly good receipt unparseable.
    const parsed = JSON.parse(json.replace(/^﻿/, ""));
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as SignedReceiptBundle;
  } catch {
    return null;
  }
}

/** Stable filename for an exported bundle. */
export function receiptBundleFilename(receipt: InferenceReceipt): string {
  return `privatum-inference-receipt-${receipt.shortRef}.json`;
}
