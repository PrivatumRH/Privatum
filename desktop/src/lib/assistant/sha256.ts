/**
 * SHA-256 helper shared by the receipt generator and the offline verifier.
 *
 * Lives in its own module with no bundler-specific imports so that
 * `receiptExport.ts` stays runnable outside Vite - the standalone verifier in
 * `scripts/verify-receipt.ts` imports the very same verification code the app
 * runs, which is what stops the two from drifting apart.
 *
 * Uses Web Crypto, present in browsers, Node 18+ and Bun alike.
 */
export async function sha256hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
