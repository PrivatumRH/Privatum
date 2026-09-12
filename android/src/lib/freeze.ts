import { COSIGNER_API_URL } from "../config/chain";
import { loadEncryptedItem, saveEncryptedItem } from "./secureStorage";

export interface MobileFreezeState {
  frozen: boolean;
  frozenUntil: string | null;
}

export interface TotpSetupResult {
  secret: string;
  uri: string;
}

/**
 * Queries the public freeze state for a smart account from the Co-Signer backend.
 */
export async function getMobileFreezeState(
  walletAddress: string
): Promise<MobileFreezeState> {
  if (!walletAddress) {
    return { frozen: false, frozenUntil: null };
  }

  const cleanAddr = walletAddress.trim().toLowerCase();
  try {
    const res = await fetch(`${COSIGNER_API_URL}/v1/wallets/${cleanAddr}/freeze`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (res.ok) {
      const data = await res.json();
      return {
        frozen: !!data.frozen,
        frozenUntil: data.frozenUntil || null,
      };
    }
  } catch (err) {
    console.warn("[freeze] Could not fetch freeze status:", err);
  }

  return { frozen: false, frozenUntil: null };
}

/**
 * Freezes the wallet on the Co-Signer backend, locking Shard B against outgoing transfers.
 * Uses the hardware-stored authenticated API session, or a 6-digit TOTP code.
 */
export async function freezeMobileWallet(
  walletAddress: string,
  hours: number | null = 24,
  code?: string
): Promise<{ success: boolean; message: string }> {
  if (!walletAddress) {
    throw new Error("No active wallet account.");
  }

  const cleanAddr = walletAddress.trim().toLowerCase();
  const apiKey = await loadEncryptedItem(`privatum_apikey_${cleanAddr}`);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const body: Record<string, any> = {
    hours,
  };
  if (code && /^\d{6}$/.test(code.trim())) {
    body.code = code.trim();
  }

  try {
    const res = await fetch(`${COSIGNER_API_URL}/v1/wallets/${cleanAddr}/freeze`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || `Failed to freeze wallet (${res.status})`);
    }

    const data = await res.json();
    return {
      success: true,
      message: data.message || "Wallet frozen. Co-signer Shard B is locked against outgoing transfers.",
    };
  } catch (err: any) {
    console.error("[freeze] Freeze request error:", err);
    throw err;
  }
}

/**
 * Unfreezes a frozen wallet on the Co-Signer backend using a verified 6-digit TOTP code.
 */
export async function unfreezeMobileWallet(
  walletAddress: string,
  code: string
): Promise<{ success: boolean; message: string }> {
  if (!walletAddress) {
    throw new Error("No active wallet account.");
  }
  if (!code || !/^\d{6}$/.test(code.trim())) {
    throw new Error("A valid 6-digit authenticator code is required to unfreeze.");
  }

  const cleanAddr = walletAddress.trim().toLowerCase();

  try {
    const res = await fetch(`${COSIGNER_API_URL}/v1/wallets/${cleanAddr}/unfreeze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim() }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || `Failed to unfreeze wallet (${res.status})`);
    }

    const data = await res.json();
    return {
      success: true,
      message: data.message || "Wallet successfully unfrozen.",
    };
  } catch (err: any) {
    console.error("[freeze] Unfreeze request error:", err);
    throw err;
  }
}

/**
 * Initiates TOTP 2FA enrollment with the backend Co-Signer.
 */
export async function setupMobileTotp(
  walletAddress: string
): Promise<TotpSetupResult> {
  if (!walletAddress) {
    throw new Error("No active wallet account.");
  }

  const cleanAddr = walletAddress.trim().toLowerCase();
  const apiKey = await loadEncryptedItem(`privatum_apikey_${cleanAddr}`);
  if (!apiKey) {
    throw new Error("Account authorization key not found.");
  }

  const res = await fetch(`${COSIGNER_API_URL}/v1/wallets/${cleanAddr}/totp/setup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Failed to initiate TOTP setup (${res.status})`);
  }

  const data = await res.json();
  await saveEncryptedItem(`privatum_totp_pending_${cleanAddr}`, data.secret);
  return {
    secret: data.secret,
    uri: data.uri,
  };
}

/**
 * Confirms TOTP setup by verifying the first 6-digit code with the backend.
 */
export async function confirmMobileTotp(
  walletAddress: string,
  code: string
): Promise<boolean> {
  if (!walletAddress) {
    throw new Error("No active wallet account.");
  }
  if (!code || !/^\d{6}$/.test(code.trim())) {
    throw new Error("A valid 6-digit verification code is required.");
  }

  const cleanAddr = walletAddress.trim().toLowerCase();
  const apiKey = await loadEncryptedItem(`privatum_apikey_${cleanAddr}`);
  if (!apiKey) {
    throw new Error("Account authorization key not found.");
  }

  const res = await fetch(`${COSIGNER_API_URL}/v1/wallets/${cleanAddr}/totp/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ code: code.trim() }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Failed to confirm TOTP code (${res.status})`);
  }

  const data = await res.json();
  if (data.ok) {
    await saveEncryptedItem(`privatum_totp_enabled_${cleanAddr}`, "true");
    return true;
  }
  return false;
}
