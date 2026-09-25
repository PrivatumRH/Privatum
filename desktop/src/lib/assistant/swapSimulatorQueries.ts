/**
 * Local Natural Language DEX Swap & Treasury Rebalance Simulator for PRIVATUM Assistant.
 *
 * Resolves conversational inquiries and simulations for:
 * 1. Decentralized exchange token swaps and rates.
 * 2. Slippage protection and minimum guaranteed token output.
 * 3. Pre-flight asset balance diff projections (Token In, Token Out, ETH Gas).
 * 4. Treasury rebalance calculations across USDG, ETH, PRIV, and RWA equities.
 *
 * 100% client-side deterministic evaluation with zero external analytics tracking.
 */

import {
  parseSwapSimulationPrompt,
  simulateSwapExecution,
  type SwapSimulatorContext,
  type SwapSimulationResult,
} from "../swapSimulator";
import type { ParsedSwapSimulationIntent } from "./types";

export interface SwapSimulationQueryResult {
  handled: true;
  summary: string;
  details: string[];
  simulation: SwapSimulationResult;
  intent: ParsedSwapSimulationIntent;
}

/**
 * Checks if input represents a swap or treasury rebalance simulation query.
 */
export function evaluateSwapSimulationQuery(
  input: string,
  context: SwapSimulatorContext = {}
): SwapSimulationQueryResult | null {
  const params = parseSwapSimulationPrompt(input, context);
  if (!params) {
    return null;
  }

  const simulation = simulateSwapExecution(params, context);

  const details: string[] = [
    `Route: ${simulation.amountInNumber.toLocaleString()} ${simulation.tokenIn.symbol} -> ~${simulation.estimatedAmountOut} ${simulation.tokenOut.symbol}`,
    `Effective Rate: 1 ${simulation.tokenIn.symbol} = ${simulation.effectiveRate.toFixed(6)} ${simulation.tokenOut.symbol}`,
    `Minimum Received (${simulation.slippageTolerancePercent}% slippage): ${simulation.minimumAmountOut} ${simulation.tokenOut.symbol}`,
    `Estimated Price Impact: ${simulation.priceImpactPercent}%`,
    `Projected Network Gas: ~${simulation.estimatedGasEth} ETH`,
    `Balance Diff [${simulation.tokenIn.symbol}]: ${simulation.balanceDiff.tokenIn.formattedInitial} -> ${simulation.balanceDiff.tokenIn.formattedProjected} (${simulation.balanceDiff.tokenIn.formattedChange})`,
    `Balance Diff [${simulation.tokenOut.symbol}]: ${simulation.balanceDiff.tokenOut.formattedInitial} -> ${simulation.balanceDiff.tokenOut.formattedProjected} (${simulation.balanceDiff.tokenOut.formattedChange})`,
  ];

  if (simulation.warnings.length > 0) {
    details.push(...simulation.warnings);
  }

  if (simulation.canExecute) {
    details.push("Pre-flight status: Validated and ready for execution.");
  } else {
    details.push("Pre-flight status: Execution blocked due to balance constraints.");
  }

  return {
    handled: true,
    summary: simulation.summary,
    details,
    simulation,
    intent: {
      type: "swap_simulation",
      simulation,
    },
  };
}
