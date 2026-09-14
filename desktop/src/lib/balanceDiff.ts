/**
 * Pre-Flight Asset & Balance Diff Preview Engine for PRIVATUM Desktop.
 *
 * Deterministically projects asset balances, gas deductions, and total transaction
 * outlay prior to threshold signature execution on Robinhood Chain.
 *
 * 100% client-side: operates exclusively in memory over live state with zero external queries.
 */

export interface ComputeBalanceDiffParams {
  asset: "USDG" | "ETH";
  sendAmount: string;
  usdgBalance: string;
  ethBalance: string;
  estimatedFeeEth?: string;
  isGaslessActive?: boolean;
  ethPrice?: number;
}

export interface BalanceDiffResult {
  asset: "USDG" | "ETH";
  initialAssetBalance: number;
  sendAmount: number;
  projectedAssetBalance: number;
  formattedInitialAsset: string;
  formattedSendAmount: string;
  formattedProjectedAsset: string;

  initialEthBalance: number;
  gasFeeEth: number;
  projectedEthBalance: number;
  formattedInitialEth: string;
  formattedGasFeeEth: string;
  formattedProjectedEth: string;

  isGasless: boolean;
  totalOutlayUsd: number;
  formattedTotalOutlayUsd: string;

  hasInsufficientAsset: boolean;
  hasInsufficientGas: boolean;
  isLowEthReserve: boolean;
}

/**
 * Formats a number cleanly with minimum and maximum fraction digits.
 */
export function formatPrecision(val: number, maxDecimals = 6, minDecimals = 2): string {
  if (isNaN(val)) return "0.00";
  return val.toLocaleString("en-US", {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  });
}

/**
 * Computes deterministic balance impact before transaction dispatch.
 */
export function computeBalanceDiff(params: ComputeBalanceDiffParams): BalanceDiffResult {
  const {
    asset,
    sendAmount,
    usdgBalance,
    ethBalance,
    estimatedFeeEth = "0.000021",
    isGaslessActive = false,
    ethPrice = 0,
  } = params;

  const parsedSend = Math.max(0, parseFloat(sendAmount) || 0);
  const parsedUsdg = Math.max(0, parseFloat(usdgBalance) || 0);
  const parsedEth = Math.max(0, parseFloat(ethBalance) || 0);
  const parsedGasFee = isGaslessActive ? 0 : Math.max(0, parseFloat(estimatedFeeEth) || 0);

  const initialAssetBalance = asset === "USDG" ? parsedUsdg : parsedEth;
  let projectedAssetBalance = initialAssetBalance - parsedSend;
  let projectedEthBalance = parsedEth;

  if (asset === "USDG") {
    projectedEthBalance = parsedEth - parsedGasFee;
  } else {
    // If sending ETH, both the transfer and gas fee reduce the native ETH balance
    projectedEthBalance = parsedEth - parsedSend - parsedGasFee;
    projectedAssetBalance = projectedEthBalance;
  }

  // Round to avoid floating point precision artifacts
  projectedAssetBalance = Math.round(projectedAssetBalance * 1e8) / 1e8;
  projectedEthBalance = Math.round(projectedEthBalance * 1e8) / 1e8;

  const hasInsufficientAsset = projectedAssetBalance < 0;
  const hasInsufficientGas = projectedEthBalance < 0;
  const isLowEthReserve = !isGaslessActive && projectedEthBalance >= 0 && projectedEthBalance < 0.001;

  // Calculate total USD outlay
  let totalOutlayUsd = 0;
  if (asset === "USDG") {
    totalOutlayUsd = parsedSend + parsedGasFee * ethPrice;
  } else {
    totalOutlayUsd = (parsedSend + parsedGasFee) * ethPrice;
  }
  totalOutlayUsd = Math.round(totalOutlayUsd * 100) / 100;

  const assetDecimals = asset === "USDG" ? 2 : 4;

  return {
    asset,
    initialAssetBalance,
    sendAmount: parsedSend,
    projectedAssetBalance: Math.max(0, projectedAssetBalance),
    formattedInitialAsset: `${formatPrecision(initialAssetBalance, assetDecimals, 2)} ${asset}`,
    formattedSendAmount: `-${formatPrecision(parsedSend, assetDecimals, 2)} ${asset}`,
    formattedProjectedAsset: `${formatPrecision(Math.max(0, projectedAssetBalance), assetDecimals, 2)} ${asset}`,

    initialEthBalance: parsedEth,
    gasFeeEth: parsedGasFee,
    projectedEthBalance: Math.max(0, projectedEthBalance),
    formattedInitialEth: `${formatPrecision(parsedEth, 5, 4)} ETH`,
    formattedGasFeeEth: isGaslessActive
      ? "0.00 ETH (Sponsored)"
      : `-${formatPrecision(parsedGasFee, 6, 4)} ETH`,
    formattedProjectedEth: `${formatPrecision(Math.max(0, projectedEthBalance), 5, 4)} ETH`,

    isGasless: isGaslessActive,
    totalOutlayUsd,
    formattedTotalOutlayUsd: `$${formatPrecision(totalOutlayUsd, 2, 2)} USD`,

    hasInsufficientAsset,
    hasInsufficientGas,
    isLowEthReserve,
  };
}
