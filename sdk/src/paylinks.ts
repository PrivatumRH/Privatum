import type { Address } from "viem";
import type {
  CreatePayLinkParams,
  CreatePayLinkResponse,
  PublicPayLink,
  UserPayLinkItem,
} from "./types.js";

export const DEFAULT_PRIVATUM_API_URL = "https://privatum-backend.onrender.com";

export async function createPayLink(
  params: CreatePayLinkParams,
  options: { apiUrl?: string; signal?: AbortSignal } = {}
): Promise<CreatePayLinkResponse> {
  const apiUrl = options.apiUrl || DEFAULT_PRIVATUM_API_URL;
  const res = await fetch(`${apiUrl}/v1/paylinks/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    signal: options.signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Failed to create paylink (${res.status})`);
  }

  return (await res.json()) as CreatePayLinkResponse;
}

export async function getPayLink(
  slug: string,
  options: { apiUrl?: string; signal?: AbortSignal } = {}
): Promise<PublicPayLink> {
  const apiUrl = options.apiUrl || DEFAULT_PRIVATUM_API_URL;
  const res = await fetch(`${apiUrl}/v1/paylinks/${encodeURIComponent(slug)}`, {
    headers: { Accept: "application/json" },
    signal: options.signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Failed to fetch paylink (${res.status})`);
  }

  const data = (await res.json()) as { success: boolean; paylink: PublicPayLink };
  return data.paylink;
}

export async function checkAndSweepPayLink(
  slug: string,
  options: { apiUrl?: string; signal?: AbortSignal } = {}
): Promise<{ swept: boolean; status: string; txHash?: string }> {
  const apiUrl = options.apiUrl || DEFAULT_PRIVATUM_API_URL;
  const res = await fetch(`${apiUrl}/v1/paylinks/check/${encodeURIComponent(slug)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: options.signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Failed to check paylink (${res.status})`);
  }

  const data = await res.json();
  return data.result;
}

export async function listUserPayLinks(
  walletAddress: Address,
  options: { apiUrl?: string; signal?: AbortSignal } = {}
): Promise<UserPayLinkItem[]> {
  const apiUrl = options.apiUrl || DEFAULT_PRIVATUM_API_URL;
  const res = await fetch(`${apiUrl}/v1/paylinks/user/${encodeURIComponent(walletAddress)}`, {
    headers: { Accept: "application/json" },
    signal: options.signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Failed to list user paylinks (${res.status})`);
  }

  const data = (await res.json()) as { success: boolean; paylinks: UserPayLinkItem[] };
  return data.paylinks || [];
}

export async function cancelPayLink(
  slug: string,
  options: { apiUrl?: string; signal?: AbortSignal } = {}
): Promise<boolean> {
  const apiUrl = options.apiUrl || DEFAULT_PRIVATUM_API_URL;
  const res = await fetch(`${apiUrl}/v1/paylinks/cancel/${encodeURIComponent(slug)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: options.signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Failed to cancel paylink (${res.status})`);
  }

  const data = await res.json();
  return !!data.success;
}
