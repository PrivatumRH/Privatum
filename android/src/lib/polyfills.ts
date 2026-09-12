import * as Crypto from "expo-crypto";

/**
 * Global crypto polyfill for React Native / Expo environment.
 * Ensures viem and cryptographic modules can call crypto.getRandomValues
 * without throwing "crypto.getRandomValues must be defined".
 */
if (typeof globalThis.crypto !== "object" || globalThis.crypto === null) {
  (globalThis as any).crypto = {};
}

if (typeof globalThis.crypto.getRandomValues !== "function") {
  (globalThis as any).crypto.getRandomValues = <T extends ArrayBufferView | null>(
    array: T
  ): T => {
    if (!array) return array;
    return Crypto.getRandomValues(array as any) as any;
  };
}

export {};
