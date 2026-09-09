import { createRootRoute, Outlet, Link } from "@tanstack/react-router";
import { Shield, Github } from "lucide-react";

export const Route = createRootRoute({
  component: () => (
    <div className="min-h-screen flex flex-col bg-[#080d14] text-slate-100 font-sans selection:bg-[#38B6FF]/30 selection:text-[#38B6FF]">
      {/* Navigation */}
      <header className="border-b border-slate-800/80 bg-[#080d14]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-slate-900 border border-[#38B6FF]/40 flex items-center justify-center text-[#38B6FF] group-hover:border-[#38B6FF] transition">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="font-display font-semibold tracking-wider text-lg text-white">PRIVATUM</span>
              <span className="ml-2 text-xs font-mono uppercase px-1.5 py-0.5 rounded bg-[#38B6FF]/10 text-[#38B6FF] border border-[#38B6FF]/20">
                Robinhood Chain
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-6 text-sm text-slate-400">
            <a href="#shards" className="hover:text-white transition">Architecture</a>
            <a href="#assets" className="hover:text-white transition">USDG & ETH</a>
            <a href="#sdk" className="hover:text-white transition">SDK</a>
            <a
              href="https://github.com/notadeveloper7/privatum"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-slate-300 hover:text-white transition px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60"
            >
              <Github className="w-4 h-4" />
              <span>GitHub</span>
            </a>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-10 bg-[#060a10]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span className="font-display text-slate-300 font-semibold">PRIVATUM</span>
            <span>·</span>
            <span>Private Payments on Robinhood Chain (Chain ID: 4663)</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="mailto:security@privatumrh.com" className="hover:text-slate-300 transition">Security</a>
            <a href="https://github.com/notadeveloper7/privatum" className="hover:text-slate-300 transition">Open Source</a>
            <span>MIT License</span>
          </div>
        </div>
      </footer>
    </div>
  ),
});
