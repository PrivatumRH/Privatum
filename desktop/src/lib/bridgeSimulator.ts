/**
 * Cross-Chain Bridge & Fee Simulation Engine for PRIVATUM.
 *
 * Deterministically parses conversational bridge inquiries, models Relay solver
 * route quotes, estimates destination payouts across expanded Base / L2 asset
 * registries, and projects pre-flight balance diffs with zero remote telemetry.
 */

import {
  DESTINATION_CHAINS,
  findDestinationChain,
  findDestinationToken,
  type SupportedDestinationChain,
  type DestinationTokenInfo,
} from "./relay";
import { TOKENS, type TokenInfo, findToken } from "./tokens";

export interface BridgeSimulationParams {
  amount: string;
  amountNumber: number;
  originToken: TokenInfo;
  destinationChain: SupportedDestinationChain;
  destinationToken: DestinationTokenInfo;
  isPercentage: boolean;
  percentageValue?: number;
  recipient?: string;
}

export interface BridgeSimulationContext {
  walletAddress?: string;
  portfolio?: {
    usdgBalance?: string;
    ethBalance?: string;
    ethPrice?: number;
  };
  tokenBalances?: Record<string, string | number>;
}

export interface BridgeFeeBreakdown {
  relayerFeeUsd: number;
  relayerFeeFormatted: string;
  destinationGasUsd: number;
  destinationGasFormatted: string;
  totalFeeUsd: number;
  totalFeeFormatted: string;
}

export interface BridgeSimulationResult {
  params: BridgeSimulationParams;
  amountIn: string;
  amountInNumber: number;
  amountInUsd: number;
  tokenIn: TokenInfo;
  destinationChain: SupportedDestinationChain;
  tokenOut: DestinationTokenInfo;
  estimatedAmountOut: string;
  estimatedAmountOutNumber: number;
  estimatedAmountOutUsd: number;
  effectiveRate: string;
  fees: BridgeFeeBreakdown;
  estimatedTime: string;
  canExecute: boolean;
  insufficientBalance: boolean;
  availableBalance: number;
  balanceDiff: {
    originBefore: number;
    originAfter: number;
    destinationIncrease: number;
  };
  warnings: string[];
  summary: string;
}

/** Reference benchmark USD prices for cross-chain routing. */
export const BRIDGE_BENCHMARK_PRICES_USD: Record<string, number> = {
  USDG: 1.0,
  USDC: 1.0,
  USDT: 1.0,
  USDbC: 1.0,
  EURC: 1.08,
  ETH: 2800.0,
  cbBTC: 65000.0,
  WBTC: 65000.0,
  OP: 1.65,
  ARB: 0.60,
  AERO: 0.85,
  PRIV: 1.25,
};

/**
 * Parses conversational cross-chain bridge inquiries.
 */
export function parseBridgeSimulationPrompt(
  input: string,
  context: BridgeSimulationContext = {}
): BridgeSimulationParams | null {
  const clean = input.trim();
  const lower = clean.toLowerCase();

  // Must contain bridging or cross-chain keywords
  const isBridgeQuery =
    /\b(?:bridge|bridging|cross-chain|cross\s+chain|relay|transfer\s+to\s+(?:base|optimism|op|ethereum|arbitrum)|send\s+to\s+(?:base|optimism|op|ethereum|arbitrum))\b/i.test(
      lower
    );

  if (!isBridgeQuery) {
    return null;
  }

  // 1. Detect Destination Chain
  let targetChain: SupportedDestinationChain | undefined;
  if (/\b(?:base|basescan)\b/i.test(lower)) {
    targetChain = findDestinationChain(8453);
  } else if (/\b(?:optimism|op\s+mainnet|\bop\b)\b/i.test(lower)) {
    targetChain = findDestinationChain(10);
  } else if (/\b(?:arbitrum|arb|arbiscan)\b/i.test(lower)) {
    targetChain = findDestinationChain(42161);
  } else if (/\b(?:ethereum|mainnet|eth\s+mainnet|l1)\b/i.test(lower)) {
    targetChain = findDestinationChain(1);
  } else {
    // Default destination is Base
    targetChain = findDestinationChain(8453);
  }

  if (!targetChain) {
    return null;
  }

  // 2. Detect Destination Token (if specified e.g. "as cbBTC", "to cbBTC", "into USDC")
  let targetToken: DestinationTokenInfo | undefined;
  const tokenMatch = lower.match(
    /\b(?:as|to|into|for)\s+(cbbtc|eurc|usdbc|aero|usdc|eth|op|arb|wbtc|usdt)\b/i
  );
  if (tokenMatch) {
    targetToken = findDestinationToken(targetChain.chainId, tokenMatch[1]);
  }

  // 3. Extract Amount & Origin Token
  let amountStr = "100";
  let isPercentage = false;
  let percentageValue: number | undefined;
  let originSymbol = "USDG";

  // Check percentage: "bridge 20% of my USDG to Base"
  const percentMatch = lower.match(/(\d+(?:\.\d+)?)\s*%\s*(?:of\s+my\s+)?([a-z]+)?/i);
  if (percentMatch) {
    isPercentage = true;
    percentageValue = parseFloat(percentMatch[1]);
    if (percentMatch[2]) {
      originSymbol = percentMatch[2].toUpperCase();
    }
  } else {
    // Standard amount match: "bridge 500 USDG to Base" or "simulate bridging 1.5 ETH to Optimism"
    const standardMatch = lower.match(
      /\b(?:bridge|bridging|send|transfer)\s+(\d+(?:\.\d+)?)\s*([a-z]+)?/i
    );
    if (standardMatch) {
      amountStr = standardMatch[1];
      if (standardMatch[2]) {
        const candidate = standardMatch[2].toUpperCase();
        if (candidate !== "TO" && candidate !== "ACROSS") {
          originSymbol = candidate;
        }
      }
    }
  }

  // Fallback for "how much USDC on Base for 250 USDG"
  const alternateMatch = lower.match(
    /\bfor\s+(\d+(?:\.\d+)?)\s*([a-z]+)\b/i
  );
  if (alternateMatch && !percentMatch) {
    amountStr = alternateMatch[1];
    originSymbol = alternateMatch[2].toUpperCase();
  }

  // Resolve origin token
  if (originSymbol === "USD" || originSymbol === "USDC") originSymbol = "USDG";
  if (originSymbol === "ETHER") originSymbol = "ETH";
  const originToken = findToken(originSymbol) || findToken("USDG") || TOKENS[0];

  // If destination token was not explicitly specified, map sensibly from origin
  if (!targetToken) {
    if (originToken.native || originToken.symbol === "ETH") {
      targetToken = findDestinationToken(targetChain.chainId, "ETH");
    } else {
      targetToken = findDestinationToken(targetChain.chainId, "USDC");
    }
  }

  if (!targetToken) {
    targetToken = targetChain.tokens[0];
  }

  // Compute effective numeric amount
  let numericAmount = parseFloat(amountStr) || 0;
  if (isPercentage && percentageValue !== undefined) {
    let baseBal = 0;
    if (originToken.symbol === "USDG") {
      baseBal = parseFloat(context.portfolio?.usdgBalance || "0");
    } else if (originToken.symbol === "ETH") {
      baseBal = parseFloat(context.portfolio?.ethBalance || "0");
    } else if (context.tokenBalances && context.tokenBalances[originToken.symbol] !== undefined) {
      baseBal = parseFloat(String(context.tokenBalances[originToken.symbol]));
    }
    numericAmount = Math.round(((baseBal * percentageValue) / 100) * 10000) / 10000;
    amountStr = numericAmount > 0 ? numericAmount.toString() : "0";
  }

  return {
    amount: amountStr,
    amountNumber: numericAmount,
    originToken,
    destinationChain: targetChain,
    destinationToken: targetToken,
    isPercentage,
    percentageValue,
    recipient: context.walletAddress,
  };
}

/**
 * Simulates cross-chain bridge execution and calculates fee breakdowns.
 */
export function simulateBridgeExecution(
  params: BridgeSimulationParams,
  context: BridgeSimulationContext = {}
): BridgeSimulationResult {
  const originPrice =
    BRIDGE_BENCHMARK_PRICES_USD[params.originToken.symbol] ??
    (params.originToken.symbol === "ETH" ? context.portfolio?.ethPrice ?? 2800 : 1.0);

  const destPrice =
    BRIDGE_BENCHMARK_PRICES_USD[params.destinationToken.symbol] ?? 1.0;

  const amountInNumber = params.amountNumber;
  const amountInUsd = Math.round(amountInNumber * originPrice * 100) / 100;

  // 1. Fee Calculations (Relay Solver Model)
  const isL1 = params.destinationChain.chainId === 1;
  const relayerRate = 0.001; // 0.10%
  const relayerFeeUsd = Math.max(0.15, Math.round(amountInUsd * relayerRate * 100) / 100);
  const destinationGasUsd = isL1 ? 3.25 : 0.12;
  const totalFeeUsd = Math.round((relayerFeeUsd + destinationGasUsd) * 100) / 100;

  // 2. Net Output Calculation
  const netValueUsd = Math.max(0, amountInUsd - totalFeeUsd);
  const rawDestAmount = destPrice > 0 ? netValueUsd / destPrice : 0;
  const decimals = params.destinationToken.decimals;
  const precision = decimals <= 6 ? 4 : 6;
  const estimatedAmountOutNumber =
    Math.round(rawDestAmount * Math.pow(10, precision)) / Math.pow(10, precision);
  const estimatedAmountOutUsd = Math.round(estimatedAmountOutNumber * destPrice * 100) / 100;

  const rateNum = destPrice > 0 ? originPrice / destPrice : 1;
  const effectiveRate = `1 ${params.originToken.symbol} = ${rateNum < 0.001 ? rateNum.toFixed(6) : rateNum.toFixed(4)} ${params.destinationToken.symbol}`;

  // 3. Balance Checks
  let availableBalance = 0;
  if (params.originToken.symbol === "USDG") {
    availableBalance = parseFloat(context.portfolio?.usdgBalance || "0");
  } else if (params.originToken.symbol === "ETH") {
    availableBalance = parseFloat(context.portfolio?.ethBalance || "0");
  } else if (context.tokenBalances && context.tokenBalances[params.originToken.symbol] !== undefined) {
    availableBalance = parseFloat(String(context.tokenBalances[params.originToken.symbol]));
  }

  const insufficientBalance = availableBalance > 0 && amountInNumber > availableBalance;
  const canExecute = amountInNumber > 0 && !insufficientBalance;

  // 4. Warnings & Guidance
  const warnings: string[] = [];

  if (insufficientBalance) {
    warnings.push(
      `Insufficient ${params.originToken.symbol} balance: Available ${availableBalance} ${params.originToken.symbol}, Required ${amountInNumber} ${params.originToken.symbol}.`
    );
  }

  if (isL1) {
    warnings.push(
      "Settlement on Ethereum Mainnet (L1) incurs higher data availability and execution fees than Layer 2 destinations."
    );
  }

  if (params.destinationToken.symbol === "cbBTC") {
    warnings.push(
      "Destination asset is Coinbase Wrapped BTC (cbBTC) on Base (8 decimals)."
    );
  }

  if (amountInUsd > 10000) {
    warnings.push(
      "Large bridge transfer: Verify destination recipient address and liquidity depth on destination solver."
    );
  }

  const estimatedTime = isL1 ? "~1 - 2 minutes" : "~20 - 30 seconds";

  const summary = `Pre-Flight Bridge Simulation: ${params.amount} ${params.originToken.symbol} -> ~${estimatedAmountOutNumber} ${params.destinationToken.symbol} on ${params.destinationChain.name} (Fee: ~$${totalFeeUsd.toFixed(2)}, Est. Delivery: ${estimatedTime}).`;

  return {
    params,
    amountIn: params.amount,
    amountInNumber,
    amountInUsd,
    tokenIn: params.originToken,
    destinationChain: params.destinationChain,
    tokenOut: params.destinationToken,
    estimatedAmountOut: estimatedAmountOutNumber.toString(),
    estimatedAmountOutNumber,
    estimatedAmountOutUsd,
    effectiveRate,
    fees: {
      relayerFeeUsd,
      relayerFeeFormatted: `$${relayerFeeUsd.toFixed(2)}`,
      destinationGasUsd,
      destinationGasFormatted: `$${destinationGasUsd.toFixed(2)}`,
      totalFeeUsd,
      totalFeeFormatted: `$${totalFeeUsd.toFixed(2)}`,
    },
    estimatedTime,
    canExecute,
    insufficientBalance,
    availableBalance,
    balanceDiff: {
      originBefore: availableBalance,
      originAfter: Math.max(0, Math.round((availableBalance - amountInNumber) * 10000) / 10000),
      destinationIncrease: estimatedAmountOutNumber,
    },
    warnings,
    summary,
  };
}
