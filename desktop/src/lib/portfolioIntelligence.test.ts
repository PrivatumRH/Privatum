import { describe, expect, it } from "bun:test";
import { analyzePortfolio, answerPortfolioQuery } from "./portfolioIntelligence";

describe("Portfolio intelligence", () => {
  it("calculates value, allocation, and concentration", () => {
    const result = analyzePortfolio({ usdgBalance: "1100", ethBalance: "0.1", ethPrice: 2500 });
    expect(result.totalUsd).toBe(1350);
    expect(result.holdings[0].symbol).toBe("USDG");
    expect(result.insights[0].kind).toBe("warning");
  });

  it("answers local RWA exposure questions from ledger evidence", () => {
    const portfolio = analyzePortfolio({ usdgBalance: "100", ethBalance: "1", ethPrice: 2000, transactions: [{ asset: "AAPL", amount: "2", type: "receive" }] });
    expect(answerPortfolioQuery("what is my RWA exposure?", portfolio)).toContain("1 ledger entry");
  });
});
