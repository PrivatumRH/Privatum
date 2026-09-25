/**
 * Gas-Optimal Congestion Scheduler & Outbox Fee Optimizer Engine for PRIVATUM.
 *
 * Evaluates real-time gas market conditions on Robinhood Chain / Ethereum L2:
 * 1. Categorizes network congestion (Optimal, Moderate, Congested).
 * 2. Predicts cyclic low-gas broadcast windows based on temporal diurnal models.
 * 3. Inspects queued transactions in Offline Outbox to compute total gas exposure.
 * 4. Calculates projected fee savings from delaying non-urgent batch broadcasts.
 * 5. Flags overpriced or underpriced transactions in the queue.
 *
 * 100% client-side deterministic evaluation with zero external analytics tracking.
 */

import type { OfflineTransaction } from "./offlineOutbox";

export type CongestionTier = "optimal" | "moderate" | "congested";

export interface CongestionWindow {
  currentTier: CongestionTier;
  currentGwei: number;
  optimalTargetGwei: number;
  recommendation: "broadcast_now" | "hold_for_window" | "urgent_only";
  bestWindowUtc: string;
  estimatedWaitHours: number;
  explanation: string;
}

export interface OutboxGasItemAnalysis {
  id: string;
  recipient: string;
  recipientLabel?: string;
  asset: "ETH" | "USDG";
  amount: string;
  gasLimit: number;
  currentCostUsd: number;
  optimalCostUsd: number;
  savingsUsd: number;
  status: "fair" | "overpriced" | "underpriced";
}

export interface OutboxFeeAnalysis {
  queuedCount: number;
  totalGasUnits: number;
  currentCostEth: number;
  currentCostUsd: number;
  optimalCostEth: number;
  optimalCostUsd: number;
  projectedSavingsUsd: number;
  projectedSavingsPercent: number;
  items: OutboxGasItemAnalysis[];
}

export interface GasOptimizationReport {
  currentGwei: number;
  congestion: CongestionWindow;
  outboxAnalysis: OutboxFeeAnalysis;
  targetGweiThreshold: number;
  summary: string;
  actionableAdvice: string[];
  generatedAt: number;
}

export interface GasSchedulerContext {
  offlineOutbox?: OfflineTransaction[];
  gasPriceGwei?: string | number;
  ethPriceUsd?: number;
  currentHourUtc?: number;
}

// Default baseline benchmarks
const DEFAULT_ETH_PRICE_USD = 2800;
const OPTIMAL_GWEI_THRESHOLD = 0.4;
const MODERATE_GWEI_THRESHOLD = 1.2;

/**
 * Normalizes input gas price in Gwei.
 */
export function parseGasPriceGwei(val?: string | number): number {
  if (typeof val === "number" && !isNaN(val) && val > 0) return val;
  if (typeof val === "string") {
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 1.06; // Fallback typical Robinhood Chain baseline
}

/**
 * Determines congestion tier from current Gwei rate.
 */
export function getCongestionTier(gwei: number): CongestionTier {
  if (gwei <= OPTIMAL_GWEI_THRESHOLD) return "optimal";
  if (gwei <= MODERATE_GWEI_THRESHOLD) return "moderate";
  return "congested";
}

/**
 * Evaluates network congestion and predicts next optimal broadcast window.
 * Models standard diurnal block space demand:
 * Typical lowest congestion occurs between 02:00 UTC and 07:00 UTC (Asian morning / US night).
 */
export function evaluateCongestionWindow(
  currentGwei: number,
  currentHourUtc: number = new Date().getUTCHours()
): CongestionWindow {
  const currentTier = getCongestionTier(currentGwei);
  const optimalTargetGwei = Math.min(OPTIMAL_GWEI_THRESHOLD, Number((currentGwei * 0.45).toFixed(2)));

  // Target window: 02:00 - 06:00 UTC
  const targetStartHour = 3;
  let waitHours = (targetStartHour - currentHourUtc + 24) % 24;
  if (waitHours === 0 && currentTier === "optimal") {
    waitHours = 0;
  } else if (waitHours === 0) {
    waitHours = 24;
  }

  let recommendation: "broadcast_now" | "hold_for_window" | "urgent_only";
  let explanation: string;

  if (currentTier === "optimal") {
    recommendation = "broadcast_now";
    explanation = `Network gas is exceptionally low (${currentGwei.toFixed(2)} Gwei). Ideal window for clearing outbox queue and multi-recipient batches immediately.`;
  } else if (currentTier === "moderate") {
    recommendation = waitHours > 6 ? "broadcast_now" : "hold_for_window";
    explanation = `Gas is moderate (${currentGwei.toFixed(2)} Gwei). Routine transfers can proceed, but high-volume batches can save ~40% by scheduling for off-peak hours (~${waitHours}h).`;
  } else {
    recommendation = "hold_for_window";
    explanation = `Network congestion is elevated (${currentGwei.toFixed(2)} Gwei). Delaying non-urgent outbox transfers to off-peak window is strongly advised.`;
  }

  const bestWindowUtc = "02:00 - 06:00 UTC";

  return {
    currentTier,
    currentGwei,
    optimalTargetGwei,
    recommendation,
    bestWindowUtc,
    estimatedWaitHours: waitHours,
    explanation,
  };
}

/**
 * Analyzes offline outbox transactions against current and optimal fee markets.
 */
export function analyzeOutboxFees(
  outbox: OfflineTransaction[],
  currentGwei: number,
  optimalTargetGwei: number,
  ethPriceUsd: number = DEFAULT_ETH_PRICE_USD
): OutboxFeeAnalysis {
  const queued = outbox.filter((t) => t.status === "queued");

  if (queued.length === 0) {
    return {
      queuedCount: 0,
      totalGasUnits: 0,
      currentCostEth: 0,
      currentCostUsd: 0,
      optimalCostEth: 0,
      optimalCostUsd: 0,
      projectedSavingsUsd: 0,
      projectedSavingsPercent: 0,
      items: [],
    };
  }

  let totalGasUnits = 0;
  const items: OutboxGasItemAnalysis[] = [];

  for (const tx of queued) {
    const gasLimit = parseInt(tx.gasLimit, 10) || (tx.asset === "USDG" ? 65000 : 21000);
    totalGasUnits += gasLimit;

    const currentCostEth = (gasLimit * currentGwei) / 1e9;
    const currentCostUsd = currentCostEth * ethPriceUsd;

    const optimalCostEth = (gasLimit * optimalTargetGwei) / 1e9;
    const optimalCostUsd = optimalCostEth * ethPriceUsd;
    const savingsUsd = Math.max(0, currentCostUsd - optimalCostUsd);

    // Assess fee sanity
    let status: "fair" | "overpriced" | "underpriced" = "fair";
    if (tx.maxFeePerGas) {
      const txMaxGwei = Number(BigInt(tx.maxFeePerGas)) / 1e9;
      if (txMaxGwei > currentGwei * 2.5) {
        status = "overpriced";
      } else if (txMaxGwei < currentGwei * 0.7) {
        status = "underpriced";
      }
    }

    items.push({
      id: tx.id,
      recipient: tx.recipient,
      recipientLabel: tx.recipientLabel,
      asset: tx.asset,
      amount: tx.amount,
      gasLimit,
      currentCostUsd,
      optimalCostUsd,
      savingsUsd,
      status,
    });
  }

  const currentCostEth = (totalGasUnits * currentGwei) / 1e9;
  const currentCostUsd = currentCostEth * ethPriceUsd;

  const optimalCostEth = (totalGasUnits * optimalTargetGwei) / 1e9;
  const optimalCostUsd = optimalCostEth * ethPriceUsd;

  const projectedSavingsUsd = Math.max(0, currentCostUsd - optimalCostUsd);
  const projectedSavingsPercent =
    currentCostUsd > 0 ? Math.round((projectedSavingsUsd / currentCostUsd) * 100) : 0;

  return {
    queuedCount: queued.length,
    totalGasUnits,
    currentCostEth,
    currentCostUsd,
    optimalCostEth,
    optimalCostUsd,
    projectedSavingsUsd,
    projectedSavingsPercent,
    items,
  };
}

/**
 * Generates an end-to-end Gas Optimization Report for assistant proposal.
 */
export function generateGasOptimizationReport(
  context: GasSchedulerContext = {}
): GasOptimizationReport {
  const currentGwei = parseGasPriceGwei(context.gasPriceGwei);
  const ethPriceUsd = context.ethPriceUsd || DEFAULT_ETH_PRICE_USD;
  const hourUtc = context.currentHourUtc !== undefined ? context.currentHourUtc : new Date().getUTCHours();
  const outbox = context.offlineOutbox || [];

  const congestion = evaluateCongestionWindow(currentGwei, hourUtc);
  const outboxAnalysis = analyzeOutboxFees(
    outbox,
    currentGwei,
    congestion.optimalTargetGwei,
    ethPriceUsd
  );

  const advice: string[] = [];

  if (outboxAnalysis.queuedCount === 0) {
    advice.push("Outbox is clear. No pending transactions require fee optimization.");
  } else if (congestion.currentTier === "optimal") {
    advice.push(`Gas is currently optimal (${currentGwei.toFixed(2)} Gwei). Broadcast queued payments now to clear the outbox with minimal friction.`);
  } else {
    advice.push(
      `Holding broadcast until the ${congestion.bestWindowUtc} window (~${congestion.estimatedWaitHours}h wait) can save an estimated $${outboxAnalysis.projectedSavingsUsd.toFixed(2)} (${outboxAnalysis.projectedSavingsPercent}% reduction).`
    );
  }

  const overpricedCount = outboxAnalysis.items.filter((i) => i.status === "overpriced").length;
  if (overpricedCount > 0) {
    advice.push(`${overpricedCount} transaction(s) have generous max fee caps. Re-signing with lower caps will lower worst-case execution costs.`);
  }

  const underpricedCount = outboxAnalysis.items.filter((i) => i.status === "underpriced").length;
  if (underpricedCount > 0) {
    advice.push(`${underpricedCount} transaction(s) have tight fee caps below current market rates and may stall if broadcast immediately.`);
  }

  const summary = `Gas Market: ${currentGwei.toFixed(2)} Gwei (${congestion.currentTier.toUpperCase()}). ${
    outboxAnalysis.queuedCount > 0
      ? `Outbox has ${outboxAnalysis.queuedCount} item(s) totalling ~$${outboxAnalysis.currentCostUsd.toFixed(2)} in gas. Target rate: ${congestion.optimalTargetGwei.toFixed(2)} Gwei.`
      : "Outbox is clear."
  }`;

  return {
    currentGwei,
    congestion,
    outboxAnalysis,
    targetGweiThreshold: congestion.optimalTargetGwei,
    summary,
    actionableAdvice: advice,
    generatedAt: Date.now(),
  };
}
