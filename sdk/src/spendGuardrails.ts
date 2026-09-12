/**
 * In-App Spending Guardrails for PRIVATUM Desktop.
 *
 * Provides client-side financial limits to protect against accidental
 * fat-finger transfers, excessive spending, or unauthorized wallet drain.
 * Runs 100% locally in the desktop app with zero on-chain dependencies.
 */

export interface SpendingGuardrailConfig {
  enabled: boolean;
  dailyLimitUsd: number;
  singleTxLimitUsd: number;
  strictMode: boolean; // If true, completely blocks send; if false, requires explicit override
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

export const ROLLING_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Reference USD prices for Robinhood Chain assets. */
export const DEFAULT_ASSET_PRICES_USD: Record<string, number> = {
  USDG: 1.0,
  USDC: 1.0,
  USDT: 1.0,
  ETH: 2500.0,
  WETH: 2500.0,
  PRIV: 0.005,
};

/**
 * Estimates USD equivalent for a given token amount.
 */
export function estimateUsdValue(
  amount: string | number,
  symbol: string,
  priceOverrides?: Record<string, number>
): number {
  const numericAmount = typeof amount === "number" ? amount : parseFloat(amount) || 0;
  if (numericAmount <= 0) return 0;

  const cleanSymbol = symbol.toUpperCase().trim();
  const prices = { ...DEFAULT_ASSET_PRICES_USD, ...priceOverrides };
  const price = prices[cleanSymbol] ?? 1.0;

  return Math.round(numericAmount * price * 100) / 100;
}

/**
 * Calculates total USD spent in the rolling 24-hour window.
 */
export function get24hSpendTotal(records: SpendingRecord[], now = Date.now()): number {
  const cutoff = now - ROLLING_WINDOW_MS;
  const recentRecords = records.filter((r) => r.timestamp >= cutoff);
  const total = recentRecords.reduce((acc, r) => acc + (r.amountUsd || 0), 0);
  return Math.round(total * 100) / 100;
}

/**
 * Evaluates a proposed transaction against the user's spending guardrails.
 */
export function evaluateSpend(
  config: SpendingGuardrailConfig,
  amountUsd: number,
  records: SpendingRecord[],
  now = Date.now()
): GuardrailVerdict {
  if (!config.enabled) {
    return {
      allowed: true,
      warning: false,
      exceededDaily: false,
      exceededSingleTx: false,
      current24hTotalUsd: 0,
      projected24hTotalUsd: amountUsd,
      dailyLimitUsd: config.dailyLimitUsd,
      singleTxLimitUsd: config.singleTxLimitUsd,
      remainingUsd: config.dailyLimitUsd,
      title: "Guardrails Disabled",
      message: "Spending guardrails are currently turned off.",
    };
  }

  const current24hTotal = get24hSpendTotal(records, now);
  const projected24hTotal = Math.round((current24hTotal + amountUsd) * 100) / 100;
  const remainingUsd = Math.max(0, Math.round((config.dailyLimitUsd - current24hTotal) * 100) / 100);

  const exceededDaily = projected24hTotal > config.dailyLimitUsd;
  const exceededSingleTx = config.singleTxLimitUsd > 0 && amountUsd > config.singleTxLimitUsd;

  if (!exceededDaily && !exceededSingleTx) {
    return {
      allowed: true,
      warning: false,
      exceededDaily: false,
      exceededSingleTx: false,
      current24hTotalUsd: current24hTotal,
      projected24hTotalUsd: projected24hTotal,
      dailyLimitUsd: config.dailyLimitUsd,
      singleTxLimitUsd: config.singleTxLimitUsd,
      remainingUsd: Math.max(0, Math.round((config.dailyLimitUsd - projected24hTotal) * 100) / 100),
      title: "Within Guardrails",
      message: `Transaction is within your daily $${config.dailyLimitUsd.toFixed(2)} allowance.`,
    };
  }

  // Violation occurred
  let title = "Daily Limit Exceeded";
  let message = `This transfer ($${amountUsd.toFixed(2)}) pushes 24h spend to $${projected24hTotal.toFixed(2)}, exceeding your daily $${config.dailyLimitUsd.toFixed(2)} limit.`;

  if (exceededSingleTx && !exceededDaily) {
    title = "Single Transfer Cap Exceeded";
    message = `This transfer ($${amountUsd.toFixed(2)}) exceeds your single transaction guardrail of $${config.singleTxLimitUsd.toFixed(2)}.`;
  } else if (exceededDaily && exceededSingleTx) {
    title = "Spending Limits Exceeded";
    message = `Transfer exceeds both your single-tx cap ($${config.singleTxLimitUsd.toFixed(2)}) and daily 24h limit ($${config.dailyLimitUsd.toFixed(2)}).`;
  }

  return {
    allowed: !config.strictMode, // If not strict, allowed with explicit user override
    warning: true,
    exceededDaily,
    exceededSingleTx,
    current24hTotalUsd: current24hTotal,
    projected24hTotalUsd: projected24hTotal,
    dailyLimitUsd: config.dailyLimitUsd,
    singleTxLimitUsd: config.singleTxLimitUsd,
    remainingUsd,
    title,
    message,
  };
}

// Storage helpers
function getStorageKeys(walletAddress: string) {
  const normalized = walletAddress.trim().toLowerCase();
  return {
    configKey: `privatum_guardrail_config_${normalized}`,
    historyKey: `privatum_guardrail_history_${normalized}`,
  };
}

export function loadGuardrailConfig(walletAddress: string): SpendingGuardrailConfig {
  if (typeof window === "undefined" || !walletAddress) return DEFAULT_GUARDRAIL_CONFIG;
  try {
    const { configKey } = getStorageKeys(walletAddress);
    const raw = localStorage.getItem(configKey);
    if (!raw) return DEFAULT_GUARDRAIL_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULT_GUARDRAIL_CONFIG.enabled,
      dailyLimitUsd: typeof parsed.dailyLimitUsd === "number" ? parsed.dailyLimitUsd : DEFAULT_GUARDRAIL_CONFIG.dailyLimitUsd,
      singleTxLimitUsd: typeof parsed.singleTxLimitUsd === "number" ? parsed.singleTxLimitUsd : DEFAULT_GUARDRAIL_CONFIG.singleTxLimitUsd,
      strictMode: typeof parsed.strictMode === "boolean" ? parsed.strictMode : DEFAULT_GUARDRAIL_CONFIG.strictMode,
    };
  } catch {
    return DEFAULT_GUARDRAIL_CONFIG;
  }
}

export function saveGuardrailConfig(walletAddress: string, config: SpendingGuardrailConfig): void {
  if (typeof window === "undefined" || !walletAddress) return;
  try {
    const { configKey } = getStorageKeys(walletAddress);
    localStorage.setItem(configKey, JSON.stringify(config));
  } catch (err) {
    console.error("Failed to save guardrail config:", err);
  }
}

export function loadSpendingHistory(walletAddress: string): SpendingRecord[] {
  if (typeof window === "undefined" || !walletAddress) return [];
  try {
    const { historyKey } = getStorageKeys(walletAddress);
    const raw = localStorage.getItem(historyKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function recordSpend(
  walletAddress: string,
  record: Omit<SpendingRecord, "timestamp"> & { timestamp?: number }
): void {
  if (typeof window === "undefined" || !walletAddress) return;
  try {
    const { historyKey } = getStorageKeys(walletAddress);
    const history = loadSpendingHistory(walletAddress);
    const entry: SpendingRecord = {
      txHash: record.txHash,
      timestamp: record.timestamp || Date.now(),
      amount: record.amount,
      symbol: record.symbol,
      amountUsd: record.amountUsd,
      recipient: record.recipient,
    };

    // Prune entries older than 7 days to keep storage lean
    const pruneCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const updated = [entry, ...history.filter((h) => h.timestamp >= pruneCutoff)];

    localStorage.setItem(historyKey, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to record spend:", err);
  }
}

export function clearSpendingHistory(walletAddress: string): void {
  if (typeof window === "undefined" || !walletAddress) return;
  try {
    const { historyKey } = getStorageKeys(walletAddress);
    localStorage.removeItem(historyKey);
  } catch (err) {
    console.error("Failed to clear spending history:", err);
  }
}
