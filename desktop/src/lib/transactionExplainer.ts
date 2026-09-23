export interface TransactionExplanation {
  operation: string;
  executionPath: string;
  movements: string[];
  checks: string[];
  warning?: string;
}

export function explainTransfer(params: {
  asset: "ETH" | "USDG";
  amount: string;
  recipient: string;
  isStealthSend: boolean;
  simulationStatus?: "success" | "warning";
  gasLimit?: bigint;
  gasPriceGwei?: string;
}): TransactionExplanation {
  const { asset, amount, recipient, isStealthSend, simulationStatus, gasLimit, gasPriceGwei } = params;
  const movements = asset === "ETH"
    ? [`Send ${amount || "0"} ETH to ${recipient || "the entered recipient"}`]
    : [`Call USDG.transfer(${recipient || "recipient"}, ${amount || "0"} USDG)`];
  const checks = [
    simulationStatus === "success" ? "RPC simulation completed without a revert" : "Fallback estimate used; simulation needs review",
    "2-of-3 threshold authorization required",
    isStealthSend ? "ERC-5564 one-time destination and announcer call" : "Direct recipient address visible on-chain",
  ];
  return {
    operation: isStealthSend ? "Private threshold transfer" : "Threshold transfer",
    executionPath: isStealthSend ? "Build stealth destination → transfer → announce → co-sign → settle" : "Build transfer → co-sign → settle through ERC-4337",
    movements,
    checks,
    warning: simulationStatus === "warning" ? `The estimate uses approximately ${gasLimit?.toString() || "unknown"} gas at ${gasPriceGwei || "current"} Gwei; review before signing.` : undefined,
  };
}
