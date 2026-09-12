import React, { useState, useEffect, useMemo } from "react";
import { ArrowUpRight, ArrowDownLeft, ArrowLeftRight } from "lucide-react";

interface PortfolioSparklineCardProps {
  totalUsdValue: number;
  usdgBalance: string;
  ethBalance: string;
  ethPrice: number;
  eth24hChange?: number;
  onOpenSend?: () => void;
  onOpenReceive?: () => void;
  onOpenSwap?: () => void;
}

interface PricePoint {
  time: number;
  value: number;
}

export function PortfolioSparklineCard({
  totalUsdValue,
  usdgBalance,
  ethBalance,
  ethPrice,
  eth24hChange = 0,
  onOpenSend,
  onOpenReceive,
  onOpenSwap,
}: PortfolioSparklineCardProps) {
  const [historyPoints, setHistoryPoints] = useState<PricePoint[]>([]);

  // Fetch real 24h market chart for Ethereum to compute real portfolio historical curve
  useEffect(() => {
    let cancelled = false;

    async function loadChartData() {
      try {
        const cachedRaw = localStorage.getItem("privatum_eth_24h_chart");
        const cachedTime = localStorage.getItem("privatum_eth_24h_chart_time");
        const now = Date.now();

        // 10-minute cache to respect rate limits
        if (cachedRaw && cachedTime && now - parseInt(cachedTime, 10) < 600000) {
          const parsed = JSON.parse(cachedRaw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            if (!cancelled) setHistoryPoints(parsed);
            return;
          }
        }

        const res = await fetch(
          "https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=usd&days=1"
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        if (Array.isArray(json?.prices) && json.prices.length > 0) {
          const formatted: PricePoint[] = json.prices.map(([t, p]: [number, number]) => ({
            time: t,
            value: p,
          }));
          if (!cancelled) {
            setHistoryPoints(formatted);
            try {
              localStorage.setItem("privatum_eth_24h_chart", JSON.stringify(formatted));
              localStorage.setItem("privatum_eth_24h_chart_time", String(now));
            } catch {}
          }
        }
      } catch {
        // If external chart fetch fails, fall back to calculating from real eth24hChange
        if (!cancelled && ethPrice > 0) {
          const now = Date.now();
          const p24Ago = eth24hChange !== 0 ? ethPrice / (1 + eth24hChange / 100) : ethPrice;
          const syntheticFromRealChange: PricePoint[] = [
            { time: now - 86400000, value: p24Ago },
            { time: now - 43200000, value: (p24Ago + ethPrice) / 2 },
            { time: now, value: ethPrice },
          ];
          setHistoryPoints(syntheticFromRealChange);
        }
      }
    }

    loadChartData();
    return () => {
      cancelled = true;
    };
  }, [ethPrice, eth24hChange]);

  const usdgNum = parseFloat(usdgBalance) || 0;
  const ethNum = parseFloat(ethBalance) || 0;
  const usdgUsd = usdgNum * 1.0;
  const ethUsd = ethNum * ethPrice;

  // Real portfolio curve: usdgAmount * $1 + ethAmount * ethPriceAtTime
  const portfolioPoints = useMemo(() => {
    if (totalUsdValue <= 0 || historyPoints.length === 0) {
      return [totalUsdValue, totalUsdValue];
    }
    return historyPoints.map((pt) => {
      const val = usdgUsd + ethNum * pt.value;
      return Math.round(val * 100) / 100;
    });
  }, [historyPoints, totalUsdValue, usdgUsd, ethNum]);

  // Real 24h PnL change calculation
  const { deltaUsd, percentChange, isPositive } = useMemo(() => {
    if (totalUsdValue <= 0) {
      return { deltaUsd: 0, percentChange: 0, isPositive: true };
    }
    if (ethNum <= 0) {
      // User only holds USDG (stablecoin, zero price volatility)
      return { deltaUsd: 0, percentChange: 0, isPositive: true };
    }

    if (portfolioPoints.length >= 2) {
      const start = portfolioPoints[0];
      const end = portfolioPoints[portfolioPoints.length - 1];
      const diff = end - start;
      const pct = start > 0 ? (diff / start) * 100 : 0;
      return {
        deltaUsd: Math.round(diff * 100) / 100,
        percentChange: Math.round(pct * 100) / 100,
        isPositive: diff >= 0,
      };
    }

    // Fall back to direct ETH delta if chart points are single
    const diff = ethUsd * (eth24hChange / 100);
    const pct = totalUsdValue > 0 ? (diff / totalUsdValue) * 100 : 0;
    return {
      deltaUsd: Math.round(diff * 100) / 100,
      percentChange: Math.round(pct * 100) / 100,
      isPositive: diff >= 0,
    };
  }, [totalUsdValue, ethNum, portfolioPoints, ethUsd, eth24hChange]);

  // Assets held by the user account for the gauge
  const heldAssets = useMemo(() => {
    const list: Array<{
      symbol: string;
      name: string;
      amountFormatted: string;
      valueUsd: number;
      percent: number;
      color: string;
    }> = [];

    const total = usdgUsd + ethUsd;
    if (total <= 0) return list;

    if (usdgNum > 0) {
      list.push({
        symbol: "USDG",
        name: "USDG",
        amountFormatted: `${usdgNum.toFixed(2)} USDG`,
        valueUsd: usdgUsd,
        percent: (usdgUsd / total) * 100,
        color: "#c0d967",
      });
    }

    if (ethNum > 0) {
      list.push({
        symbol: "ETH",
        name: "ETH",
        amountFormatted: `${ethNum.toFixed(4)} ETH`,
        valueUsd: ethUsd,
        percent: (ethUsd / total) * 100,
        color: "#5d79e2",
      });
    }

    return list;
  }, [usdgNum, ethNum, usdgUsd, ethUsd]);

  // Render SVG spline for the real portfolio points
  const svgWidth = 500;
  const svgHeight = 90;
  const paddingX = 4;
  const paddingY = 8;

  const minVal = Math.min(...portfolioPoints);
  const maxVal = Math.max(...portfolioPoints);
  const range = maxVal - minVal;

  const coordinates = useMemo(() => {
    const n = portfolioPoints.length;
    if (n < 2) {
      return [
        { x: paddingX, y: svgHeight / 2 },
        { x: svgWidth - paddingX, y: svgHeight / 2 },
      ];
    }
    return portfolioPoints.map((val, i) => {
      const x = paddingX + (i / (n - 1)) * (svgWidth - paddingX * 2);
      const normalizedY = range > 0 ? (val - minVal) / range : 0.5;
      const y = svgHeight - paddingY - normalizedY * (svgHeight - paddingY * 2);
      return { x, y };
    });
  }, [portfolioPoints, minVal, range]);

  const splinePath = useMemo(() => {
    if (coordinates.length < 2) return "";
    let d = `M ${coordinates[0].x.toFixed(1)} ${coordinates[0].y.toFixed(1)}`;
    for (let i = 0; i < coordinates.length - 1; i++) {
      const p0 = coordinates[i];
      const p1 = coordinates[i + 1];
      const cx = (p0.x + p1.x) / 2;
      d += ` C ${cx.toFixed(1)} ${p0.y.toFixed(1)}, ${cx.toFixed(1)} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    }
    return d;
  }, [coordinates]);

  const fillPath = useMemo(() => {
    if (coordinates.length < 2 || !splinePath) return "";
    const last = coordinates[coordinates.length - 1];
    const first = coordinates[0];
    return `${splinePath} L ${last.x.toFixed(1)} ${svgHeight} L ${first.x.toFixed(1)} ${svgHeight} Z`;
  }, [splinePath, coordinates]);

  const chartColor = isPositive ? "#22c55e" : "#f64943";

  return (
    <div className="rounded-2xl bg-[#0e1015] border border-white/[0.08] overflow-hidden p-6 space-y-5 select-none relative shadow-xl">
      {/* Top Row: Balance and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          {/* Main Portfolio Value */}
          <div className="text-4xl sm:text-5xl font-semibold tracking-tight text-white font-mono flex items-baseline gap-2">
            <span>
              ${totalUsdValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xl sm:text-2xl font-normal text-slate-400 font-sans">USD</span>
          </div>

          {/* Plain Text 24h Change (Green if plus, Red if loss) */}
          <div
            className={`text-sm font-medium font-mono mt-1 ${
              isPositive ? "text-[#22c55e]" : "text-[#f64943]"
            }`}
          >
            {isPositive ? "+" : "-"}
            ${Math.abs(deltaUsd).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (
            {isPositive ? "+" : "-"}
            {Math.abs(percentChange).toFixed(2)}%) 24h
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 self-start sm:self-center">
          {onOpenSend && (
            <button
              onClick={onOpenSend}
              className="px-4 py-2 rounded-xl bg-[#f64943] hover:bg-[#e03d38] text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          )}
          {onOpenReceive && (
            <button
              onClick={onOpenReceive}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium border border-white/15 flex items-center gap-1.5 transition cursor-pointer"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>Receive</span>
            </button>
          )}
          {onOpenSwap && (
            <button
              onClick={onOpenSwap}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-medium border border-white/10 flex items-center gap-1.5 transition cursor-pointer"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Swap</span>
            </button>
          )}
        </div>
      </div>

      {/* Real 24-Hour Sparkline Chart */}
      <div className="relative w-full h-24 pt-1">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="realChartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartColor} stopOpacity="0.25" />
              <stop offset="100%" stopColor={chartColor} stopOpacity="0.00" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          {fillPath && <path d={fillPath} fill="url(#realChartGrad)" />}

          {/* Spline line */}
          {splinePath && (
            <path
              d={splinePath}
              fill="none"
              stroke={chartColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Real final point marker */}
          {coordinates.length > 0 && totalUsdValue > 0 && (
            <circle
              cx={coordinates[coordinates.length - 1].x}
              cy={coordinates[coordinates.length - 1].y}
              r="3.5"
              fill={chartColor}
              stroke="#0e1015"
              strokeWidth="1.5"
            />
          )}
        </svg>
      </div>

      {/* Assets Gauge: Only displays ETH (#5d79e2) and USDG (#c0d967) the account actually holds */}
      <div className="space-y-2 pt-1 border-t border-white/[0.06]">
        {/* Gauge Track */}
        <div className="h-2 w-full bg-white/[0.06] rounded-full overflow-hidden flex gap-0.5">
          {heldAssets.length > 0 ? (
            heldAssets.map((asset) => (
              <div
                key={asset.symbol}
                style={{
                  width: `${asset.percent}%`,
                  backgroundColor: asset.color,
                }}
                className="h-full rounded-full transition-all duration-300"
                title={`${asset.symbol}: ${asset.percent.toFixed(1)}%`}
              />
            ))
          ) : (
            <div className="h-full w-full bg-white/[0.04] rounded-full" />
          )}
        </div>

        {/* Legend: Only items actually held */}
        <div className="flex items-center justify-between text-xs pt-1">
          <div className="flex items-center gap-4 flex-wrap">
            {heldAssets.length > 0 ? (
              heldAssets.map((asset) => (
                <div key={asset.symbol} className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: asset.color }}
                  />
                  <span className="font-medium text-white text-xs">{asset.symbol}</span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {asset.percent.toFixed(1)}%
                  </span>
                  <span className="text-slate-500 font-mono text-[11px]">
                    ({asset.amountFormatted})
                  </span>
                </div>
              ))
            ) : (
              <span className="text-slate-500 text-xs font-mono">No tokens held</span>
            )}
          </div>

          <div className="text-[11px] text-slate-500 font-mono">
            {heldAssets.length > 0 ? `${heldAssets.length} asset${heldAssets.length > 1 ? "s" : ""}` : "0 assets"}
          </div>
        </div>
      </div>
    </div>
  );
}
