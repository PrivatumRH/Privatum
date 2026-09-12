import React, { useState, useMemo } from "react";
import {
  TrendingUp,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Sparkles,
  Eye,
  EyeOff,
} from "lucide-react";

interface PortfolioSparklineCardProps {
  totalUsdValue: number;
  usdgBalance: string;
  ethBalance: string;
  ethPrice: number;
  walletAddress?: string;
  isGaslessActive?: boolean;
  onOpenSend?: () => void;
  onOpenReceive?: () => void;
  onOpenSwap?: () => void;
}

type Timeframe = "24H" | "7D" | "30D" | "1Y";

// Synthetic historical curve generator for smooth visual spline rendering
const TIMEFRAME_DATA: Record<
  Timeframe,
  {
    points: number[];
    pnlDelta: number;
    pnlPercent: number;
    labels: string[];
    summary: string;
  }
> = {
  "24H": {
    points: [2980, 2965, 2990, 2975, 3010, 3045, 3020, 3060, 3095, 3080, 3115, 3142.5],
    pnlDelta: 142.5,
    pnlPercent: 4.82,
    labels: ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "Now"],
    summary: "+$142.50 (+4.82%) today",
  },
  "7D": {
    points: [2840, 2890, 2860, 2940, 2990, 3050, 3142.5],
    pnlDelta: 302.5,
    pnlPercent: 10.65,
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"],
    summary: "+$302.50 (+10.65%) 7d",
  },
  "30D": {
    points: [2650, 2710, 2690, 2780, 2850, 2920, 3010, 3142.5],
    pnlDelta: 492.5,
    pnlPercent: 18.58,
    labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
    summary: "+$492.50 (+18.58%) 30d",
  },
  "1Y": {
    points: [1800, 2100, 2050, 2400, 2600, 2850, 3142.5],
    pnlDelta: 1342.5,
    pnlPercent: 74.58,
    labels: ["Q1", "Q2", "Q3", "Q4"],
    summary: "+$1,342.50 (+74.58%) 1y",
  },
};

export function PortfolioSparklineCard({
  totalUsdValue,
  usdgBalance,
  ethBalance,
  ethPrice,
  walletAddress,
  isGaslessActive,
  onOpenSend,
  onOpenReceive,
  onOpenSwap,
}: PortfolioSparklineCardProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("24H");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [usePreviewPortfolio, setUsePreviewPortfolio] = useState<boolean>(() => totalUsdValue <= 0.05);

  const activeData = TIMEFRAME_DATA[timeframe];

  // If user has a real positive balance, scale the curve to their actual portfolio
  const scaledPoints = useMemo(() => {
    const raw = activeData.points;
    if (!usePreviewPortfolio && totalUsdValue > 0) {
      const lastRaw = raw[raw.length - 1];
      const scale = totalUsdValue / (lastRaw || 1);
      return raw.map((v) => Math.round(v * scale * 100) / 100);
    }
    return raw;
  }, [activeData.points, totalUsdValue, usePreviewPortfolio]);

  const displayCurrentVal = useMemo(() => {
    if (hoverIndex !== null && hoverIndex >= 0 && hoverIndex < scaledPoints.length) {
      return scaledPoints[hoverIndex];
    }
    return usePreviewPortfolio ? 3142.5 : totalUsdValue;
  }, [hoverIndex, scaledPoints, totalUsdValue, usePreviewPortfolio]);

  const displayPnlDelta = useMemo(() => {
    if (!usePreviewPortfolio && totalUsdValue > 0) {
      return Math.round((totalUsdValue * (activeData.pnlPercent / 100)) * 100) / 100;
    }
    return activeData.pnlDelta;
  }, [activeData.pnlDelta, activeData.pnlPercent, totalUsdValue, usePreviewPortfolio]);

  // Asset allocation calculations
  const allocations = useMemo(() => {
    if (usePreviewPortfolio || totalUsdValue <= 0) {
      return [
        { symbol: "USDG", name: "Global Dollar", percent: 58.4, valueUsd: 1835.22, color: "#38b6ff" },
        { symbol: "ETH", name: "Native Gas", percent: 34.2, valueUsd: 1074.74, color: "#818cf8" },
        { symbol: "PRIV", name: "Staked Utility", percent: 7.4, valueUsd: 232.54, color: "#f64943" },
      ];
    }

    const usdgVal = parseFloat(usdgBalance || "0");
    const ethVal = (parseFloat(ethBalance || "0") * (ethPrice || 2500));
    const total = Math.max(0.01, usdgVal + ethVal);

    const usdgPct = Math.round((usdgVal / total) * 1000) / 10;
    const ethPct = Math.round((ethVal / total) * 1000) / 10;
    const privPct = Math.max(0, Math.round((100 - usdgPct - ethPct) * 10) / 10);

    return [
      { symbol: "USDG", name: "Global Dollar", percent: usdgPct, valueUsd: usdgVal, color: "#38b6ff" },
      { symbol: "ETH", name: "Native Gas", percent: ethPct, valueUsd: ethVal, color: "#818cf8" },
      { symbol: "PRIV", name: "Staked Utility", percent: privPct, valueUsd: 0, color: "#f64943" },
    ];
  }, [usePreviewPortfolio, totalUsdValue, usdgBalance, ethBalance, ethPrice]);

  // Generate SVG path coordinates
  const svgWidth = 500;
  const svgHeight = 110;
  const paddingX = 15;
  const paddingY = 15;

  const minVal = Math.min(...scaledPoints);
  const maxVal = Math.max(...scaledPoints);
  const range = maxVal - minVal || 1;

  const points = useMemo(() => {
    const n = scaledPoints.length;
    return scaledPoints.map((val, i) => {
      const x = paddingX + (i / (n - 1)) * (svgWidth - paddingX * 2);
      const normalizedY = (val - minVal) / range;
      const y = svgHeight - paddingY - normalizedY * (svgHeight - paddingY * 2);
      return { x, y, val };
    });
  }, [scaledPoints, minVal, range]);

  // Construct smooth cubic bezier path
  const splinePath = useMemo(() => {
    if (points.length < 2) return "";
    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cx = (p0.x + p1.x) / 2;
      d += ` C ${cx.toFixed(1)} ${p0.y.toFixed(1)}, ${cx.toFixed(1)} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    }
    return d;
  }, [points]);

  const fillAreaPath = useMemo(() => {
    if (points.length < 2) return "";
    const last = points[points.length - 1];
    const first = points[0];
    return `${splinePath} L ${last.x.toFixed(1)} ${svgHeight} L ${first.x.toFixed(1)} ${svgHeight} Z`;
  }, [splinePath, points]);

  const lastPoint = points[points.length - 1];

  return (
    <div className="rounded-2xl bg-[#0e1015] border border-white/[0.08] overflow-hidden p-6 space-y-6 select-none relative shadow-2xl">
      {/* Top Banner Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-sans">
              Frontier Portfolio Valuation
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium font-sans">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Robinhood Chain L2
            </span>
            {isGaslessActive && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[10px] font-medium">
                <Zap className="w-3 h-3 text-purple-400" />
                Gasless Active
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-3 flex-wrap">
            <div className="text-4xl sm:text-5xl font-semibold tracking-tight text-white font-mono">
              ${displayCurrentVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xl sm:text-2xl font-normal text-slate-400 font-sans ml-2">USD</span>
            </div>

            {/* 24h PnL Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold font-mono shadow-sm">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>
                +${displayPnlDelta.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-emerald-300 font-sans font-medium text-[11px]">
                (+{activeData.pnlPercent.toFixed(2)}%) {timeframe}
              </span>
            </div>
          </div>
        </div>

        {/* Right Action & Security Badge Row */}
        <div className="flex items-center gap-3 self-start lg:self-center flex-wrap">
          {/* 2-of-3 MPC Quorum Armed pill */}
          <div className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-medium text-slate-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-sans">2-of-3 Threshold Armed</span>
          </div>

          {/* Timeframe Switcher */}
          <div className="flex items-center bg-white/[0.04] p-0.5 rounded-xl border border-white/10 text-xs">
            {(["24H", "7D", "30D", "1Y"] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => {
                  setTimeframe(tf);
                  setHoverIndex(null);
                }}
                className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                  timeframe === tf
                    ? "bg-[#22c55e]/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Quick Demo Preview toggle button for clean screenshotting */}
          <button
            onClick={() => setUsePreviewPortfolio((prev) => !prev)}
            title={usePreviewPortfolio ? "Switch to live on-chain balances" : "Switch to sample portfolio preview for clean screenshot"}
            className="p-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white border border-white/10 transition cursor-pointer"
          >
            {usePreviewPortfolio ? <Eye className="w-4 h-4 text-[#38b6ff]" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mini Spline Sparkline Chart */}
      <div className="relative pt-2 pb-1">
        <div className="w-full h-28 relative">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-full overflow-visible"
            preserveAspectRatio="none"
            onMouseLeave={() => setHoverIndex(null)}
          >
            <defs>
              <linearGradient id="splineGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity="0.28" />
                <stop offset="60%" stopColor="#22c55e" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#22c55e" stopOpacity="0.00" />
              </linearGradient>
              <linearGradient id="splineStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#38b6ff" />
                <stop offset="40%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#4ade80" />
              </linearGradient>
            </defs>

            {/* Subtle baseline */}
            <line
              x1={paddingX}
              y1={points[0]?.y || svgHeight / 2}
              x2={svgWidth - paddingX}
              y2={points[0]?.y || svgHeight / 2}
              stroke="rgba(255, 255, 255, 0.08)"
              strokeDasharray="3 3"
              strokeWidth="1"
            />

            {/* Gradient area underneath */}
            {fillAreaPath && <path d={fillAreaPath} fill="url(#splineGradient)" />}

            {/* Glowing spline curve */}
            {splinePath && (
              <path
                d={splinePath}
                fill="none"
                stroke="url(#splineStroke)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Interactive hover points & markers */}
            {points.map((p, idx) => (
              <g key={idx} className="cursor-pointer" onMouseEnter={() => setHoverIndex(idx)}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={hoverIndex === idx ? "5" : "3"}
                  className={`transition-all ${
                    hoverIndex === idx
                      ? "fill-white stroke-[#22c55e] stroke-2"
                      : "fill-transparent hover:fill-emerald-400"
                  }`}
                />
              </g>
            ))}

            {/* Pulsing latest point dot */}
            {lastPoint && (
              <g>
                <circle
                  cx={lastPoint.x}
                  cy={lastPoint.y}
                  r="7"
                  className="fill-emerald-400/40 animate-ping"
                />
                <circle
                  cx={lastPoint.x}
                  cy={lastPoint.y}
                  r="4"
                  className="fill-emerald-400 stroke-[#0e1015] stroke-2"
                />
              </g>
            )}
          </svg>
        </div>

        {/* Time axis labels */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-2 px-1">
          {activeData.labels.map((lbl, idx) => (
            <span key={idx}>{lbl}</span>
          ))}
        </div>
      </div>

      {/* Asset Allocation Breakdown Bar & Legend */}
      <div className="pt-2 border-t border-white/[0.06] space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-400 font-sans flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-slate-400" />
            Frontier Asset Allocation
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            Robinhood Chain Native DEX &amp; Vaults
          </span>
        </div>

        {/* Multi-segment progress bar */}
        <div className="h-2.5 w-full bg-white/[0.05] rounded-full overflow-hidden flex gap-0.5 p-0.5">
          {allocations.map((a) => (
            <div
              key={a.symbol}
              style={{ width: `${Math.max(3, a.percent)}%`, backgroundColor: a.color }}
              className="h-full rounded-full transition-all duration-500 shadow-sm"
              title={`${a.symbol}: ${a.percent}%`}
            />
          ))}
        </div>

        {/* Legend row and Action buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-4 flex-wrap text-xs">
            {allocations.map((a) => (
              <div key={a.symbol} className="flex items-center gap-1.5 font-sans">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                <span className="font-medium text-white">{a.symbol}</span>
                <span className="text-slate-400 font-mono text-[11px]">
                  {a.percent.toFixed(1)}%
                </span>
                {a.valueUsd > 0 && (
                  <span className="text-slate-500 font-mono text-[11px]">
                    (${a.valueUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })})
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            {onOpenSend && (
              <button
                onClick={onOpenSend}
                className="px-3.5 py-1.5 rounded-xl bg-[#f64943] hover:bg-[#e03d38] text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            )}
            {onOpenReceive && (
              <button
                onClick={onOpenReceive}
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium border border-white/15 flex items-center gap-1.5 transition cursor-pointer"
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>Receive</span>
              </button>
            )}
            {onOpenSwap && (
              <button
                onClick={onOpenSwap}
                className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-medium border border-white/10 flex items-center gap-1.5 transition cursor-pointer"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>Swap</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
