/**
 * Conversational DEX Swap & Treasury Rebalance Simulator Engine for PRIVATUM.
 *
 * Simulates decentralized exchange swaps, price impact, slippage thresholds,
 * and pre-flight balance diffs directly from natural language prompts before
 * committing to signature or execution on Robinhood Chain.
 *
 * 100% client-side deterministic evaluation with zero external analytics tracking.
 */

import { TOKENS, type TokenInfo } from "./tokens";

export interface SwapSimulationParams {
  tokenInSymbol: string;
  tokenOutSymbol: string;
  amountIn: string;
  slippagePercent?: number;
  currentBalances?: Record<string, number | string>;
  ethPriceUsd?: number;
  isRebalance?: boolean;
}

export interface TokenBalanceDiff {
  symbol: string;
  initial: number;
  change: number;
  projected: number;
  formattedInitial: string;
  formattedChange: string;
  formattedProjected: string;
}

export interface SwapSimulationResult {
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  amountIn: string;
  amountInNumber: number;
  amountInUsd: number;
  estimatedAmountOut: string;
  minimumAmountOut: string;
  effectiveRate: number;
  priceImpactPercent: number;
  slippageTolerancePercent: number;
  estimatedGasEth: string;
  isRebalance: boolean;
  balanceDiff: {
    tokenIn: TokenBalanceDiff;
    tokenOut: TokenBalanceDiff;
    ethGas: TokenBalanceDiff;
  };
  warnings: string[];
  canExecute: boolean;
  summary: string;
}

export interface SwapSimulatorContext {
  usdgBalance?: string | number;
  ethBalance?: string | number;
  ethPriceUsd?: number;
  tokenBalances?: Record<string, string | number>;
}

const DEFAULT_ETH_PRICE_USD = 2800;

// Benchmark baseline prices in USDG for simulated pool liquidity
const BENCHMARK_PRICES_USDG: Record<string, number> = {
  USDG: 1.0,
  ETH: 2800.0,
  WETH: 2800.0,
  PRIV: 1.25,
  AAPL: 230.0,
  TSLA: 245.0,
  NVDA: 125.0,
  GOOGL: 175.0,
  MSFT: 420.0,
  COIN: 215.0,
};

/**
 * Finds a token by symbol or common aliases (case-insensitive).
 */
export function findTokenBySymbol(sym: string): TokenInfo | undefined {
  const clean = sym.trim().toUpperCase();
  if (clean === "DOLLAR" || clean === "USD" || clean === "USDC") {
    return TOKENS.find((t) => t.symbol === "USDG");
  }
  if (clean === "ETHER") {
    return TOKENS.find((t) => t.symbol === "ETH");
  }
  return TOKENS.find((t) => t.symbol === clean);
}

/**
 * Parses natural language swap and rebalance prompts into structured simulation parameters.
 */
export function parseSwapSimulationPrompt(
  input: string,
  context: SwapSimulatorContext = {}
): SwapSimulationParams | null {
  const clean = input.trim();
  const lower = clean.toLowerCase();

  // Must have a swap/convert/rebalance verb or simulation keyword
  const hasSwapVerb = /\b(?:swap|swapping|convert|converting|exchange|trade|trading|rebalance|rebalancing|simulate)\b/i.test(lower);
  if (!hasSwapVerb) {
    return null;
  }

  const isRebalancePrompt = /\brebalance/i.test(clean);

  // 1. Extract slippage if present (e.g., "with 1% slippage" or "0.5% slippage")
  let slippagePercent = 0.5;
  const slippageMatch = lower.match(/(\d+(?:\.\d+)?)\s*%\s*slippage/i);
  if (slippageMatch) {
    const val = parseFloat(slippageMatch[1]);
    if (!isNaN(val) && val > 0 && val <= 50) {
      slippagePercent = val;
    }
  }

  // 2. Extract percentage-based rebalance: e.g. "convert 20% of my USDG to ETH" or "rebalance 30% of USDG into ETH"
  const percentMatch = clean.match(
    /(?:convert|swap|rebalance|trade)\s+(\d+(?:\.\d+)?)\s*%\s*(?:of\s+)?(?:my\s+)?([A-Za-z]+)\s+(?:to|into|for)\s+([A-Za-z]+)/i
  );
  if (percentMatch) {
    const pct = parseFloat(percentMatch[1]);
    const symIn = percentMatch[2].toUpperCase();
    const symOut = percentMatch[3].toUpperCase();

    const tIn = findTokenBySymbol(symIn);
    const tOut = findTokenBySymbol(symOut);

    if (tIn && tOut && tIn.symbol !== tOut.symbol) {
      let balanceVal = 0;
      if (symIn === "USDG") {
        balanceVal = Number(context.usdgBalance || 0);
      } else if (symIn === "ETH") {
        balanceVal = Number(context.ethBalance || 0);
      } else if (context.tokenBalances && context.tokenBalances[symIn]) {
        balanceVal = Number(context.tokenBalances[symIn]);
      }

      const calculatedAmount = (balanceVal * (pct / 100)).toFixed(4);
      return {
        tokenInSymbol: tIn.symbol,
        tokenOutSymbol: tOut.symbol,
        amountIn: parseFloat(calculatedAmount) > 0 ? calculatedAmount : "100",
        slippagePercent,
        isRebalance: true,
      };
    }
  }

  // 3. Extract standard swap patterns:
  // e.g. "simulate swapping 500 USDG for ETH"
  // e.g. "simulate swap 2 ETH to USDG"
  // e.g. "swap 100 USDG to AAPL"
  // e.g. "rebalance 100 USDG to PRIV"
  const standardMatch = clean.match(
    /(?:(?:simulate|test|preview)\s+(?:a\s+)?)?(?:swapping|swap|convert|exchange|trade|rebalance)\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*([A-Za-z]+)\s+(?:for|to|into)\s+([A-Za-z]+)/i
  );
  if (standardMatch) {
    const amt = standardMatch[1];
    const symIn = standardMatch[2].toUpperCase();
    const symOut = standardMatch[3].toUpperCase();

    const tIn = findTokenBySymbol(symIn);
    const tOut = findTokenBySymbol(symOut);

    if (tIn && tOut && tIn.symbol !== tOut.symbol) {
      return {
        tokenInSymbol: tIn.symbol,
        tokenOutSymbol: tOut.symbol,
        amountIn: amt,
        slippagePercent,
        isRebalance: isRebalancePrompt,
      };
    }
  }

  // 4. Pattern: "swap from USDG to ETH amount 500" or "swap USDG for ETH: 500"
  const altMatch = clean.match(
    /(?:swap|convert)\s+(?:from\s+)?([A-Za-z]+)\s+(?:to|for|into)\s+([A-Za-z]+)(?:[\s:,]+(?:amount\s+)?(\d+(?:\.\d+)?))?/i
  );
  if (altMatch && altMatch[3]) {
    const symIn = altMatch[1].toUpperCase();
    const symOut = altMatch[2].toUpperCase();
    const amt = altMatch[3];

    const tIn = findTokenBySymbol(symIn);
    const tOut = findTokenBySymbol(symOut);

    if (tIn && tOut && tIn.symbol !== tOut.symbol) {
      return {
        tokenInSymbol: tIn.symbol,
        tokenOutSymbol: tOut.symbol,
        amountIn: amt,
        slippagePercent,
        isRebalance: isRebalancePrompt,
      };
    }
  }

  return null;
}

/**
 * Calculates estimated price impact based on swap size relative to typical local DEX liquidity.
 */
function calculatePriceImpact(amountInUsd: number): number {
  if (amountInUsd <= 500) return 0.05;
  if (amountInUsd <= 2000) return 0.15;
  if (amountInUsd <= 10000) return 0.45;
  if (amountInUsd <= 50000) return 1.25;
  return 2.85;
}

/**
 * Simulates a DEX swap, computing pre-flight balance diffs, minimum received, and slippage.
 */
export function simulateSwapExecution(
  params: SwapSimulationParams,
  context: SwapSimulatorContext = {}
): SwapSimulationResult {
  const tokenIn = findTokenBySymbol(params.tokenInSymbol) || TOKENS[1]; // default USDG
  const tokenOut = findTokenBySymbol(params.tokenOutSymbol) || TOKENS[2]; // default ETH
  const slippageTolerancePercent = params.slippagePercent !== undefined ? params.slippagePercent : 0.5;

  const amountInNumber = Math.max(0, parseFloat(params.amountIn) || 0);

  // Determine current asset balance
  let initialBalanceIn = 0;
  if (tokenIn.symbol === "USDG") {
    initialBalanceIn = Number(context.usdgBalance || 0);
  } else if (tokenIn.symbol === "ETH") {
    initialBalanceIn = Number(context.ethBalance || 0);
  } else if (context.tokenBalances && context.tokenBalances[tokenIn.symbol]) {
    initialBalanceIn = Number(context.tokenBalances[tokenIn.symbol]);
  }

  // Determine current target asset balance
  let initialBalanceOut = 0;
  if (tokenOut.symbol === "USDG") {
    initialBalanceOut = Number(context.usdgBalance || 0);
  } else if (tokenOut.symbol === "ETH") {
    initialBalanceOut = Number(context.ethBalance || 0);
  } else if (context.tokenBalances && context.tokenBalances[tokenOut.symbol]) {
    initialBalanceOut = Number(context.tokenBalances[tokenOut.symbol]);
  }

  const initialEthBalance = Number(context.ethBalance || 0);

  // Price modeling in USDG
  const ethPrice = context.ethPriceUsd || DEFAULT_ETH_PRICE_USD;
  const priceInUsdg = tokenIn.symbol === "ETH" ? ethPrice : BENCHMARK_PRICES_USDG[tokenIn.symbol] || 1.0;
  const priceOutUsdg = tokenOut.symbol === "ETH" ? ethPrice : BENCHMARK_PRICES_USDG[tokenOut.symbol] || 1.0;

  const amountInUsd = amountInNumber * priceInUsdg;
  const effectiveRate = priceInUsdg / priceOutUsdg;

  const estimatedAmountOutNum = amountInNumber * effectiveRate;
  const minimumAmountOutNum = estimatedAmountOutNum * (1 - slippageTolerancePercent / 100);

  const priceImpactPercent = calculatePriceImpact(amountInUsd);
  const estimatedGasEthNum = 0.00015; // Typical Uniswap V3 swap gas on Robinhood Chain

  // Compute balance diffs
  const projectedBalanceIn = Math.max(0, initialBalanceIn - amountInNumber);
  const projectedBalanceOut = initialBalanceOut + estimatedAmountOutNum;

  let projectedEth = initialEthBalance;
  if (tokenIn.symbol === "ETH") {
    projectedEth = Math.max(0, initialEthBalance - amountInNumber - estimatedGasEthNum);
  } else if (tokenOut.symbol === "ETH") {
    projectedEth = initialEthBalance - estimatedGasEthNum + estimatedAmountOutNum;
  } else {
    projectedEth = Math.max(0, initialEthBalance - estimatedGasEthNum);
  }

  const warnings: string[] = [];

  if (amountInNumber > initialBalanceIn && initialBalanceIn > 0) {
    warnings.push(
      `Insufficient ${tokenIn.symbol}: Swap requires ${amountInNumber.toLocaleString()} ${tokenIn.symbol}, but available balance is ${initialBalanceIn.toLocaleString()} ${tokenIn.symbol}.`
    );
  }

  if (initialEthBalance < estimatedGasEthNum && tokenIn.symbol !== "ETH") {
    warnings.push("Low ETH reserve: Available ETH may not cover swap contract execution gas.");
  }

  if (priceImpactPercent >= 1.0) {
    warnings.push(
      `High price impact warning: Swap size causes an estimated ${priceImpactPercent}% price impact in pool liquidity.`
    );
  }

  if (tokenOut.isRwa) {
    warnings.push(
      `RWA asset notice: ${tokenOut.name} trading hours and redemptions follow standard equity market schedules.`
    );
  }

  const canExecute = warnings.filter((w) => w.startsWith("Insufficient")).length === 0;

  const tokenInDecimals = tokenIn.decimals === 6 ? 2 : 4;
  const tokenOutDecimals = tokenOut.decimals === 6 ? 2 : 4;

  const balanceDiff = {
    tokenIn: {
      symbol: tokenIn.symbol,
      initial: initialBalanceIn,
      change: -amountInNumber,
      projected: projectedBalanceIn,
      formattedInitial: initialBalanceIn.toFixed(tokenInDecimals),
      formattedChange: `-${amountInNumber.toFixed(tokenInDecimals)}`,
      formattedProjected: projectedBalanceIn.toFixed(tokenInDecimals),
    },
    tokenOut: {
      symbol: tokenOut.symbol,
      initial: initialBalanceOut,
      change: estimatedAmountOutNum,
      projected: projectedBalanceOut,
      formattedInitial: initialBalanceOut.toFixed(tokenOutDecimals),
      formattedChange: `+${estimatedAmountOutNum.toFixed(tokenOutDecimals)}`,
      formattedProjected: projectedBalanceOut.toFixed(tokenOutDecimals),
    },
    ethGas: {
      symbol: "ETH",
      initial: initialEthBalance,
      change: -estimatedGasEthNum,
      projected: projectedEth,
      formattedInitial: initialEthBalance.toFixed(5),
      formattedChange: `-${estimatedGasEthNum.toFixed(5)}`,
      formattedProjected: projectedEth.toFixed(5),
    },
  };

  const isRebalance = !!params.isRebalance;
  const prefix = isRebalance ? "Pre-Flight Treasury Rebalance Simulation" : "Pre-Flight Swap Simulation";
  const summary = `${prefix}: ${amountInNumber.toLocaleString()} ${tokenIn.symbol} for ~${estimatedAmountOutNum.toFixed(tokenOutDecimals)} ${tokenOut.symbol} (Rate: 1 ${tokenIn.symbol} = ${effectiveRate.toFixed(6)} ${tokenOut.symbol}, Min: ${minimumAmountOutNum.toFixed(tokenOutDecimals)} ${tokenOut.symbol}).`;

  return {
    tokenIn,
    tokenOut,
    amountIn: params.amountIn,
    amountInNumber,
    amountInUsd,
    estimatedAmountOut: estimatedAmountOutNum.toFixed(tokenOutDecimals),
    minimumAmountOut: minimumAmountOutNum.toFixed(tokenOutDecimals),
    effectiveRate,
    priceImpactPercent,
    slippageTolerancePercent,
    estimatedGasEth: estimatedGasEthNum.toFixed(5),
    isRebalance,
    balanceDiff,
    warnings,
    canExecute,
    summary,
  };
}
