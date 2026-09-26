import { findDestinationChain, type SupportedDestinationChain } from "./relay";

export type TreasuryAutomationAction = "bridge" | "rebalance" | "gas_reserve";

export interface TreasuryAutomationRequest {
  action: TreasuryAutomationAction;
  amount: string;
  isPercentage: boolean;
  asset: "USDG" | "ETH";
  destinationChain?: SupportedDestinationChain;
  minimumEthReserve?: number;
  maxFeePercent: number;
}

export interface TreasuryAutomationContext {
  usdgBalance: number;
  ethBalance: number;
  approvedChainIds?: number[];
  strictChainAllowlist?: boolean;
}

export interface TreasuryPlanStep {
  id: string;
  title: string;
  detail: string;
  status: "pass" | "warn" | "blocked";
}

export interface TreasuryAutomationPlan {
  request: TreasuryAutomationRequest;
  steps: TreasuryPlanStep[];
  amountNumber: number;
  estimatedFeePercent: number;
  canStage: boolean;
  summary: string;
}

export function parseTreasuryAutomationPrompt(input: string): TreasuryAutomationRequest | null {
  const lower = input.toLowerCase();
  if (!/(treasury|rebalance|idle|gas reserve|automation|automate)/i.test(lower)) return null;

  const chain = /optimism|op mainnet|\bop\b/i.test(lower)
    ? findDestinationChain(10)
    : /arbitrum|\barb\b/i.test(lower)
    ? findDestinationChain(42161)
    : /ethereum|mainnet/i.test(lower)
    ? findDestinationChain(1)
    : /base/i.test(lower)
    ? findDestinationChain(8453)
    : undefined;

  const reserveMatch = lower.match(/(?:keep|reserve|maintain)\s+([0-9]+(?:\.[0-9]+)?)\s*eth\s*(?:for)?\s*gas/);
  if (reserveMatch || /gas reserve|gas buffer/i.test(lower)) {
    return {
      action: "gas_reserve",
      amount: reserveMatch?.[1] || "0.03",
      isPercentage: false,
      asset: "ETH",
      maxFeePercent: 0.5,
      minimumEthReserve: Number(reserveMatch?.[1] || 0.03),
    };
  }

  const percent = lower.match(/([0-9]+(?:\.[0-9]+)?)\s*%\s*(?:of\s+(?:my\s+)?)?(?:idle\s+)?(usdg|eth)?/i);
  const absolute = lower.match(/(?:move|bridge|allocate|rebalance)\s+([0-9]+(?:\.[0-9]+)?)\s*(usdg|eth)?/i);
  const feeMatch = lower.match(/(?:fee|fees|cost)\s*(?:below|under|less than|<=)\s*([0-9]+(?:\.[0-9]+)?)\s*%/i);
  const asset = (percent?.[2] || absolute?.[2] || "USDG").toUpperCase() === "ETH" ? "ETH" : "USDG";
  const amount = percent?.[1] || absolute?.[1];
  if (!amount) return null;

  return {
    action: chain ? "bridge" : "rebalance",
    amount,
    isPercentage: Boolean(percent),
    asset,
    destinationChain: chain,
    maxFeePercent: Number(feeMatch?.[1] || 0.5),
  };
}

export function buildTreasuryAutomationPlan(
  request: TreasuryAutomationRequest,
  context: TreasuryAutomationContext
): TreasuryAutomationPlan {
  const available = request.asset === "ETH" ? context.ethBalance : context.usdgBalance;
  const amountNumber = request.action === "gas_reserve" ? 0 : request.isPercentage ? (available * Number(request.amount)) / 100 : Number(request.amount);
  const estimatedFeePercent = 0.35;
  const steps: TreasuryPlanStep[] = [];
  const reserve = request.minimumEthReserve || 0.00003;

  const balancePass = request.action === "gas_reserve" ? available >= (request.minimumEthReserve || 0.00003) : amountNumber > 0 && amountNumber <= available;
  steps.push({ id: "balance", title: "Balance pre-flight", detail: request.action === "gas_reserve" ? `${available.toFixed(4)} ETH available; target reserve is ${(request.minimumEthReserve || 0.00003).toFixed(4)} ETH.` : `${amountNumber.toFixed(4)} ${request.asset} planned from ${available.toFixed(4)} available.`, status: balancePass ? "pass" : "blocked" });
  if (request.asset === "ETH" && context.ethBalance - amountNumber < reserve) {
    steps.push({ id: "reserve", title: "Gas reserve protection", detail: `Plan would leave less than ${reserve} ETH for gas.`, status: "blocked" });
  } else {
    steps.push({ id: "reserve", title: "Gas reserve protection", detail: `Minimum ${reserve} ETH reserve remains protected.`, status: "pass" });
  }
  if (request.destinationChain) {
    const allowlisted = context.approvedChainIds?.includes(request.destinationChain.chainId) ?? true;
    steps.push({ id: "chain", title: "Destination policy", detail: `${request.destinationChain.name} is ${allowlisted ? "approved" : "not on the active chain allowlist"}.`, status: allowlisted || !context.strictChainAllowlist ? "pass" : "blocked" });
    steps.push({ id: "fees", title: "Fee ceiling", detail: `Estimated route cost is ${estimatedFeePercent.toFixed(2)}%; ceiling is ${request.maxFeePercent.toFixed(2)}%.`, status: estimatedFeePercent <= request.maxFeePercent ? "pass" : "warn" });
  }
  steps.push({ id: "review", title: "Human authorization", detail: "No funds move automatically. Review the complete plan before staging or signing.", status: "warn" });

  const canStage = steps.every((step) => step.status !== "blocked");
  const destination = request.destinationChain ? ` to ${request.destinationChain.name}` : "";
  return { request, steps, amountNumber, estimatedFeePercent, canStage, summary: `${request.action === "gas_reserve" ? "Protect" : "Plan"} ${amountNumber.toFixed(4)} ${request.asset}${destination} with a ${request.maxFeePercent.toFixed(2)}% fee ceiling.` };
}
