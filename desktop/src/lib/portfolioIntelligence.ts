export interface PortfolioIntelligenceInput {
  usdgBalance: string;
  ethBalance: string;
  ethPrice: number;
  eth24hChange?: number;
  transactions?: { asset: string; amount: string; type: "send" | "receive" }[];
}

export interface PortfolioHolding {
  symbol: string;
  label: string;
  amount: number;
  valueUsd: number;
  sharePercent: number;
  isRwa: boolean;
}

export interface PortfolioInsight {
  kind: "positive" | "warning" | "neutral";
  title: string;
  detail: string;
}

export interface PortfolioIntelligence {
  totalUsd: number;
  holdings: PortfolioHolding[];
  rwaActivityCount: number;
  eth24hChange: number;
  insights: PortfolioInsight[];
}

export function analyzePortfolio(input: PortfolioIntelligenceInput): PortfolioIntelligence {
  const usdg = Math.max(0, Number.parseFloat(input.usdgBalance) || 0);
  const eth = Math.max(0, Number.parseFloat(input.ethBalance) || 0);
  const ethPrice = Math.max(0, input.ethPrice || 0);
  const totalUsd = usdg + eth * ethPrice;
  const holdings: PortfolioHolding[] = [
    { symbol: "USDG", label: "Global Dollar", amount: usdg, valueUsd: usdg, sharePercent: totalUsd ? (usdg / totalUsd) * 100 : 0, isRwa: false },
    { symbol: "ETH", label: "Ether", amount: eth, valueUsd: eth * ethPrice, sharePercent: totalUsd ? ((eth * ethPrice) / totalUsd) * 100 : 0, isRwa: false },
  ].filter((holding) => holding.amount > 0);

  const rwaActivityCount = (input.transactions || []).filter((tx) => !["USDG", "ETH"].includes(tx.asset.toUpperCase())).length;
  const largest = holdings.slice().sort((a, b) => b.valueUsd - a.valueUsd)[0];
  const insights: PortfolioInsight[] = [];

  if (!largest || totalUsd === 0) {
    insights.push({ kind: "neutral", title: "Portfolio is waiting for funding", detail: "Add an asset to activate allocation and concentration analysis." });
  } else if (largest.sharePercent >= 80) {
    insights.push({ kind: "warning", title: `${largest.symbol} concentration is high`, detail: `${largest.symbol} represents ${largest.sharePercent.toFixed(1)}% of tracked value.` });
  } else {
    insights.push({ kind: "positive", title: "No dominant concentration detected", detail: `Largest tracked holding is ${largest.symbol} at ${largest.sharePercent.toFixed(1)}%.` });
  }

  if (eth > 0 && eth < 0.00003) {
    insights.push({ kind: "warning", title: "Gas reserve is thin", detail: "Keep at least 0.00003 ETH available for non-sponsored transactions." });
  } else if (eth >= 0.00003) {
    insights.push({ kind: "positive", title: "Gas reserve is available", detail: "The tracked wallet has enough ETH for the minimum local gas reserve." });
  }

  if (rwaActivityCount > 0) {
    insights.push({ kind: "neutral", title: "RWA activity detected", detail: `${rwaActivityCount} ledger ${rwaActivityCount === 1 ? "entry references" : "entries reference"} a non-ETH/USDG asset.` });
  }

  return { totalUsd, holdings, rwaActivityCount, eth24hChange: input.eth24hChange || 0, insights };
}

export function answerPortfolioQuery(query: string, portfolio: PortfolioIntelligence): string | null {
  const lower = query.toLowerCase();
  if (!/(portfolio|holdings|allocation|concentration|diversif|exposure|rwa)/i.test(lower)) return null;
  if (/(rwa|real[- ]world)/i.test(lower)) {
    return portfolio.rwaActivityCount
      ? `RWA exposure activity: ${portfolio.rwaActivityCount} ledger ${portfolio.rwaActivityCount === 1 ? "entry" : "entries"} references a tokenized asset. Open the RWA tab for contract-level details and use the RWA guard before trading.`
      : "No RWA activity is present in the local transaction ledger. Tracked portfolio value currently covers ETH and USDG only.";
  }
  const allocation = portfolio.holdings.length
    ? portfolio.holdings.map((h) => `${h.symbol} ${h.sharePercent.toFixed(1)}%`).join(" · ")
    : "No funded assets";
  const headline = `Tracked portfolio value: $${portfolio.totalUsd.toFixed(2)}. Allocation: ${allocation}.`;
  const warning = portfolio.insights.find((i) => i.kind === "warning");
  return warning ? `${headline} Watchpoint: ${warning.title} — ${warning.detail}` : headline;
}
