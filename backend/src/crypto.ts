import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { generatePrivateKey, privateKeyToAccount, privateKeyToAddress } from "viem/accounts";
import { hexToBytes, isHex } from "viem";

function getMasterKey(): Buffer {
  const rawKey =
    process.env.SHARD_B_ENCRYPTION_KEY ||
    "privatum-default-master-key-32-byte-hex-seed-fallback";
  // Enforce 32-byte key via SHA-256
  return createHash("sha256").update(rawKey).digest();
}


/**
 * Encrypt a secret string using AES-256-GCM.
 * Output format: iv:authTag:ciphertext (all in hex)
 */
export function encryptSecret(plaintext: string): string {
  const key = getMasterKey();
  const iv = randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt a secret encrypted with encryptSecret.
 */
export function decryptSecret(encryptedPayload: string): string {
  const parts = encryptedPayload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted payload format");
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = getMasterKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Hash an API key using SHA-256.
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Generate a cryptographically secure random API key.
 */
export function generateApiKey(): string {
  return "pvt_" + randomBytes(24).toString("hex");
}

/**
 * Generate a new secp256k1 key shard.
 */
export function generateShardKey(): { privateKey: `0x${string}`; address: `0x${string}` } {
  const privateKey = generatePrivateKey();
  const address = privateKeyToAddress(privateKey);
  return { privateKey, address };
}

/**
 * Co-sign a userOpHash using Shard B private key adhering to RFC 6979.
 */
export async function signUserOpHash(
  privateKeyHex: `0x${string}`,
  userOpHashHex: string
): Promise<{ signature: `0x${string}`; signer: `0x${string}` }> {
  if (!isHex(userOpHashHex) || userOpHashHex.length !== 66) {
    throw new Error("Invalid userOpHash: must be 0x-prefixed 32-byte hex");
  }

  const account = privateKeyToAccount(privateKeyHex);
  const rawBytes = hexToBytes(userOpHashHex as `0x${string}`);

  const signature = await account.signMessage({
    message: { raw: rawBytes },
  });

  return {
    signature,
    signer: account.address,
  };
}
