import { describe, it, expect } from "bun:test";
import { generateInferenceReceipt, sha256hex } from "./inferenceReceipt";
import {
  RECEIPT_BUNDLE_FORMAT,
  buildReceiptBundle,
  canonicalJson,
  computeBundleDigest,
  parseReceiptBundle,
  receiptBundleFilename,
  verifyReceiptBundle,
  type SignedReceiptBundle,
} from "./receiptExport";

const APP_VERSION = "0.1.20";

async function makeBundle(
  input = "Send 10 USDG to Alice",
  output = "Proposed transfer of 10 USDG to Alice.",
  signer?: { walletAddress: string; signDigest: (d: string) => Promise<string> }
): Promise<SignedReceiptBundle> {
  const receipt = await generateInferenceReceipt(input, output, "deterministic");
  return buildReceiptBundle({
    receipt,
    transcript: { input, output },
    appVersion: APP_VERSION,
    walletAddress: signer?.walletAddress,
    signDigest: signer?.signDigest,
  });
}

describe("canonicalJson", () => {
  it("sorts object keys so signer and verifier agree byte for byte", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalJson({ a: 2, b: 1 })).toBe(canonicalJson({ b: 1, a: 2 }));
  });

  it("sorts nested keys and preserves array order", () => {
    expect(canonicalJson({ z: { y: 1, x: 2 }, a: [3, 1, 2] })).toBe('{"a":[3,1,2],"z":{"x":2,"y":1}}');
  });

  it("omits undefined values and emits no whitespace", () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it("handles null and primitives", () => {
    expect(canonicalJson(null)).toBe("null");
    expect(canonicalJson("x")).toBe('"x"');
    expect(canonicalJson(42)).toBe("42");
  });
});

describe("Receipt bundle construction", () => {
  it("produces a well-formed unsigned bundle", async () => {
    const bundle = await makeBundle();
    expect(bundle.format).toBe(RECEIPT_BUNDLE_FORMAT);
    expect(bundle.appVersion).toBe(APP_VERSION);
    expect(bundle.digest).toMatch(/^0x[a-f0-9]{64}$/);
    expect(bundle.signature).toBeUndefined();
    expect(bundle.wallet).toBeUndefined();
  });

  it("digest is deterministic for identical content", async () => {
    const receipt = await generateInferenceReceipt("a", "b", "deterministic");
    const t = { input: "a", output: "b" };
    const d1 = await computeBundleDigest(receipt, t, APP_VERSION);
    const d2 = await computeBundleDigest(receipt, t, APP_VERSION);
    expect(d1).toBe(d2);
  });

  it("digest changes when the transcript changes", async () => {
    const receipt = await generateInferenceReceipt("a", "b", "deterministic");
    const d1 = await computeBundleDigest(receipt, { input: "a", output: "b" }, APP_VERSION);
    const d2 = await computeBundleDigest(receipt, { input: "a", output: "c" }, APP_VERSION);
    expect(d1).not.toBe(d2);
  });

  it("digest is domain-separated from a bare hash of the payload", async () => {
    const receipt = await generateInferenceReceipt("a", "b", "deterministic");
    const transcript = { input: "a", output: "b" };
    const digest = await computeBundleDigest(receipt, transcript, APP_VERSION);
    const undomained = `0x${await sha256hex(
      canonicalJson({ format: RECEIPT_BUNDLE_FORMAT, appVersion: APP_VERSION, receipt, transcript })
    )}`;
    expect(digest).not.toBe(undomained);
  });

  it("filename is derived from the short reference", async () => {
    const bundle = await makeBundle();
    expect(receiptBundleFilename(bundle.receipt)).toBe(
      `privatum-inference-receipt-${bundle.receipt.shortRef}.json`
    );
  });
});

describe("Offline verification - honest outcomes", () => {
  it("verifies an untampered unsigned bundle", async () => {
    const report = await verifyReceiptBundle(await makeBundle());
    expect(report.valid).toBe(true);
    expect(report.checks.find((c) => c.id === "input_hash")?.status).toBe("pass");
    expect(report.checks.find((c) => c.id === "output_hash")?.status).toBe("pass");
    expect(report.checks.find((c) => c.id === "digest")?.status).toBe("pass");
  });

  it("reports code and model provenance as unverifiable with no reference build", async () => {
    const report = await verifyReceiptBundle(await makeBundle());
    expect(report.checks.find((c) => c.id === "code_hash")?.status).toBe("unverifiable");
    expect(report.checks.find((c) => c.id === "model_hash")?.status).toBe("unverifiable");
    expect(report.unverifiableCount).toBeGreaterThanOrEqual(2);
    // Unverifiable must never be reported as a failure.
    expect(report.valid).toBe(true);
  });

  it("marks an unsigned bundle's signature check skipped, not passed", async () => {
    const report = await verifyReceiptBundle(await makeBundle());
    expect(report.checks.find((c) => c.id === "signature")?.status).toBe("skipped");
  });

  it("catches a tampered output transcript", async () => {
    const bundle = await makeBundle();
    bundle.transcript.output = "Proposed transfer of 10000 USDG to Attacker.";
    const report = await verifyReceiptBundle(bundle);
    expect(report.valid).toBe(false);
    expect(report.checks.find((c) => c.id === "output_hash")?.status).toBe("fail");
  });

  it("catches a tampered input transcript", async () => {
    const bundle = await makeBundle();
    bundle.transcript.input = "Send 1 USDG to Alice";
    const report = await verifyReceiptBundle(bundle);
    expect(report.valid).toBe(false);
    expect(report.checks.find((c) => c.id === "input_hash")?.status).toBe("fail");
  });

  it("catches a receipt hash swapped to match a doctored transcript", async () => {
    const bundle = await makeBundle();
    const forged = "Wallet drained, nothing to see here.";
    bundle.transcript.output = forged;
    bundle.receipt.outputHash = await sha256hex(forged);
    const report = await verifyReceiptBundle(bundle);
    // The hash now re-derives, but the digest no longer covers it.
    expect(report.checks.find((c) => c.id === "output_hash")?.status).toBe("pass");
    expect(report.checks.find((c) => c.id === "digest")?.status).toBe("fail");
    expect(report.valid).toBe(false);
  });

  it("catches a shortRef that no longer derives from outputHash", async () => {
    const bundle = await makeBundle();
    bundle.receipt.shortRef = "deadbeef";
    const report = await verifyReceiptBundle(bundle);
    expect(report.checks.find((c) => c.id === "short_ref")?.status).toBe("fail");
    expect(report.valid).toBe(false);
  });

  it("rejects a malformed bundle without throwing", async () => {
    const report = await verifyReceiptBundle({ format: "nope" } as any);
    expect(report.valid).toBe(false);
    expect(report.checks).toHaveLength(1);
    expect(report.checks[0].id).toBe("format");
  });

  it("rejects an implausible future timestamp", async () => {
    const bundle = await makeBundle();
    const report = await verifyReceiptBundle(bundle, { now: bundle.receipt.ts - 90 * 24 * 60 * 60 * 1000 });
    expect(report.checks.find((c) => c.id === "timestamp")?.status).toBe("fail");
    expect(report.valid).toBe(false);
  });
});

describe("Offline verification - reference build comparison", () => {
  it("passes code provenance when the reference build matches", async () => {
    const bundle = await makeBundle();
    const report = await verifyReceiptBundle(bundle, {
      expectedCodeHashes: {
        detCodeHash: bundle.receipt.codeHash,
        wasmCodeHash: "0".repeat(64),
        wasmModelHash: "0".repeat(64),
      },
    });
    expect(report.checks.find((c) => c.id === "code_hash")?.status).toBe("pass");
    expect(report.checks.find((c) => c.id === "model_hash")?.status).toBe("pass");
  });

  it("downgrades a mismatched build to unverifiable rather than fail", async () => {
    const bundle = await makeBundle();
    const report = await verifyReceiptBundle(bundle, {
      expectedCodeHashes: { detCodeHash: "1".repeat(64) },
    });
    // A different build is not evidence of tampering, so it must not invalidate.
    expect(report.checks.find((c) => c.id === "code_hash")?.status).toBe("unverifiable");
    expect(report.valid).toBe(true);
  });
});

describe("Offline verification - signatures", () => {
  const SIGNER = "0x1111111111111111111111111111111111111111";

  it("passes when the signature recovers to the declared wallet", async () => {
    const bundle = await makeBundle("a", "b", {
      walletAddress: SIGNER,
      signDigest: async () => "0xsig",
    });
    expect(bundle.wallet).toBe(SIGNER);
    const report = await verifyReceiptBundle(bundle, { recoverSigner: async () => SIGNER });
    expect(report.checks.find((c) => c.id === "signature")?.status).toBe("pass");
    expect(report.valid).toBe(true);
  });

  it("is case-insensitive about the recovered address", async () => {
    const bundle = await makeBundle("a", "b", {
      walletAddress: SIGNER,
      signDigest: async () => "0xsig",
    });
    const report = await verifyReceiptBundle(bundle, {
      recoverSigner: async () => SIGNER.toUpperCase().replace("0X", "0x"),
    });
    expect(report.checks.find((c) => c.id === "signature")?.status).toBe("pass");
  });

  it("fails when the signature recovers to a different wallet", async () => {
    const bundle = await makeBundle("a", "b", {
      walletAddress: SIGNER,
      signDigest: async () => "0xsig",
    });
    const report = await verifyReceiptBundle(bundle, {
      recoverSigner: async () => "0x2222222222222222222222222222222222222222",
    });
    expect(report.checks.find((c) => c.id === "signature")?.status).toBe("fail");
    expect(report.valid).toBe(false);
  });

  it("fails closed when recovery throws", async () => {
    const bundle = await makeBundle("a", "b", {
      walletAddress: SIGNER,
      signDigest: async () => "0xnotasignature",
    });
    const report = await verifyReceiptBundle(bundle, {
      recoverSigner: async () => {
        throw new Error("bad signature");
      },
    });
    expect(report.checks.find((c) => c.id === "signature")?.status).toBe("fail");
    expect(report.valid).toBe(false);
  });

  it("marks a signed bundle unverifiable when no recovery function is available", async () => {
    const bundle = await makeBundle("a", "b", {
      walletAddress: SIGNER,
      signDigest: async () => "0xsig",
    });
    const report = await verifyReceiptBundle(bundle);
    expect(report.checks.find((c) => c.id === "signature")?.status).toBe("unverifiable");
    expect(report.valid).toBe(true);
  });

  it("reports an authentic signature over an altered payload as failed, not passed", async () => {
    const bundle = await makeBundle("a", "b", {
      walletAddress: SIGNER,
      signDigest: async () => "0xsig",
    });
    bundle.transcript.output = "tampered";
    bundle.receipt.outputHash = await sha256hex("tampered");
    bundle.receipt.shortRef = bundle.receipt.outputHash.slice(0, 8);

    const report = await verifyReceiptBundle(bundle, { recoverSigner: async () => SIGNER });
    const sig = report.checks.find((c) => c.id === "signature");
    // The signature really is from SIGNER, but it does not cover this payload.
    expect(sig?.status).toBe("fail");
    expect(sig?.detail).toContain("different payload");
    expect(report.valid).toBe(false);
  });

  it("detects a signature moved onto a different bundle", async () => {
    const signed = await makeBundle("a", "b", {
      walletAddress: SIGNER,
      signDigest: async () => "0xsig",
    });
    const other = await makeBundle("different", "content");
    const spliced: SignedReceiptBundle = {
      ...other,
      wallet: signed.wallet,
      signature: signed.signature,
      digest: signed.digest,
    };
    const report = await verifyReceiptBundle(spliced, { recoverSigner: async () => SIGNER });
    // Signature still recovers, but the digest no longer covers this payload.
    expect(report.checks.find((c) => c.id === "digest")?.status).toBe("fail");
    expect(report.valid).toBe(false);
  });
});

describe("parseReceiptBundle", () => {
  it("round-trips an exported bundle through JSON", async () => {
    const bundle = await makeBundle();
    const parsed = parseReceiptBundle(JSON.stringify(bundle, null, 2));
    expect(parsed).not.toBeNull();
    const report = await verifyReceiptBundle(parsed!);
    expect(report.valid).toBe(true);
  });

  it("tolerates a UTF-8 BOM from a Windows editor round-trip", async () => {
    const bundle = await makeBundle();
    const parsed = parseReceiptBundle("﻿" + JSON.stringify(bundle, null, 2));
    expect(parsed).not.toBeNull();
    const report = await verifyReceiptBundle(parsed!);
    expect(report.valid).toBe(true);
  });

  it("returns null on malformed JSON instead of throwing", () => {
    expect(parseReceiptBundle("{not json")).toBeNull();
    expect(parseReceiptBundle("null")).toBeNull();
  });
});
