import {
  COSIGNER_API_URL,
  PUBLIC_APP_URL,
  USDG_TOKEN_ADDRESS,
  NATIVE_ETH_ADDRESS,
} from "../config/chain";
import {
  loadStoredPayLinks,
  saveStoredPayLinks,
  type MobilePayLink,
} from "./wallet";

export interface CreateMobilePayLinkParams {
  token: string;
  amount: string;
  memo?: string;
  expiresInHours?: number;
}

export interface BackendPayLinkItem {
  id?: string;
  slug: string;
  recipient_address: string;
  token_address: string;
  token_symbol: string;
  expected_amount: string | number | null;
  memo: string | null;
  deposit_address: string;
  route_mode: string;
  status: "active" | "sweeping" | "settled" | "expired" | "cancelled";
  received_amount?: string | null;
  swept_amount?: string | null;
  sweep_tx_hash?: string | null;
  expires_at: string;
  settled_at?: string | null;
  created_at: string;
}

/**
 * Creates a real disposable payment link on Robinhood Chain via the Co-Signer API.
 * Generates an ephemeral burner key on backend and stores metadata in PostgreSQL.
 */
export async function createRealMobilePayLink(
  walletAddress: string,
  params: CreateMobilePayLinkParams
): Promise<MobilePayLink> {
  const cleanWallet = walletAddress.trim().toLowerCase();
  const isEth = params.token.toUpperCase() === "ETH";
  const tokenAddress = isEth ? NATIVE_ETH_ADDRESS : USDG_TOKEN_ADDRESS;
  const tokenSymbol = isEth ? "ETH" : "USDG";
  const expectedAmount = params.amount ? parseFloat(params.amount) : undefined;

  try {
    const res = await fetch(`${COSIGNER_API_URL}/v1/paylinks/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient_address: cleanWallet,
        token_address: tokenAddress,
        token_symbol: tokenSymbol,
        amount: expectedAmount,
        memo: params.memo?.trim() || undefined,
        route_mode: "direct",
        expires_in_hours: params.expiresInHours || 72,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || `Failed to create payment link (${res.status})`);
    }

    const data = await res.json();
    const newLink: MobilePayLink = {
      id: data.slug || `pl-${Date.now()}`,
      slug: data.slug,
      token: tokenSymbol,
      amount: expectedAmount ? expectedAmount.toFixed(2) : "Flexible",
      memo: params.memo?.trim() || undefined,
      status: "pending",
      depositAddress: data.deposit_address,
      paymentUrl: `${PUBLIC_APP_URL}/pay/${data.slug}`,
      createdAt: Date.now(),
    };

    // Cache locally
    const existing = await loadStoredPayLinks(cleanWallet);
    const updated = [newLink, ...existing.filter((l) => l.slug !== newLink.slug)];
    await saveStoredPayLinks(cleanWallet, updated);

    return newLink;
  } catch (err: any) {
    console.error("[paylinks] Failed to create paylink via backend:", err);
    throw err;
  }
}

/**
 * Fetches the user's active and settled payment links from the Co-Signer backend.
 * Merges with local storage cache so links are accessible offline.
 */
export async function fetchMobilePayLinks(
  walletAddress: string
): Promise<MobilePayLink[]> {
  if (!walletAddress) return [];
  const cleanWallet = walletAddress.trim().toLowerCase();

  try {
    const res = await fetch(
      `${COSIGNER_API_URL}/v1/paylinks/user/${encodeURIComponent(cleanWallet)}`,
      {
        headers: { Accept: "application/json" },
      }
    );

    if (res.ok) {
      const data = (await res.json()) as { success: boolean; paylinks: BackendPayLinkItem[] };
      const rawList = data.paylinks || [];

      const converted: MobilePayLink[] = rawList.map((item) => ({
        id: item.id || item.slug,
        slug: item.slug,
        token: item.token_symbol || (item.token_address === NATIVE_ETH_ADDRESS ? "ETH" : "USDG"),
        amount: item.expected_amount ? String(item.expected_amount) : "Flexible",
        memo: item.memo || undefined,
        status: item.status === "settled" ? "swept" : "pending",
        depositAddress: item.deposit_address,
        paymentUrl: `${PUBLIC_APP_URL}/pay/${item.slug}`,
        createdAt: item.created_at ? new Date(item.created_at).getTime() : Date.now(),
      }));

      await saveStoredPayLinks(cleanWallet, converted);
      return converted;
    }
  } catch (err) {
    console.warn("[paylinks] Backend unreachable, loading cached paylinks:", err);
  }

  return loadStoredPayLinks(cleanWallet);
}

/**
 * Checks if a disposable paylink's burner deposit address has received funds on Robinhood Chain,
 * and triggers an automated UserOp sweep into the recipient's smart account.
 */
export async function checkAndSweepMobilePayLink(
  slug: string
): Promise<{ swept: boolean; status: string; txHash?: string }> {
  try {
    const res = await fetch(`${COSIGNER_API_URL}/v1/paylinks/check/${encodeURIComponent(slug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || `Failed to check paylink status (${res.status})`);
    }

    const data = await res.json();
    return data.result || { swept: false, status: "pending" };
  } catch (err) {
    console.error("[paylinks] Failed to check paylink sweep:", err);
    throw err;
  }
}
