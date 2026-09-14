import { describe, it, expect } from "bun:test";
import { computeBalanceDiff, formatPrecision } from "./balanceDiff";

describe("Pre-Flight Asset & Balance Diff Preview Engine", () => {
  describe("formatPrecision", () => {
    it("formats values with default minimum and maximum decimals", () => {
      expect(formatPrecision(1234.5)).toBe("1,234.50");
      expect(formatPrecision(0)).toBe("0.00");
      expect(formatPrecision(NaN)).toBe("0.00");
    });
  });

  describe("computeBalanceDiff for USDG Transfers", () => {
    it("correctly computes standard USDG balance deduction and ETH gas impact", () => {
      const result = computeBalanceDiff({
        asset: "USDG",
        sendAmount: "250.00",
        usdgBalance: "1000.00",
        ethBalance: "0.05",
        estimatedFeeEth: "0.000021",
        isGaslessActive: false,
        ethPrice: 2800,
      });

      expect(result.initialAssetBalance).toBe(1000);
      expect(result.sendAmount).toBe(250);
      expect(result.projectedAssetBalance).toBe(750);
      expect(result.formattedInitialAsset).toBe("1,000.00 USDG");
      expect(result.formattedSendAmount).toBe("-250.00 USDG");
      expect(result.formattedProjectedAsset).toBe("750.00 USDG");

      expect(result.initialEthBalance).toBe(0.05);
      expect(result.gasFeeEth).toBe(0.000021);
      expect(result.projectedEthBalance).toBeCloseTo(0.049979, 6);
      expect(result.formattedGasFeeEth).toBe("-0.000021 ETH");

      expect(result.isGasless).toBe(false);
      expect(result.hasInsufficientAsset).toBe(false);
      expect(result.hasInsufficientGas).toBe(false);
      expect(result.isLowEthReserve).toBe(false);

      // 250 + (0.000021 * 2800 = 0.0588) => 250.06
      expect(result.totalOutlayUsd).toBe(250.06);
    });

    it("handles protocol-sponsored gasless USDG transfers with zero ETH fee deduction", () => {
      const result = computeBalanceDiff({
        asset: "USDG",
        sendAmount: "100.00",
        usdgBalance: "500.00",
        ethBalance: "0.02",
        estimatedFeeEth: "0.000021",
        isGaslessActive: true,
        ethPrice: 2800,
      });

      expect(result.initialAssetBalance).toBe(500);
      expect(result.sendAmount).toBe(100);
      expect(result.projectedAssetBalance).toBe(400);

      expect(result.gasFeeEth).toBe(0);
      expect(result.projectedEthBalance).toBe(0.02);
      expect(result.formattedGasFeeEth).toBe("0.00 ETH (Sponsored)");
      expect(result.isGasless).toBe(true);

      expect(result.hasInsufficientAsset).toBe(false);
      expect(result.hasInsufficientGas).toBe(false);
      expect(result.totalOutlayUsd).toBe(100);
    });

    it("flags insufficient USDG asset balance when send exceeds available tokens", () => {
      const result = computeBalanceDiff({
        asset: "USDG",
        sendAmount: "600.00",
        usdgBalance: "500.00",
        ethBalance: "0.02",
        estimatedFeeEth: "0.000021",
        isGaslessActive: false,
      });

      expect(result.hasInsufficientAsset).toBe(true);
      expect(result.hasInsufficientGas).toBe(false);
    });

    it("flags insufficient ETH gas balance when operator has zero gas on non-sponsored send", () => {
      const result = computeBalanceDiff({
        asset: "USDG",
        sendAmount: "50.00",
        usdgBalance: "500.00",
        ethBalance: "0.00",
        estimatedFeeEth: "0.000021",
        isGaslessActive: false,
      });

      expect(result.hasInsufficientAsset).toBe(false);
      expect(result.hasInsufficientGas).toBe(true);
    });
  });

  describe("computeBalanceDiff for Native ETH Transfers", () => {
    it("correctly combines transfer amount and gas fee into ETH balance reduction", () => {
      const result = computeBalanceDiff({
        asset: "ETH",
        sendAmount: "0.5",
        usdgBalance: "0.00",
        ethBalance: "1.0",
        estimatedFeeEth: "0.000021",
        isGaslessActive: false,
        ethPrice: 2800,
      });

      expect(result.initialAssetBalance).toBe(1.0);
      expect(result.sendAmount).toBe(0.5);
      expect(result.gasFeeEth).toBe(0.000021);
      // 1.0 - 0.5 - 0.000021 = 0.499979
      expect(result.projectedAssetBalance).toBeCloseTo(0.499979, 6);
      expect(result.projectedEthBalance).toBeCloseTo(0.499979, 6);

      expect(result.hasInsufficientAsset).toBe(false);
      expect(result.hasInsufficientGas).toBe(false);
      expect(result.isLowEthReserve).toBe(false);

      // (0.5 + 0.000021) * 2800 = 1400.06
      expect(result.totalOutlayUsd).toBe(1400.06);
    });

    it("flags insufficient ETH when transfer plus gas exceeds balance", () => {
      const result = computeBalanceDiff({
        asset: "ETH",
        sendAmount: "1.0",
        usdgBalance: "0.00",
        ethBalance: "1.0",
        estimatedFeeEth: "0.000021",
        isGaslessActive: false,
      });

      // User has exactly 1.0 ETH, but fee requires 0.000021 additional ETH
      expect(result.hasInsufficientAsset).toBe(true);
      expect(result.hasInsufficientGas).toBe(true);
    });

    it("triggers low reserve warning when projected ETH drops below 0.001 ETH", () => {
      const result = computeBalanceDiff({
        asset: "ETH",
        sendAmount: "0.0995",
        usdgBalance: "0.00",
        ethBalance: "0.10",
        estimatedFeeEth: "0.000021",
        isGaslessActive: false,
      });

      // 0.10 - 0.0995 - 0.000021 = 0.000479 ETH (< 0.001)
      expect(result.hasInsufficientAsset).toBe(false);
      expect(result.hasInsufficientGas).toBe(false);
      expect(result.isLowEthReserve).toBe(true);
    });
  });
});
