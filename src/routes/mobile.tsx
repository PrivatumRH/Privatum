import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Download,
  Smartphone,
  Shield,
  Zap,
  Sliders,
  BookUser,
  Link2,
  Lock,
  ArrowRight,
  Check,
  ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/mobile")({
  component: MobilePage,
  head: () => ({
    meta: [
      { title: "PRIVATUM Mobile: Private Payments on Robinhood Chain" },
      {
        name: "description",
        content:
          "Self-custodial mobile smart wallet for Robinhood Chain. Threshold 2-of-3 custody, spending guardrails, and disposable pay links.",
      },
    ],
  }),
});

const API_BASE = import.meta.env.VITE_BACKEND_URL || "https://api.privatumrh.com";
const FALLBACK_APK_URL = "https://github.com/PrivatumRH/privatum/releases/latest/download/privatum-mobile.apk";

interface MobileReleaseInfo {
  version: string;
  releaseName: string;
  publishedAt?: string;
  android?: {
    filename: string;
    size?: number;
    url: string;
    directUrl?: string;
  };
}

const CORE_CAPABILITIES = [
  {
    icon: Shield,
    title: "2-of-3 Threshold Security",
    desc: "Shard A encrypted on device, Shard B automated co-signer policy, Shard C passkey recovery. Zero seed phrase risk.",
  },
  {
    icon: Zap,
    title: "Robinhood Chain Native",
    desc: "Built for Robinhood Chain (Arbitrum L2, Chain ID 4663). Native settlement for USDG stablecoin and ETH.",
  },
  {
    icon: Sliders,
    title: "Spending Guardrails",
    desc: "Set real-time single-transfer caps, rolling 24-hour spend limits, and strict enforcement directly from mobile settings.",
  },
  {
    icon: BookUser,
    title: "Address Poisoning Defense",
    desc: "Encrypted local address book with look-alike character spoofing detection to protect against copycat addresses.",
  },
  {
    icon: Link2,
    title: "Disposable Pay Links",
    desc: "Generate single-use payment URLs for invoices or peer requests that auto-sweep funds directly into your smart account.",
  },
  {
    icon: Lock,
    title: "One-Tap Panic Freeze",
    desc: "Instantly halt automated co-signing via TOTP authenticator code if your phone is lost or compromised.",
  },
];

const INSTALL_STEPS = [
  {
    step: "1",
    title: "Download APK",
    desc: "Download privatum-mobile.apk directly to your Android phone.",
  },
  {
    step: "2",
    title: "Enable Installation",
    desc: "Allow install from your browser or file manager when prompted.",
  },
  {
    step: "3",
    title: "Initialize Account",
    desc: "Create your 2-of-3 smart account with local Shard A encryption.",
  },
];

function MobilePage() {
  const [releaseInfo, setReleaseInfo] = useState<MobileReleaseInfo | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string>(`${API_BASE}/v1/downloads/android`);

  useEffect(() => {
    let cancelled = false;
    async function loadRelease() {
      try {
        const res = await fetch(`${API_BASE}/v1/downloads/mobile/latest`);
        if (res.ok && !cancelled) {
          const data: MobileReleaseInfo = await res.json();
          setReleaseInfo(data);
          if (data.android?.directUrl) {
            setDownloadUrl(data.android.directUrl);
          }
        }
      } catch {
        // Fall back to direct release download URL
        if (!cancelled) {
          setDownloadUrl(FALLBACK_APK_URL);
        }
      }
    }
    void loadRelease();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-[#ffffff] font-['Inter',sans-serif] selection:bg-[#f54842]/30 selection:text-[#ffffff]">
      {/* Header Navigation */}
      <header className="border-b border-[#27272a] bg-[#0a0a0b]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <img
              alt="PRIVATUM logo"
              src="/assets/privatum-mark-black.png"
              className="w-7 h-7 invert object-contain"
            />
            <span className="font-bold text-lg tracking-tight text-[#ffffff]">PRIVATUM</span>
          </a>

          <nav className="flex items-center gap-6 text-sm">
            <a href="/" className="text-[#a1a1aa] hover:text-[#ffffff] transition-colors hidden sm:inline-block">
              Home
            </a>
            <a href="/#download" className="text-[#a1a1aa] hover:text-[#ffffff] transition-colors hidden sm:inline-block">
              Desktop
            </a>
            <a href="/docs.html" className="text-[#a1a1aa] hover:text-[#ffffff] transition-colors hidden sm:inline-block">
              Docs
            </a>
            <a
              href="https://github.com/PrivatumRH/privatum"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#a1a1aa] hover:text-[#ffffff] transition-colors flex items-center gap-1.5"
            >
              <span>GitHub</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        {/* Hero Section */}
        <div className="max-w-3xl mx-auto text-center mb-16 sm:mb-24">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#f54842] tracking-wider uppercase mb-4">
            <Smartphone className="w-4 h-4" />
            <span>Mobile Self-Custody</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#ffffff] mb-6 leading-tight">
            Private payments on Robinhood Chain, in your pocket.
          </h1>

          <p className="text-base sm:text-lg text-[#a1a1aa] leading-relaxed mb-10">
            A fast, non-custodial mobile wallet built for Robinhood Chain. Threshold 2-of-3 quorum,
            in-app spending guardrails, and disposable pay links without seed phrase vulnerabilities.
          </p>

          {/* Quick Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={downloadUrl}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-3.5 rounded-xl bg-[#f54842] text-[#ffffff] font-semibold text-sm hover:bg-[#d93832] transition-colors shadow-lg shadow-[#f54842]/20"
            >
              <Download className="w-4 h-4" />
              <span>Download for Android (APK)</span>
            </a>

            <div className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl border border-[#27272a] bg-[#141416] text-[#a1a1aa] text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-[#f54842]/60 animate-pulse" />
              <span>iOS: Coming soon</span>
            </div>
          </div>

          {releaseInfo?.version && (
            <p className="text-xs text-[#71717a] mt-4">
              Latest release: {releaseInfo.version} • Android 8.0+ (ARM64 / x86_64)
            </p>
          )}
        </div>

        {/* Feature Grid */}
        <div className="mb-20 sm:mb-28">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#ffffff] mb-3">
              Engineered for Mobile Freedom
            </h2>
            <p className="text-sm sm:text-base text-[#a1a1aa] max-w-xl mx-auto">
              Everything you need to transact safely on Robinhood Chain without central counterparty risk.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CORE_CAPABILITIES.map((cap) => {
              const Icon = cap.icon;
              return (
                <div
                  key={cap.title}
                  className="rounded-2xl border border-[#27272a] bg-[#111113] p-6 hover:border-[#3f3f46] transition-colors flex flex-col justify-between"
                >
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-[#18181b] border border-[#27272a] flex items-center justify-center text-[#f54842] mb-5">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-semibold text-[#ffffff] mb-2">{cap.title}</h3>
                    <p className="text-sm text-[#a1a1aa] leading-relaxed">{cap.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Download & Platform Availability Section */}
        <div className="rounded-3xl border border-[#27272a] bg-[#111113] p-6 sm:p-12 mb-20">
          <div className="max-w-2xl mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#ffffff] tracking-tight mb-3">
              Get the App
            </h2>
            <p className="text-sm sm:text-base text-[#a1a1aa]">
              Install the Android APK directly today. iOS TestFlight and App Store distribution are currently in progress.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Android Card */}
            <div className="rounded-2xl border border-[#27272a] bg-[#18181b] p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-[#ffffff]">Android</h3>
                  <span className="text-xs text-[#a1a1aa]">Ready to Install</span>
                </div>
                <p className="text-sm text-[#a1a1aa] mb-6">
                  Direct standalone APK package for all modern Android phones and tablets.
                </p>

                <ul className="space-y-2.5 text-xs text-[#d4d4d8] mb-8">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#f54842]" />
                    <span>Native Robinhood Chain execution (Chain ID 4663)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#f54842]" />
                    <span>Full 2-of-3 threshold custody with local Shard A</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#f54842]" />
                    <span>In-app spending limits and private address book</span>
                  </li>
                </ul>
              </div>

              <a
                href={downloadUrl}
                className="inline-flex items-center justify-center gap-2.5 w-full py-3.5 rounded-xl bg-[#f54842] text-[#ffffff] font-semibold text-sm hover:bg-[#d93832] transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download Android APK</span>
              </a>
            </div>

            {/* iOS Card */}
            <div className="rounded-2xl border border-[#27272a] bg-[#18181b] p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-[#ffffff]">iOS</h3>
                  <span className="text-xs text-[#f54842] font-medium">Coming Soon</span>
                </div>
                <p className="text-sm text-[#a1a1aa] mb-6">
                  Apple TestFlight beta and App Store release are currently undergoing packaging and review.
                </p>

                <ul className="space-y-2.5 text-xs text-[#71717a] mb-8">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#71717a]" />
                    <span>Apple Secure Enclave Shard A storage</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#71717a]" />
                    <span>Face ID and Touch ID biometric authentication</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#71717a]" />
                    <span>Public TestFlight link will be announced on X</span>
                  </li>
                </ul>
              </div>

              <div className="inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-xl border border-[#27272a] bg-[#141416] text-[#71717a] text-sm font-medium cursor-not-allowed">
                <span>iOS Build In Progress</span>
              </div>
            </div>
          </div>
        </div>

        {/* Installation Guide */}
        <div className="mb-20">
          <h2 className="text-xl sm:text-2xl font-bold text-[#ffffff] tracking-tight mb-8 text-center">
            How to Install the Android APK
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {INSTALL_STEPS.map((item) => (
              <div
                key={item.step}
                className="rounded-2xl border border-[#27272a] bg-[#111113] p-6 text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-[#18181b] border border-[#27272a] flex items-center justify-center text-xs font-bold text-[#f54842] mb-4">
                  {item.step}
                </div>
                <h3 className="text-base font-semibold text-[#ffffff] mb-2">{item.title}</h3>
                <p className="text-sm text-[#a1a1aa] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#27272a] bg-[#0a0a0b] py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#71717a]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#a1a1aa]">PRIVATUM</span>
            <span>Robinhood Chain L2 (Chain ID 4663)</span>
          </div>
          <div>© 2026 Privatum. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
