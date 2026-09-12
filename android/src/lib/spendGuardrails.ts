import { saveEncryptedItem, loadEncryptedItem } from "./secureStorage";

/**
 * Mobile Spending Guardrails for PRIVATUM.
 * Client-side limits to prevent accidental fat-finger transfers or drain attacks.
 */

export interface SpendingGuardrailConfig {
  enabled: boolean;
  dailyLimitUsd: number;
  singleTxLimitUsd: number;
  strictMode: boolean;
}

export interface SpendingRecord {
  txHash: string;
  timestamp: number;
  amount: number;
  symbol: string;
  amountUsd: number;
  recipient: string;
}

export interface GuardrailVerdict {
  allowed: boolean;
  warning: boolean;
  exceededDaily: boolean;
  exceededSingleTx: boolean;
  current24hTotalUsd: number;
  projected24hTotalUsd: number;
  dailyLimitUsd: number;
  singleTxLimitUsd: number;
  remainingUsd: number;
  title: string;
  message: string;
}

export const DEFAULT_GUARDRAIL_CONFIG: SpendingGuardrailConfig = {
  enabled: true,
  dailyLimitUsd: 500,
  singleTxLimitUsd: 250,
  strictMode: false,
};

export const ROLLING_WINDOW_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_ASSET_PRICES_USD: Record<string, number> = {
  USDG: 1.0,
  USDC: 1.0,
  USDT: 1.0,
  ETH: 2500.0,
  WETH: 2500.0,
  PRIV: 0.005,
};

export function estimateUsdValue(
  amount: number | string,
  symbol: string,
  priceOverrides?: Record<string, number>
): number {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (!Number.isFinite(num) || num <= 0) return 0;
  const sym = (symbol || "USDG").toUpperCase();
  const price = priceOverrides?.[sym] ?? DEFAULT_ASSET_PRICES_USD[sym] ?? 1.0;
  return num * price;
}

export function get24hSpendTotal(
  history: SpendingRecord[],
  referenceTime = Date.now()
): number {
  const windowStart = referenceTime - ROLLING_WINDOW_MS;
  return history.reduce((sum, record) => {
    if (record.timestamp >= windowStart) {
      return sum + (record.amountUsd || 0);
    }
    return sum;
  }, 0);
}

export function evaluateSpend(
  proposedAmount: number | string,
  symbol: string,
  config: SpendingGuardrailConfig,
  history: SpendingRecord[],
  referenceTime = Date.now(),
  priceOverrides?: Record<string, number>
): GuardrailVerdict {
  const txUsd = estimateUsdValue(proposedAmount, symbol, priceOverrides);
  const current24h = get24hSpendTotal(history, referenceTime);
  const projected24h = current24h + txUsd;
  const remaining = Math.max(0, config.dailyLimitUsd - current24h);

  if (!config.enabled) {
    return {
      allowed: true,
      warning: false,
      exceededDaily: false,
      exceededSingleTx: false,
      current24hTotalUsd: current24h,
      projected24hTotalUsd: projected24h,
      dailyLimitUsd: config.dailyLimitUsd,
      singleTxLimitUsd: config.singleTxLimitUsd,
      remainingUsd: remaining,
      title: "Guardrails Disabled",
      message: "Transfer within normal parameters.",
    };
  }

  const exceededSingleTx = txUsd > config.singleTxLimitUsd;
  const exceededDaily = projected24h > config.dailyLimitUsd;

  if (exceededSingleTx || exceededDaily) {
    const isStrict = config.strictMode;
    const allowed = !isStrict;

    let title = "Spending Guardrail Alert";
    let message = "";

    if (exceededSingleTx && exceededDaily) {
      title = "Daily & Single-Transfer Limit Exceeded";
      message = `This $${txUsd.toFixed(2)} transfer exceeds your $${config.singleTxLimitUsd} single transfer cap and pushes your 24h spending to $${projected24h.toFixed(2)} (daily cap: $${config.dailyLimitUsd}).`;
    } else if (exceededSingleTx) {
      title = "Single-Transfer Limit Exceeded";
      message = `This $${txUsd.toFixed(2)} transfer exceeds your configured single-transfer limit of $${config.singleTxLimitUsd}.`;
    } else {
      title = "Daily Limit Exceeded";
      message = `This transfer will bring your 24-hour total to $${projected24h.toFixed(2)}, exceeding your daily cap of $${config.dailyLimitUsd}. Remaining today: $${remaining.toFixed(2)}.`;
    }

    return {
      allowed,
      warning: true,
      exceededDaily,
      exceededSingleTx,
      current24hTotalUsd: current24h,
      projected24hTotalUsd: projected24h,
      dailyLimitUsd: config.dailyLimitUsd,
      singleTxLimitUsd: config.singleTxLimitUsd,
      remainingUsd: remaining,
      title,
      message,
    };
  }

  return {
    allowed: true,
    warning: false,
    exceededDaily: false,
    exceededSingleTx: false,
    current24hTotalUsd: current24h,
    projected24hTotalUsd: projected24h,
    dailyLimitUsd: config.dailyLimitUsd,
    singleTxLimitUsd: config.singleTxLimitUsd,
    remainingUsd: Math.max(0, config.dailyLimitUsd - projected24h),
    title: "Within Safe Limits",
    message: `Transfer of $${txUsd.toFixed(2)} is well within your daily cap ($${remaining.toFixed(2)} remaining).`,
  };
}

export async function loadMobileGuardrails(walletAddress: string): Promise<SpendingGuardrailConfig> {
  try {
    const raw = await loadEncryptedItem(`privatum_guardrails_${walletAddress.toLowerCase()}`);
    if (!raw) return DEFAULT_GUARDRAIL_CONFIG;
    return { ...DEFAULT_GUARDRAIL_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_GUARDRAIL_CONFIG;
  }
}

export async function saveMobileGuardrails(
  walletAddress: string,
  config: SpendingGuardrailConfig
): Promise<void> {
  try {
    await saveEncryptedItem(
      `privatum_guardrails_${walletAddress.toLowerCase()}`,
      JSON.stringify(config)
    );
  } catch (err) {
    console.error("Failed to save mobile guardrails:", err);
  }
}
