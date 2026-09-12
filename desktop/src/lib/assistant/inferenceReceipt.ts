/**
 * Inference Receipt Generator - Privatum v2
 *
 * Produces a cryptographic receipt for every assistant pipeline execution.
 * All hashes are real SHA-256 digests computed via Web Crypto API.
 */

import parserSource from "./deterministicParser.ts?raw";
import explainerSource from "./transactionExplainer.ts?raw";
import gatewaySource from "./redactionGateway.ts?raw";
import workerSource from "./assistant.worker.ts?raw";
import { sha256hex } from "./sha256";

export { sha256hex };

const SMOLLM2_MODEL_ID = "HuggingFaceTB/SmolLM2-135M-Instruct:q4";

let _detCodeHash: string | null = null;
let _wasmCodeHash: string | null = null;
let _wasmModelHash: string | null = null;

export type ExecutionEngine = "client-cpu-deterministic" | "client-cpu-wasm";

export interface InferenceReceipt {
  codeHash: string;
  modelHash: string;
  inputHash: string;
  outputHash: string;
  engine: ExecutionEngine;
  ts: number;
  shortRef: string;
}



export async function getDetCodeHash(): Promise<string> {
  if (_detCodeHash) return _detCodeHash;
  _detCodeHash = await sha256hex(parserSource + explainerSource + gatewaySource);
  return _detCodeHash;
}

export async function getWasmCodeHash(): Promise<string> {
  if (_wasmCodeHash) return _wasmCodeHash;
  _wasmCodeHash = await sha256hex(workerSource);
  return _wasmCodeHash;
}

export async function getWasmModelHash(): Promise<string> {
  if (_wasmModelHash) return _wasmModelHash;
  _wasmModelHash = await sha256hex(SMOLLM2_MODEL_ID);
  return _wasmModelHash;
}

export async function generateInferenceReceipt(
  sanitizedInput: string,
  outputContent: string,
  engineMode: "deterministic" | "smollm2_wasm"
): Promise<InferenceReceipt> {
  const isWasm = engineMode === "smollm2_wasm";

  const [codeHash, modelHash, inputHash, outputHash] = isWasm
    ? await Promise.all([
        getWasmCodeHash(),
        getWasmModelHash(),
        sha256hex(sanitizedInput),
        sha256hex(outputContent),
      ])
    : await Promise.all([
        getDetCodeHash(),
        getDetCodeHash(),
        sha256hex(sanitizedInput),
        sha256hex(outputContent),
      ]);

  return {
    codeHash,
    modelHash,
    inputHash,
    outputHash,
    engine: isWasm ? "client-cpu-wasm" : "client-cpu-deterministic",
    ts: Date.now(),
    shortRef: outputHash.slice(0, 8),
  };
}
