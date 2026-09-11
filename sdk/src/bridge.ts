import type { Address } from "viem";
import { ROBINHOOD_CHAIN_ID } from "./chain.js";
import type {
  BridgeChainId,
  BridgeQuote,
  BridgeQuoteRequest,
  BridgeRebateEstimate,
  RelayIntentStatus,
  RelayQuoteResponse,
} from "./types.js";

/**
 * Cross-chain bridging via Relay (https://relay.link) with a PRIV rebate on the
 * relayer spread.
 *
 * Relay splits its relayer fee into two parts:
 *   fees.relayerGas     - destination gas the relayer fronts (a pass-through cost)
 *   fees.relayerService - the relayer's margin on top, i.e. the *spread*
 *
 * Only the spread is rebated; rebating relayerGas would be paying users back for
 * a real cost rather than a margin.
 */

export const RELAY_API_URL = "https://api.relay.link";

/** Chains Privatum bridges between. All four are Relay-supported. */
export const BRIDGE_CHAIN_IDS = [1, 8453, 42161, ROBINHOOD_CHAIN_ID] as const;

export const BRIDGE_CHAIN_NAMES: Record<BridgeChainId, string> = {
  1: "Ethereum",
  8453: "Base",
  42161: "Arbitrum",
  4663: "Robinhood Chain",
};

/** PRIV (PrivatumRH), 18 decimals. Deployed on Robinhood Chain only. */
export const PRIV_ADDRESS = "0xee2ddd7128c291b027712eca157b3ff31a55a05a" as const;
export const PRIV_DECIMALS = 18;
export const PRIV_SYMBOL = "PRIV";

/** Share of the relayer spread returned to the bridging user, in basis points. */
export const DEFAULT_REBATE_BPS = 2500; // 25%

export const NATIVE_CURRENCY = "0x0000000000000000000000000000000000000000" as const;

export function isBridgeChainId(chainId: number): chainId is BridgeChainId {
  return (BRIDGE_CHAIN_IDS as readonly number[]).includes(chainId);
}

/**
 * Parses a decimal USD string from Relay into integer cents.
 *
 * Relay returns USD as decimal strings ("0.079452"). Rebate balances are held in
 * integer micro-USD to keep the ledger exact - float cents would drift over many
 * small bridges.
 */
export function usdToMicros(usd: string | number | undefined | null): bigint {
  if (usd === undefined || usd === null || usd === "") return 0n;
  const text = String(usd).trim();
  if (!/^-?\d*\.?\d*$/.test(text) || text === "" || text === ".") return 0n;
  const negative = text.startsWith("-");
  const [whole = "0", fraction = ""] = text.replace("-", "").split(".");
  const micros = BigInt(whole || "0") * 1_000_000n + BigInt((fraction + "000000").slice(0, 6) || "0");
  return negative ? -micros : micros;
}

export function microsToUsd(micros: bigint): string {
  const negative = micros < 0n;
  const abs = negative ? -micros : micros;
  const whole = abs / 1_000_000n;
  const fraction = (abs % 1_000_000n).toString().padStart(6, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

/**
 * Extracts the relayer spread (margin above gas) from a Relay quote, in micro-USD.
 *
 * Relay has historically reported `relayerService` directly; where it is absent
 * this falls back to `relayer - relayerGas`, which is the same quantity.
 */
export function extractSpreadMicros(quote: RelayQuoteResponse): bigint {
  const fees = quote.fees ?? {};
  const service = usdToMicros(fees.relayerService?.amountUsd);
  if (service > 0n) return service;

  const relayer = usdToMicros(fees.relayer?.amountUsd);
  const relayerGas = usdToMicros(fees.relayerGas?.amountUsd);
  const derived = relayer - relayerGas;
  return derived > 0n ? derived : 0n;
}

/** Rebate owed on a given spread, floored to micro-USD. */
export function calculateRebateMicros(spreadMicros: bigint, rebateBps = DEFAULT_REBATE_BPS): bigint {
  if (spreadMicros <= 0n || rebateBps <= 0) return 0n;
  return (spreadMicros * BigInt(rebateBps)) / 10_000n;
}

/**
 * Converts a micro-USD rebate into PRIV wei at a given PRIV/USD price.
 *
 * `privUsdPrice` is a decimal string ("0.0184"). Returns 0 when the price is
 * unavailable or non-positive rather than dividing by zero - callers should
 * treat a zero result as "not claimable yet".
 */
export function rebateMicrosToPrivWei(rebateMicros: bigint, privUsdPrice: string | number): bigint {
  const priceMicros = usdToMicros(privUsdPrice);
  if (rebateMicros <= 0n || priceMicros <= 0n) return 0n;
  return (rebateMicros * 10n ** BigInt(PRIV_DECIMALS)) / priceMicros;
}

export function formatPriv(weiAmount: bigint, displayDecimals = 4): string {
  const base = 10n ** BigInt(PRIV_DECIMALS);
  const whole = weiAmount / base;
  const fraction = (weiAmount % base).toString().padStart(PRIV_DECIMALS, "0").slice(0, displayDecimals);
  return `${whole}.${fraction}`;
}

/**
 * Requests a bridge quote from Relay.
 *
 * `appFeeRecipient` / `appFeeBps` attach Privatum's own fee to the route; that
 * balance accrues with Relay and is claimable via /app-fees/{wallet}/claim. It
 * is what funds the rebate pool.
 */
export async function getBridgeQuote(
  params: BridgeQuoteRequest,
  options: { apiUrl?: string; signal?: AbortSignal } = {}
): Promise<RelayQuoteResponse> {
  const apiUrl = options.apiUrl ?? RELAY_API_URL;

  if (!isBridgeChainId(params.originChainId)) {
    throw new Error(`Unsupported origin chain: ${params.originChainId}`);
  }
  if (!isBridgeChainId(params.destinationChainId)) {
    throw new Error(`Unsupported destination chain: ${params.destinationChainId}`);
  }
  if (params.originChainId === params.destinationChainId) {
    throw new Error("Origin and destination chains must differ");
  }

  const body: Record<string, unknown> = {
    user: params.user,
    recipient: params.recipient ?? params.user,
    originChainId: params.originChainId,
    destinationChainId: params.destinationChainId,
    originCurrency: params.originCurrency ?? NATIVE_CURRENCY,
    destinationCurrency: params.destinationCurrency ?? NATIVE_CURRENCY,
    amount: params.amount,
    tradeType: params.tradeType ?? "EXACT_INPUT",
  };

  if (params.appFeeRecipient && params.appFeeBps && params.appFeeBps > 0) {
    body.appFees = [{ recipient: params.appFeeRecipient, fee: String(params.appFeeBps) }];
  }

  const response = await fetch(`${apiUrl}/quote/v2`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Relay quote failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  return (await response.json()) as RelayQuoteResponse;
}

/** Quote plus the rebate it would earn. */
export async function quoteBridgeWithRebate(
  params: BridgeQuoteRequest,
  options: { apiUrl?: string; rebateBps?: number; signal?: AbortSignal } = {}
): Promise<BridgeQuote> {
  const quote = await getBridgeQuote(params, options);
  const rebateBps = options.rebateBps ?? DEFAULT_REBATE_BPS;
  const spreadMicros = extractSpreadMicros(quote);
  const rebateMicros = calculateRebateMicros(spreadMicros, rebateBps);

  const estimate: BridgeRebateEstimate = {
    spreadUsd: microsToUsd(spreadMicros),
    rebateUsd: microsToUsd(rebateMicros),
    rebateBps,
    rebateCurrency: PRIV_SYMBOL,
    settlementChainId: ROBINHOOD_CHAIN_ID,
  };

  return {
    requestId: quote.steps?.[0]?.requestId ?? quote.requestId ?? null,
    quote,
    rebate: estimate,
  };
}

/** Polls Relay for the settlement status of a bridge request. */
export async function getBridgeStatus(
  requestId: string,
  options: { apiUrl?: string; signal?: AbortSignal } = {}
): Promise<RelayIntentStatus> {
  const apiUrl = options.apiUrl ?? RELAY_API_URL;
  const response = await fetch(
    `${apiUrl}/intents/status/v3?requestId=${encodeURIComponent(requestId)}`,
    { signal: options.signal }
  );

  if (!response.ok) {
    throw new Error(`Relay status lookup failed (${response.status})`);
  }

  return (await response.json()) as RelayIntentStatus;
}

/** Relay app-fee balance accrued to `wallet` - the pool the rebate is paid from. */
export async function getAppFeeBalances(
  wallet: Address,
  options: { apiUrl?: string; signal?: AbortSignal } = {}
): Promise<unknown> {
  const apiUrl = options.apiUrl ?? RELAY_API_URL;
  const response = await fetch(`${apiUrl}/app-fees/${wallet}/balances`, { signal: options.signal });
  if (!response.ok) {
    throw new Error(`Relay app-fee balance lookup failed (${response.status})`);
  }
  return await response.json();
}
