/**
 * Local Natural Language Cross-Chain Bridge & Fee Simulation for PRIVATUM Assistant.
 *
 * Resolves conversational inquiries regarding:
 * 1. Cross-chain bridging between Robinhood Chain and Base, Optimism, Ethereum, and Arbitrum.
 * 2. Relay solver fee estimations and delivery time predictions.
 * 3. Pre-flight balance checks and output estimation for expanded Base assets (e.g. cbBTC, EURC, USDbC, AERO).
 *
 * 100% client-side deterministic evaluation with zero external analytics tracking.
 */

import {
  parseBridgeSimulationPrompt,
  simulateBridgeExecution,
  type BridgeSimulationContext,
  type BridgeSimulationResult,
} from "../bridgeSimulator";
import type { ParsedBridgeSimulationIntent } from "./types";

export interface BridgeSimulationQueryResult {
  handled: true;
  summary: string;
  details: string[];
  simulation: BridgeSimulationResult;
  intent: ParsedBridgeSimulationIntent;
}

/**
 * Evaluates a conversational cross-chain bridge simulation inquiry.
 */
export function evaluateBridgeSimulationQuery(
  input: string,
  context: BridgeSimulationContext = {}
): BridgeSimulationQueryResult | null {
  const parsed = parseBridgeSimulationPrompt(input, context);
  if (!parsed) {
    return null;
  }

  const sim = simulateBridgeExecution(parsed, context);

  const details: string[] = [
    `Route: Robinhood Chain (4663) -> ${sim.destinationChain.name} (${sim.destinationChain.chainId})`,
    `Input Asset: ${sim.amountIn} ${sim.tokenIn.symbol} (~$${sim.amountInUsd.toFixed(2)})`,
    `Estimated Output: ~${sim.estimatedAmountOut} ${sim.tokenOut.symbol} (~$${sim.estimatedAmountOutUsd.toFixed(2)})`,
    `Effective Rate: ${sim.effectiveRate}`,
    `Relay Solver Fee: ${sim.fees.totalFeeFormatted} (Relayer: ${sim.fees.relayerFeeFormatted}, Gas: ${sim.fees.destinationGasFormatted})`,
    `Estimated Delivery: ${sim.estimatedTime}`,
  ];

  if (sim.warnings.length > 0) {
    details.push(...sim.warnings);
  }

  return {
    handled: true,
    summary: sim.summary,
    details,
    simulation: sim,
    intent: {
      type: "bridge_simulation",
      simulation: sim,
    },
  };
}
