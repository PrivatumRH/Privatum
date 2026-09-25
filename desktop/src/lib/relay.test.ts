import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DESTINATION_CHAINS,
  findDestinationChain,
  isSupportedDestinationChain,
  fetchRelayCrossChainQuote,
  checkRelayIntentStatus,
} from "./relay";

describe("relay cross-chain module", () => {
  it("includes Optimism among supported destination networks", () => {
    const op = DESTINATION_CHAINS.find((c) => c.chainId === 10);
    expect(op).toBeDefined();
    expect(op?.name).toBe("Optimism");
    expect(op?.symbol).toBe("OP");
    expect(op?.iconColor).toBe("#ff0420");
    expect(op?.usdcAddress.toLowerCase()).toBe(
      "0x0b2c639c533813f4aa9d7837caf62653d097ff85"
    );
    expect(op?.explorerUrl).toBe("https://optimistic.etherscan.io");
  });

  it("includes Base, Ethereum, and Arbitrum One in destination networks", () => {
    expect(DESTINATION_CHAINS.some((c) => c.chainId === 8453 && c.name === "Base")).toBe(true);
    expect(DESTINATION_CHAINS.some((c) => c.chainId === 1 && c.name === "Ethereum")).toBe(true);
    expect(DESTINATION_CHAINS.some((c) => c.chainId === 42161 && c.name === "Arbitrum One")).toBe(true);
    expect(DESTINATION_CHAINS.length).toBe(4);
  });

  describe("findDestinationChain", () => {
    it("resolves chains by numeric chain ID", () => {
      expect(findDestinationChain(10)?.name).toBe("Optimism");
      expect(findDestinationChain(8453)?.name).toBe("Base");
      expect(findDestinationChain(1)?.name).toBe("Ethereum");
      expect(findDestinationChain(42161)?.name).toBe("Arbitrum One");
    });

    it("resolves chains by string chain ID", () => {
      expect(findDestinationChain("10")?.name).toBe("Optimism");
      expect(findDestinationChain("8453")?.name).toBe("Base");
    });

    it("resolves chains by name case-insensitively", () => {
      expect(findDestinationChain("optimism")?.chainId).toBe(10);
      expect(findDestinationChain("Base")?.chainId).toBe(8453);
      expect(findDestinationChain("ethereum")?.chainId).toBe(1);
    });

    it("resolves common aliases like op mainnet or arbitrum", () => {
      expect(findDestinationChain("op mainnet")?.chainId).toBe(10);
      expect(findDestinationChain("OP")?.chainId).toBe(10);
      expect(findDestinationChain("arbitrum")?.chainId).toBe(42161);
    });

    it("returns undefined for unsupported chains", () => {
      expect(findDestinationChain(999999)).toBeUndefined();
      expect(findDestinationChain("solana")).toBeUndefined();
    });
  });

  describe("isSupportedDestinationChain", () => {
    it("returns true for supported chain IDs", () => {
      expect(isSupportedDestinationChain(10)).toBe(true);
      expect(isSupportedDestinationChain(8453)).toBe(true);
      expect(isSupportedDestinationChain(1)).toBe(true);
      expect(isSupportedDestinationChain(42161)).toBe(true);
    });

    it("returns false for unsupported chain IDs", () => {
      expect(isSupportedDestinationChain(56)).toBe(false);
      expect(isSupportedDestinationChain(137)).toBe(false);
    });
  });

  describe("fetchRelayCrossChainQuote", () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      globalThis.fetch = vi.fn();
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("posts quote request with correct parameters and returns data", async () => {
      const mockResponse = {
        details: {
          rate: "1.0",
          timeEstimate: 25,
        },
      };

      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const quote = await fetchRelayCrossChainQuote({
        userAddress: "0x1111111111111111111111111111111111111111",
        recipientAddress: "0x2222222222222222222222222222222222222222",
        destinationChainId: 10,
        originCurrency: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
        destinationCurrency: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
        amount: "100000000",
      });

      expect(quote).toEqual(mockResponse);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.relay.link/quote",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"destinationChainId":10'),
        })
      );
    });

    it("returns null when fetch returns error status", async () => {
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      const quote = await fetchRelayCrossChainQuote({
        userAddress: "0x1111111111111111111111111111111111111111",
        recipientAddress: "0x2222222222222222222222222222222222222222",
        destinationChainId: 10,
        originCurrency: "0x0000000000000000000000000000000000000000",
        destinationCurrency: "0x0000000000000000000000000000000000000000",
        amount: "1000000000000000000",
      });

      expect(quote).toBeNull();
    });
  });

  describe("checkRelayIntentStatus", () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      globalThis.fetch = vi.fn();
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("returns status string from API response", async () => {
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "success" }),
      });

      const status = await checkRelayIntentStatus("req-123");
      expect(status).toBe("success");
    });

    it("returns pending on fetch error", async () => {
      (globalThis.fetch as any).mockRejectedValueOnce(new Error("Network down"));
      const status = await checkRelayIntentStatus("req-123");
      expect(status).toBe("pending");
    });
  });
});
