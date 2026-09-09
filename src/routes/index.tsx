import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root";
import { KeyRound, Server, Fingerprint, ArrowRight, CheckCircle2, Zap, Copy } from "lucide-react";
import { useState } from "react";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: IndexComponent,
});

function IndexComponent() {
  const [copied, setCopied] = useState(false);
  const sdkInstallCommand = "npm install @privatum/robinhood-chain-sdk viem";

  const handleCopy = () => {
    navigator.clipboard.writeText(sdkInstallCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 md:py-32 px-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-[#38B6FF]/15 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#38B6FF]/30 bg-[#38B6FF]/10 text-[#38B6FF] text-xs font-mono mb-8">
            <span className="w-2 h-2 rounded-full bg-[#38B6FF] animate-pulse" />
            Frontier Settlement: Robinhood Chain · USDG & ETH
          </div>

          <h1 className="text-4xl md:text-7xl font-display font-medium tracking-tight text-white leading-tight">
            Private payments. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-[#38B6FF]">
              Non-custodial.
            </span>
          </h1>

          <p className="mt-6 text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            A self-custodial threshold wallet and developer toolkit. Your private key is mathematically split into three shards—no single party can ever move your funds.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#sdk"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-[#38B6FF] text-slate-950 font-semibold hover:bg-[#38B6FF]/90 transition shadow-lg shadow-[#38B6FF]/20 flex items-center justify-center gap-2 text-sm"
            >
              <span>Explore Open SDK</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="#shards"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition flex items-center justify-center gap-2 text-sm"
            >
              <span>2-of-3 Architecture</span>
            </a>
          </div>
        </div>
      </section>

      {/* Frontier Assets Highlight */}
      <section id="assets" className="py-12 border-y border-slate-900 bg-[#090f18]/60">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#38B6FF]/10 border border-[#38B6FF]/30 flex items-center justify-center text-[#38B6FF] shrink-0">
              <span className="font-mono font-bold text-lg">$</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-semibold text-lg text-white">USDG Settlement</h3>
                <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Primary Asset
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-400">
                Institutional-grade USDG stablecoin support with stealth receiver addresses and screened privacy pools on Robinhood Chain.
              </p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#38B6FF]/10 border border-[#38B6FF]/30 flex items-center justify-center text-[#38B6FF] shrink-0">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-semibold text-lg text-white">Native ETH Gas & Transfers</h3>
                <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-sky-500/10 text-[#38B6FF] border border-sky-500/20">
                  Chain ID 4663
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-400">
                Settles on Robinhood Chain Arbitrum L2 using native ETH gas, low-latency execution, and ERC-4337 account abstraction.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2-of-3 Shard Architecture */}
      <section id="shards" className="py-24 px-6 max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-display font-medium text-white">
            The 2-of-3 Shard Quorum
          </h2>
          <p className="mt-3 text-slate-400 text-sm md:text-base">
            Your full private key is never assembled or stored anywhere. Any two shards can spend; no single party ever can.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Shard A */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-[#38B6FF]/40 transition group">
            <div className="w-10 h-10 rounded-lg bg-[#38B6FF]/10 text-[#38B6FF] flex items-center justify-center mb-4 group-hover:scale-105 transition">
              <KeyRound className="w-5 h-5" />
            </div>
            <div className="text-xs font-mono text-[#38B6FF] uppercase tracking-wider">Shard A</div>
            <h3 className="text-lg font-semibold text-white mt-1">Client Device</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Stored locally on your machine, encrypted at rest via native OS keystores (macOS Keychain, Windows Credential Manager, Linux Secret Service).
            </p>
            <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-500">
              Protects against server-side compromise.
            </div>
          </div>

          {/* Shard B */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-[#38B6FF]/40 transition group">
            <div className="w-10 h-10 rounded-lg bg-[#38B6FF]/10 text-[#38B6FF] flex items-center justify-center mb-4 group-hover:scale-105 transition">
              <Server className="w-5 h-5" />
            </div>
            <div className="text-xs font-mono text-[#38B6FF] uppercase tracking-wider">Shard B</div>
            <h3 className="text-lg font-semibold text-white mt-1">Co-Signer Service</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Hosted in isolated HSM infrastructure. Evaluates automated policy limits, rate checks, and zero-knowledge co-signing triggers.
            </p>
            <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-500">
              Protects against stolen physical laptops or malware.
            </div>
          </div>

          {/* Shard C */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-[#38B6FF]/40 transition group">
            <div className="w-10 h-10 rounded-lg bg-[#38B6FF]/10 text-[#38B6FF] flex items-center justify-center mb-4 group-hover:scale-105 transition">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div className="text-xs font-mono text-[#38B6FF] uppercase tracking-wider">Shard C</div>
            <h3 className="text-lg font-semibold text-white mt-1">Passkey Recovery</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              WebAuthn / Secure Enclave hardware passkey. Shard B + Shard C enable full recovery if your desktop hard drive is wiped.
            </p>
            <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-500">
              Eliminates recovery seed phrase vulnerabilities.
            </div>
          </div>
        </div>
      </section>

      {/* Code / SDK Section */}
      <section id="sdk" className="py-20 border-t border-slate-900 bg-[#070b12]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <div className="text-xs font-mono text-[#38B6FF] uppercase tracking-wider">Developer Toolkit</div>
              <h2 className="text-3xl font-display font-medium text-white mt-1">
                @privatum/robinhood-chain-sdk
              </h2>
              <p className="text-slate-400 text-sm mt-2">
                Viem-native TypeScript SDK for programmatic threshold signing and private transfers.
              </p>
            </div>

            {/* Install box */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl font-mono text-xs text-slate-300">
              <span className="text-[#38B6FF]">$</span>
              <span>{sdkInstallCommand}</span>
              <button
                onClick={handleCopy}
                className="ml-2 p-1 text-slate-400 hover:text-white transition"
                title="Copy command"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Code snippet block */}
          <div className="rounded-2xl border border-slate-800 bg-[#0c1320] overflow-hidden shadow-2xl">
            <div className="px-5 py-3 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="ml-3 font-mono text-xs text-slate-400">transfer-example.ts</span>
              </div>
              <span className="text-xs font-mono text-slate-500">TypeScript / Viem</span>
            </div>

            <pre className="p-6 text-xs md:text-sm font-mono text-slate-300 overflow-x-auto leading-relaxed">
{`import { Shard, PrivatumWallet, sendUsdg } from "@privatum/robinhood-chain-sdk";

// 1. Load threshold shards (2-of-3 quorum)
const driveShard = await Shard.loadFromKeyring("drive");
const serverShard = await Shard.createRemoteCosigner("https://api.privatumrh.com");
const recoveryShard = await Shard.loadPasskey();

// 2. Assemble threshold smart account on Robinhood Chain (ID: 4663)
const wallet = PrivatumWallet.twoOfThree({
  shards: [driveShard, serverShard, recoveryShard],
  threshold: 2,
  chainId: 4663,
});

// 3. Dispatch private USDG transfer with Shards A & B
const txHash = await sendUsdg({
  wallet,
  to: "recipient.privatum",
  amount: "250.0", // 250 USDG
  signingShards: [driveShard, serverShard],
});

console.log(\`Settled on Robinhood Chain: https://robinhoodchain.blockscout.com/tx/\${txHash}\`);`}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}
