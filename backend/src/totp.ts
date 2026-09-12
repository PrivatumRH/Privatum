import { createHmac, randomBytes } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Generate a 20-byte cryptographically secure random TOTP secret.
 */
export function generateTotpSecret(): Buffer {
  return randomBytes(20);
}

/**
 * Encode a buffer to a Base32 string (RFC 4648).
 */
export function base32Encode(buffer: Buffer): string {
  let result = "";
  let bits = 0;
  let value = 0;

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      result += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    result += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return result;
}

/**
 * Decode a Base32 string back to a buffer.
 */
export function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/=+$/, "").replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const result: number[] = [];

  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      result.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(result);
}

/**
 * Compute the 6-digit TOTP code for a given 30-second time counter.
 */
function getCodeForCounter(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));

  const hmac = createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;

  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1_000_000;
  return otp.toString().padStart(6, "0");
}

/**
 * The code an authenticator app would be showing right now.
 *
 * Exported so callers that must produce a code rather than check one - the
 * freeze test suite, chiefly - do not reimplement HOTP beside the real thing
 * and drift away from it.
 */
export function generateTotpCode(secret: Buffer): string {
  return getCodeForCounter(secret, Math.floor(Date.now() / 1000 / 30));
}

/**
 * Verify a 6-digit TOTP code against a secret with +/- 1 window drift tolerance.
 */
export function verifyTotp(secret: Buffer, code: string): boolean {
  if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
    return false;
  }

  const currentCounter = Math.floor(Date.now() / 1000 / 30);
  const allowedWindows = [-1, 0, 1];

  return allowedWindows.some((windowOffset) => {
    const expected = getCodeForCounter(secret, currentCounter + windowOffset);
    return expected === code;
  });
}

/**
 * Generate standard otpauth:// URI for authenticator app QR code scanning.
 */
export function buildOtpAuthUri(base32Secret: string, walletAddress: string): string {
  const cleanAddress = walletAddress.toLowerCase();
  const account = `${cleanAddress.slice(0, 8)}...${cleanAddress.slice(-4)}`;
  return `otpauth://totp/Privatum:${account}?secret=${base32Secret}&issuer=Privatum&algorithm=SHA1&digits=6&period=30`;
}
