import { describe, it, expect } from "bun:test";
import {
  generateInferenceReceipt,
  sha256hex,
  getDetCodeHash,
  getWasmCodeHash,
  getWasmModelHash,
} from "./inferenceReceipt";

describe("Inference Receipt Generation", () => {
  it("sha256hex computes valid 64-char lowercase hexadecimal digest", async () => {
    const hash = await sha256hex("privatum test prompt");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);

    const repeat = await sha256hex("privatum test prompt");
    expect(repeat).toBe(hash);

    const different = await sha256hex("different prompt");
    expect(different).not.toBe(hash);
  });

  it("getDetCodeHash returns SHA-256 digest of deterministic pipeline source files", async () => {
    const codeHash = await getDetCodeHash();
    expect(codeHash).toHaveLength(64);
    expect(codeHash).toMatch(/^[a-f0-9]{64}$/);

    // Caching check
    const cached = await getDetCodeHash();
    expect(cached).toBe(codeHash);
  });

  it("getWasmCodeHash and getWasmModelHash return valid digests for SmolLM2", async () => {
    const wasmCodeHash = await getWasmCodeHash();
    const wasmModelHash = await getWasmModelHash();

    expect(wasmCodeHash).toHaveLength(64);
    expect(wasmCodeHash).toMatch(/^[a-f0-9]{64}$/);

    expect(wasmModelHash).toHaveLength(64);
    expect(wasmModelHash).toMatch(/^[a-f0-9]{64}$/);

    // Model hash is distinct from worker source code hash
    expect(wasmModelHash).not.toBe(wasmCodeHash);
  });

  it("generateInferenceReceipt returns complete receipt structure for deterministic engine", async () => {
    const input = "Send 10 USDG to Alice";
    const output = "Proposed transfer of 10 USDG to Alice.";

    const receipt = await generateInferenceReceipt(input, output, "deterministic");

    expect(receipt).toBeDefined();
    expect(receipt.codeHash).toHaveLength(64);
    expect(receipt.modelHash).toHaveLength(64);
    expect(receipt.inputHash).toHaveLength(64);
    expect(receipt.outputHash).toHaveLength(64);
    expect(receipt.shortRef).toHaveLength(8);
    expect(receipt.outputHash.startsWith(receipt.shortRef)).toBe(true);
    expect(receipt.engine).toBe("client-cpu-deterministic");
    expect(typeof receipt.ts).toBe("number");
    expect(receipt.ts).toBeGreaterThan(0);

    // In deterministic mode, the code is the model
    expect(receipt.modelHash).toBe(receipt.codeHash);
  });

  it("generateInferenceReceipt returns distinct modelHash and engine for smollm2_wasm", async () => {
    const input = "Explain 2-of-3 MPC";
    const output = "2-of-3 MPC splits authority across three keys.";

    const receipt = await generateInferenceReceipt(input, output, "smollm2_wasm");

    expect(receipt.engine).toBe("client-cpu-wasm");
    expect(receipt.modelHash).not.toBe(receipt.codeHash);
    expect(receipt.shortRef).toBe(receipt.outputHash.slice(0, 8));
  });

  it("verifies determinism: identical input and output yield identical hashes", async () => {
    const input = "Freeze wallet for 24h";
    const output = "Emergency panic freeze on Robinhood Chain (for 24 hours).";

    const r1 = await generateInferenceReceipt(input, output, "deterministic");
    const r2 = await generateInferenceReceipt(input, output, "deterministic");

    expect(r1.codeHash).toBe(r2.codeHash);
    expect(r1.modelHash).toBe(r2.modelHash);
    expect(r1.inputHash).toBe(r2.inputHash);
    expect(r1.outputHash).toBe(r2.outputHash);
    expect(r1.shortRef).toBe(r2.shortRef);
    expect(r1.engine).toBe(r2.engine);
  });

  it("changing input or output produces different receipt hashes", async () => {
    const r1 = await generateInferenceReceipt("Send 10 USDG", "Transfer 10 USDG", "deterministic");
    const r2 = await generateInferenceReceipt("Send 20 USDG", "Transfer 10 USDG", "deterministic");
    const r3 = await generateInferenceReceipt("Send 10 USDG", "Transfer 20 USDG", "deterministic");

    // Input changed
    expect(r1.inputHash).not.toBe(r2.inputHash);
    // Output unchanged
    expect(r1.outputHash).toBe(r2.outputHash);

    // Output changed
    expect(r1.outputHash).not.toBe(r3.outputHash);
    expect(r1.shortRef).not.toBe(r3.shortRef);
  });
});
