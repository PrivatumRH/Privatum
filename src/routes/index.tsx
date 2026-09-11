import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { LanguageToggle } from "@/components/LanguageToggle";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const STACK_CHIPS = [
  { name: "Robinhood Chain", sub: "Arbitrum L2 (Chain ID 4663)" },
  { name: "USDG & Native ETH", sub: "Frontier settlement assets" },
  { name: "2-of-3 Quorum", sub: "ECDSA shard aggregation" },
  { name: "Co-Signer Engine", sub: "Automated spend & velocity policies" },
  { name: "ERC-4337 v0.6", sub: "Smart accounts & UserOps" },
  { name: "Passkeys / WebAuthn", sub: "Hardware recovery Shard C" },
  { name: "Viem Open SDK", sub: "@privatumrh/robinhood-chain-sdk" },
  { name: "Tauri v2 Desktop", sub: "Encrypted OS keystores" },
  { name: "ERC-5564 Stealth", sub: "One-time destination addresses" },
  { name: "Screened Pools", sub: "Association-set ZK proofs" },
];

/** Bridge rebate programme: users earn a share of the Relay relayer spread, paid in PRIV. */
const REBATE_PERCENT = 25;

/** PRIV (PrivatumRH) - 18 decimals, deployed on Robinhood Chain only. */
const PRIV_TOKEN_ADDRESS = "0xee2ddd7128c291b027712eca157b3ff31a55a05a";

const BRIDGE_CHAINS = [
  { id: 1, name: "Ethereum" },
  { id: 8453, name: "Base" },
  { id: 42161, name: "Arbitrum" },
  { id: 4663, name: "Robinhood Chain" },
];

const REBATE_STEPS = [
  {
    title: "Bridge through Privatum",
    copy: "Move ETH or USDG between Ethereum, Base, Arbitrum and Robinhood Chain. Routing and quotes come from Relay.",
  },
  {
    title: "The spread is measured, not estimated",
    copy: "Every quote separates destination gas from the relayer's margin. Only that margin - the spread - is rebated.",
  },
  {
    title: "Claim in PRIV on Robinhood Chain",
    copy: "Rebates accrue once a bridge settles and are claimable in PRIV, with the amount fixed at the price on claim.",
  },
];

const FAQS = [
  {
    q: "What does Privatum do?",
    a: "Privatum is a self-custodial smart wallet and open developer toolkit engineered for Robinhood Chain (Arbitrum-powered EVM L2, Chain ID 4663). It enables individuals and automated workflows to hold, send, and swap frontier assets (specifically USDG and native ETH) with zero single points of failure.",
  },
  {
    q: "How does 2-of-3 threshold custody work?",
    a: "Your private key is mathematically split into three independent shards: Shard A on your local device (stored encrypted in OS keystores), Shard B with the automated co-signer policy service, and Shard C in hardware passkey recovery. Any two shards can authorize transactions or recover access. No single party, not even Privatum, can ever move your funds.",
  },
  {
    q: "How does the 5-step signing pipeline work?",
    a: "1) Build: Desktop or SDK creates an unsigned ERC-4337 UserOperation for USDG or ETH transfer. 2) Client Sign: Local device decrypts Shard A via device credentials and signs the userOpHash. 3) Co-Sign: Dispatched over TLS to the Co-Signer API, which evaluates velocity and daily limits before signing with Shard B. 4) Combine: Two 65-byte signatures merge into an aggregate 130-byte threshold signature (sigA || sigB). 5) Settle: Broadcast to the Robinhood Chain bundler and validated by the PrivatumAccount smart contract onchain.",
  },
  {
    q: "What happens if I lose my computer?",
    a: "If your client device is lost, Shard C (Passkey Recovery) combines with Shard B (Co-signer) to initiate emergency key rotation or fund migration without exposing a seed phrase.",
  },
  {
    q: "Does Privatum have custody of funds?",
    a: "No. Privatum operates only the automated co-signer shard (Shard B). Because every transaction strictly requires 2-of-3 quorum signatures, Privatum cannot unilaterally move any assets.",
  },
  {
    q: "Which network and assets does Privatum support?",
    a: "Privatum is built natively for Robinhood Chain (Arbitrum-powered EVM L2, Chain ID 4663, ETH gas token), natively settling and routing frontier assets: USDG stablecoin and native ETH.",
  },
  {
    q: "What are the Co-Signer API endpoints?",
    a: "The co-signer service exposes GET /health (service health and Chain ID 4663 check), POST /v1/wallets (registration of 2-of-3 threshold accounts), and POST /v1/cosign (policy verification and Shard B co-signing).",
  },
  {
    q: "When will native privacy launch?",
    a: "The roadmap moves from Phase 1 (Robinhood Chain Custody MVP) and Phase 2 (Open SDK) to Phase 3 (DEX Aggregation & USDG/ETH Swaps), Phase 4 (Privacy Plane One: Threshold ECDSA & Blind Co-signing), Phase 5 (Privacy Plane Two: ERC-5564 Stealth Addresses & Screened Pools), and Phase 6 (Multichain Expansion).",
  },
];

/**
 * Interactive helper state and platform configurations.
 */
type PlatformKey = "windows" | "macos" | "linux";

interface PlatformDetails {
  key: PlatformKey;
  name: string;
  badge: string;
  ext: string;
  filename: string;
  osRequirement: string;
  downloadUrl: string;
  commandSnippet?: string;
  instructions: string;
}

const PLATFORM_DATA: Record<PlatformKey, PlatformDetails> = {
  windows: {
    key: "windows",
    name: "Windows",
    badge: "x64 installer",
    ext: ".exe setup",
    filename: "PRIVATUM_0.1.0_x64-setup.exe",
    osRequirement: "Windows 10, 11 (64-bit)",
    downloadUrl: "https://api.privatumrh.com/v1/downloads/windows",
    instructions: "Run PRIVATUM_0.1.0_x64-setup.exe to install Privatum on your system.",
  },
  macos: {
    key: "macos",
    name: "macOS",
    badge: "Apple Silicon",
    ext: ".dmg / .app",
    filename: "PRIVATUM_aarch64.app.tar.gz",
    osRequirement: "macOS 11.0 Big Sur or later (Apple Silicon)",
    downloadUrl: "https://api.privatumrh.com/v1/downloads/macos",
    instructions: "Extract archive and drag Privatum into Applications.",
  },
  linux: {
    key: "linux",
    name: "Linux",
    badge: "Debian & AppImage",
    ext: ".deb / AppImage",
    filename: "PRIVATUM_0.1.0_amd64.deb",
    osRequirement: "Ubuntu, Debian, Fedora, Arch Linux",
    downloadUrl: "https://api.privatumrh.com/v1/downloads/linux",
    commandSnippet: "sudo dpkg -i PRIVATUM_0.1.0_amd64.deb",
    instructions: "Install package using dpkg or execute AppImage directly.",
  },
};

function WindowsIcon({ className = "pv-icon" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.902-1.849" />
    </svg>
  );
}

function AppleIcon({ className = "pv-icon" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-1.98.6-2.61 1.34-.56.64-1.04 1.69-.91 2.71 1 .08 2-.45 2.6-1.2z" />
    </svg>
  );
}

function LinuxIcon({ className = "pv-icon" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M12.002 0c-2.88 0-4.78 1.99-4.78 4.96 0 1.25.39 2.55.93 3.48-.12.35-.2.72-.2 1.11 0 .28.05.54.12.8-1.55 1.12-2.63 2.92-2.63 4.97 0 2.42 1.48 4.54 3.62 5.48-.17.65-.28 1.33-.28 2.04 0 .38.04.75.09 1.11H4.49a.75.75 0 0 0 0 1.5h15.02a.75.75 0 0 0 0-1.5h-4.38c.05-.36.09-.73.09-1.11 0-.71-.11-1.39-.28-2.04 2.14-.94 3.62-3.06 3.62-5.48 0-2.05-1.08-3.85-2.63-4.97.07-.26.12-.52.12-.8 0-.39-.08-.76-.2-1.11.54-.93.93-2.23.93-3.48C16.782 1.99 14.882 0 12.002 0zm0 1.5c2.05 0 3.28 1.42 3.28 3.46 0 1.09-.37 2.27-.88 3.09a.75.75 0 0 0-.13.43c0 .54.16 1.06.42 1.52.26.46.6.85 1.02 1.14.93.65 1.57 1.71 1.57 2.91 0 1.96-1.57 3.55-3.52 3.55a.75.75 0 0 0-.74.65c-.17.98-.6 1.87-1.22 2.6-.08.09-.16.18-.24.26-.08-.08-.16-.17-.24-.26-.62-.73-1.05-1.62-1.22-2.6a.75.75 0 0 0-.74-.65c-1.95 0-3.52-1.59-3.52-3.55 0-1.2.64-2.26 1.57-2.91.42-.29.76-.68 1.02-1.14.26-.46.42-.98.42-1.52 0-.15-.05-.3-.13-.43-.51-.82-.88-2-.88-3.09C8.722 2.92 9.952 1.5 12.002 1.5z" />
    </svg>
  );
}

function DownloadIcon({ className = "pv-icon" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function CopyIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function DexscreenerIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12.016 2.016a9.984 9.984 0 1 0 9.984 9.984A10.012 10.012 0 0 0 12.016 2.016Zm3.784 14.17-1.35-1.35a3.42 3.42 0 0 1-4.85 0l-1.35 1.35a5.33 5.33 0 0 0 7.55 0Zm.84-2.82-1.35-1.35a1.51 1.51 0 0 0-2.14 0l-1.35 1.35a3.42 3.42 0 0 1 4.84 0Z" />
    </svg>
  );
}

function ExternalLinkIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function ContractAddressBadge() {
  const caAddress = (import.meta.env.VITE_CA_ADDRESS as string | undefined)?.trim() || "";
  const isLive = Boolean(caAddress);
  const [copied, setCopied] = useState(false);

  const displayAddress = isLive
    ? caAddress.length > 16
      ? `${caAddress.slice(0, 6)}...${caAddress.slice(-4)}`
      : caAddress
    : "Coming Soon";

  const dexscreenerUrl = isLive
    ? `https://dexscreener.com/search?q=${encodeURIComponent(caAddress)}`
    : "https://dexscreener.com";

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const textToCopy = isLive ? caAddress : "Coming Soon";
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="hero-ca-wrapper">
      <div className="hero-ca-card">
        <div className="hero-ca-status">
          <span className="hero-ca-label">CA:</span>
          <span className="hero-ca-value" title={isLive ? caAddress : "Contract Address Coming Soon"}>
            {displayAddress}
          </span>
        </div>

        <div className="hero-ca-divider" />

        <div className="hero-ca-actions">
          <button
            type="button"
            onClick={handleCopy}
            className={`hero-ca-copy-btn ${copied ? "is-copied" : ""}`}
            title={copied ? "Copied to clipboard!" : isLive ? "Copy contract address" : "Copy"}
            aria-label="Copy contract address"
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>

          <a
            href={dexscreenerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hero-ca-dex-btn"
            title={isLive ? "Open in Dexscreener" : "Dexscreener (Token Coming Soon)"}
            aria-label="Open in Dexscreener"
          >
            <DexscreenerIcon />
            <ExternalLinkIcon />
          </a>
        </div>
      </div>
    </div>
  );
}

function DownloadCta({
  className = "primary-button w-inline-block",
  textClassName = "primary-button-text",
  style,
  label,
  href,
  platform,
  onClick,
}: {
  className?: string;
  textClassName?: string;
  style?: React.CSSProperties;
  label?: string;
  href?: string;
  platform?: PlatformKey;
  onClick?: () => void;
}) {
  const [detectedPlatform, setDetectedPlatform] = useState<PlatformKey>("windows");

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = (navigator.userAgent || "").toLowerCase();
    if (/mac|iphone|ipad|ipod/.test(ua)) {
      setDetectedPlatform("macos");
    } else if (/linux/.test(ua)) {
      setDetectedPlatform("linux");
    } else {
      setDetectedPlatform("windows");
    }
  }, []);

  const activePlat = platform || detectedPlatform;
  const targetHref = href || PLATFORM_DATA[activePlat].downloadUrl;
  const displayLabel = label || `Download for ${PLATFORM_DATA[activePlat].name}`;

  return (
    <a
      className={className}
      href={targetHref}
      style={style}
      onClick={onClick}
    >
      <div className="primary-button-wrap" style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
        <DownloadIcon />
        <div className={textClassName}>{displayLabel}</div>
      </div>
    </a>
  );
}

function LandingPage() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<number>(1);
  const [productSlide, setProductSlide] = useState(0);
  const [complianceSlide, setComplianceSlide] = useState(0);
  const [activeReliability, setActiveReliability] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [soonTip, setSoonTip] = useState<string | null>(null);
  const [timelineProgress, setTimelineProgress] = useState("0.500");
  const [timelineVisible, setTimelineVisible] = useState(false);
  const [detectedPlatform, setDetectedPlatform] = useState<PlatformKey>("windows");
  const [releaseInfo, setReleaseInfo] = useState<{
    version: string;
    downloads?: Record<string, { filename: string; size?: number }>;
  } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = (navigator.userAgent || "").toLowerCase();
    if (/mac|iphone|ipad|ipod/.test(ua)) {
      setDetectedPlatform("macos");
    } else if (/linux/.test(ua)) {
      setDetectedPlatform("linux");
    } else {
      setDetectedPlatform("windows");
    }
  }, []);

  useEffect(() => {
    fetch("https://api.privatumrh.com/v1/downloads/latest")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.version) {
          setReleaseInfo(data);
        }
      })
      .catch(() => {});
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Show roadmap items smoothly on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setTimelineVisible(true);
      setTimelineProgress("0.667");
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const triggerSoon = (e: React.SyntheticEvent, name: string) => {
    e.preventDefault();
    setSoonTip(name);
    setTimeout(() => setSoonTip((curr) => (curr === name ? null : curr)), 2200);
  };

  return (
    <div className="page-wrapper">
      {/* Navigation Bar */}
      <div
        className="navbar w-nav"
        data-animation="default"
        data-collapse="medium"
        data-duration="400"
        role="banner"
      >
        <div className="nav-wrapper">
          <div className="container-large nav">
            <a aria-current="page" className="brand-link w-inline-block w--current" href="/">
              <img alt="PRIVATUM logo" loading="lazy" src="/assets/privatum-mark-black.png" />
            </a>

            {/* Desktop and Tablet Nav Menu */}
            <nav className="nav-menu w-nav-menu" role="navigation">
              {/* Product Mega Menu Dropdown */}
              <div
                ref={dropdownRef}
                className={`dropdown w-dropdown ${dropdownOpen ? "w--open" : ""}`}
                onMouseEnter={() => setDropdownOpen(true)}
                onMouseLeave={() => setDropdownOpen(false)}
              >
                <div
                  className={`dropdown-toggle w-dropdown-toggle ${dropdownOpen ? "w--open" : ""}`}
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="link">Product</div>
                  <svg
                    className="dropdown-icon"
                    fill="none"
                    viewBox="0 0 11 6"
                    width="100%"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{
                      transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s ease",
                    }}
                  >
                    <path
                      d="M9.87223 1.12278L5.49723 5.49778C5.43626 5.55896 5.36382 5.6075 5.28405 5.64062C5.20428 5.67375 5.11876 5.6908 5.03239 5.6908C4.94602 5.6908 4.86049 5.67375 4.78073 5.64062C4.70096 5.6075 4.62851 5.55896 4.56754 5.49778L0.192545 1.12278C0.0692604 0.999495 -1.83708e-09 0.832285 0 0.657935C1.83708e-09 0.483585 0.0692604 0.316376 0.192545 0.193091C0.315829 0.0698072 0.483038 0.000546994 0.657388 0.000546992C0.831739 0.00054699 0.998948 0.0698072 1.12223 0.193091L5.03294 4.10379L8.94364 0.192545C9.06692 0.0692606 9.23413 0 9.40848 0C9.58283 0 9.75004 0.0692606 9.87333 0.192545C9.99661 0.315829 10.0659 0.483038 10.0659 0.657389C10.0659 0.831739 9.99661 0.998948 9.87333 1.12223L9.87223 1.12278Z"
                      fill="currentColor"
                    />
                  </svg>
                </div>

                <nav
                  className={`dropdown-list w-dropdown-list ${dropdownOpen ? "w--open" : ""}`}
                  style={{ display: dropdownOpen ? "flex" : "none" }}
                >
                  <div className="dropdown-list_inner_wrapper">
                    <div className="dropdown-cards_wrapper">
                      <div className="heading-style-h4">
                        Try
                        <br />
                        Privatum
                      </div>
                      <div className="dropdown-card_texts">
                        <p className="text-size-small">Why choose Privatum for private self-custody?</p>
                        <DownloadCta
                          className="primary-button w-variant-fb78eba0-dd3e-a77a-385e-cc8838022b83 w-inline-block"
                          label="Download App"
                          href="#download"
                          onClick={() => setDropdownOpen(false)}
                        />
                      </div>
                    </div>

                    <div className="drop-down_links">
                      <div className="dropdown-links_wrapper">
                        <div className="nav-heading">Main Pages</div>
                        <div className="dropdown-links">
                          <a className="inner-link w-inline-block" href="#download" onClick={() => setDropdownOpen(false)}>
                            <div>Download</div>
                          </a>
                          <a className="inner-link w-inline-block" href="#overview" onClick={() => setDropdownOpen(false)}>
                            <div>Overview</div>
                          </a>
                          <a className="inner-link w-inline-block" href="#pipeline" onClick={() => setDropdownOpen(false)}>
                            <div>Signing Pipeline</div>
                          </a>
                          <a className="inner-link w-inline-block" href="#security" onClick={() => setDropdownOpen(false)}>
                            <div>Security</div>
                          </a>
                          <a className="inner-link w-inline-block" href="#rebates" onClick={() => setDropdownOpen(false)}>
                            <div>Bridge Rebates</div>
                          </a>
                          <a className="inner-link w-inline-block" href="#roadmap" onClick={() => setDropdownOpen(false)}>
                            <div>Roadmap</div>
                          </a>
                          <a className="inner-link w-inline-block" href="/case-study.html">
                            <div>Case Studies</div>
                          </a>
                          <a className="inner-link w-inline-block" href="/docs.html">
                            <div>Docs</div>
                          </a>
                        </div>
                      </div>

                      <div className="dropdown-links_wrapper">
                        <div className="nav-heading">Product</div>
                        <div className="dropdown-links">
                          <a
                            aria-disabled="true"
                            className={`inner-link w-inline-block ${soonTip === "Private Send" ? "is-soon" : ""}`}
                            data-soon="Private Send"
                            href="#"
                            onClick={(e) => triggerSoon(e, "Private Send")}
                          >
                            <div>Private Send</div>
                          </a>
                          <a
                            aria-disabled="true"
                            className={`inner-link w-inline-block ${soonTip === "Stealth Receive" ? "is-soon" : ""}`}
                            data-soon="Stealth Receive"
                            href="#"
                            onClick={(e) => triggerSoon(e, "Stealth Receive")}
                          >
                            <div>Stealth Receive</div>
                          </a>
                          <a
                            aria-disabled="true"
                            className={`inner-link w-inline-block ${soonTip === "Swaps" ? "is-soon" : ""}`}
                            data-soon="Swaps"
                            href="#"
                            onClick={(e) => triggerSoon(e, "Swaps")}
                          >
                            <div>Swaps</div>
                          </a>
                          <a className="inner-link w-inline-block" href="/docs.html#sdk">
                            <div>Open SDK</div>
                          </a>
                        </div>
                      </div>

                      <div className="dropdown-links_wrapper">
                        <div className="nav-heading">Research</div>
                        <div className="dropdown-links">
                          <a className="inner-link w-inline-block" href="/case-study/higher-lead-conversion.html">
                            <div>Research</div>
                          </a>
                          <a className="inner-link w-inline-block" href="/docs.html#sdk">
                            <div>SDK Docs</div>
                          </a>
                          <a
                            className="inner-link w-inline-block"
                            href="https://www.npmjs.com/package/@privatumrh/robinhood-chain-sdk"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <div>SDK on npm</div>
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="dropdown-socials_wrapper">
                      <a
                        aria-label="PRIVATUM on X"
                        className="w-inline-block"
                        href="https://x.com/privatumrh"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <div className="social">
                          <svg fill="none" viewBox="0 0 24 24" width="100%" xmlns="http://www.w3.org/2000/svg">
                            <path
                              d="M18.9 2H22L15.2 9.8L23.3 22H17L12.1 15.6L6.5 22H3.3L10.6 13.7L2.8 2H9.2L13.6 7.9L18.9 2ZM17.8 20.1H19.5L7.1 3.8H5.3L17.8 20.1Z"
                              fill="currentColor"
                            />
                          </svg>
                        </div>
                      </a>
                      <a
                        aria-label="PRIVATUM on GitHub"
                        className="w-inline-block"
                        href="https://github.com/PrivatumRH/privatum"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <div className="social">
                          <svg fill="none" viewBox="0 0 24 24" width="100%" xmlns="http://www.w3.org/2000/svg">
                            <path
                              fillRule="evenodd"
                              clipRule="evenodd"
                              d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                              fill="currentColor"
                            />
                          </svg>
                        </div>
                      </a>
                    </div>
                  </div>
                </nav>
              </div>

              {/* Desktop Direct Links */}
              <a className="link on-desktop" href="#pipeline">
                Pipeline
              </a>
              <a className="link on-desktop" href="#download">
                Download
              </a>
              <a className="link on-desktop" href="#rebates">
                Rebates
              </a>
              <a className="link on-desktop" href="#roadmap">
                Roadmap
              </a>
              <a className="link on-desktop" href="/case-study.html">
                Case Studies
              </a>
              <a className="link on-desktop" href="/docs.html">
                Docs
              </a>
              <a
                className="link on-desktop"
                href="https://github.com/PrivatumRH/privatum"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub &rarr;
              </a>
            </nav>

            {/* Right Nav Actions & Hamburger Button */}
            <div className="nav-right-content">
              <div
                className="menu w-nav-button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                role="button"
                tabIndex={0}
                aria-label="Toggle mobile menu"
                style={{ cursor: "pointer" }}
              >
                <div className="hamburger-lines">
                  <div
                    className="hamburger-line top"
                    style={{
                      transform: mobileMenuOpen ? "translateY(7px) rotate(45deg)" : "none",
                    }}
                  />
                  <div
                    className="hamburger-line middle"
                    style={{
                      opacity: mobileMenuOpen ? 0 : 1,
                    }}
                  />
                  <div
                    className="hamburger-line bottom"
                    style={{
                      transform: mobileMenuOpen ? "translateY(-7px) rotate(-45deg)" : "none",
                    }}
                  />
                </div>
              </div>

              <div className="nav-buttons-wrap">
                <LanguageToggle />
                <a
                  href="https://github.com/PrivatumRH/privatum"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub Repository"
                  title="View repository on GitHub"
                  className="w-inline-block"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "38px",
                    height: "38px",
                    borderRadius: "10px",
                    border: "1px solid rgba(0, 0, 0, 0.12)",
                    background: "rgba(255, 255, 255, 0.9)",
                    color: "#0e121b",
                    textDecoration: "none",
                  }}
                >
                  <svg fill="currentColor" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    />
                  </svg>
                </a>
                <a
                  href="https://www.npmjs.com/package/@privatumrh/robinhood-chain-sdk"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="npm SDK Package"
                  title="SDK on npm"
                  className="w-inline-block"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    height: "38px",
                    padding: "0 12px",
                    borderRadius: "10px",
                    border: "1px solid rgba(203, 56, 55, 0.25)",
                    background: "rgba(203, 56, 55, 0.08)",
                    color: "#cb3837",
                    fontSize: "13px",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  <svg viewBox="0 0 780 250" width="22" height="10" fill="currentColor" aria-hidden="true">
                    <path d="M240,250h100v-50h100V0H240V250z M340,50h50v100h-50V50z M480,0v200h100V50h50v150h50V50h50v150h50V0H480z M0,200h100V50h50v150h50V0H0V200z" />
                  </svg>
                  <span>SDK</span>
                </a>
                <DownloadCta
                  className="primary-button w-variant-c2dc9de4-8772-9172-2dd8-cda2f9121fc9 w-inline-block"
                  textClassName="primary-button-text w-variant-c2dc9de4-8772-9172-2dd8-cda2f9121fc9"
                  label="Download"
                  href="#download"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Slide-down Menu */}
        {mobileMenuOpen && (
          <div
            className="mobile-nav-panel"
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              left: "1rem",
              right: "1rem",
              background: "rgba(255, 255, 255, 0.98)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              borderRadius: "20px",
              padding: "1.25rem 1.25rem 1.5rem",
              boxShadow: "0 24px 48px -12px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.06)",
              zIndex: 1000,
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
            }}
          >
            {/* Top Quick Actions Section */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {/* Primary Download Button */}
              <DownloadCta
                style={{
                  width: "100%",
                  justifyContent: "center",
                  padding: "12px 20px",
                  fontSize: "15px",
                  fontWeight: 600,
                }}
                href="#download"
                onClick={() => setMobileMenuOpen(false)}
              />

              {/* GitHub & npm SDK Buttons Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem" }}>
                <a
                  href="https://github.com/PrivatumRH/privatum"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="GitHub Repository"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    height: "44px",
                    borderRadius: "12px",
                    border: "1px solid rgba(0, 0, 0, 0.12)",
                    background: "#f8f9fa",
                    color: "#0e121b",
                    fontSize: "13px",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  <svg fill="currentColor" viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    />
                  </svg>
                  <span>GitHub</span>
                </a>

                <a
                  href="https://www.npmjs.com/package/@privatumrh/robinhood-chain-sdk"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="npm SDK Package"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    height: "44px",
                    borderRadius: "12px",
                    border: "1px solid rgba(203, 56, 55, 0.25)",
                    background: "rgba(203, 56, 55, 0.08)",
                    color: "#cb3837",
                    fontSize: "13px",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  <svg viewBox="0 0 780 250" width="20" height="9" fill="currentColor" aria-hidden="true">
                    <path d="M240,250h100v-50h100V0H240V250z M340,50h50v100h-50V50z M480,0v200h100V50h50v150h50V50h50v150h50V0H480z M0,200h100V50h50v150h50V0H0V200z" />
                  </svg>
                  <span>npm SDK</span>
                </a>
              </div>

              <LanguageToggle className="lang-toggle-block" onSelect={() => setMobileMenuOpen(false)} />
            </div>

            {/* Subtle Divider */}
            <div style={{ height: "1px", background: "rgba(0, 0, 0, 0.08)" }} />

            {/* Navigation Links Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                <strong style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#687182", letterSpacing: "0.05em" }}>Pages</strong>
                <a className="link mob" href="#overview" onClick={() => setMobileMenuOpen(false)}>
                  Overview
                </a>
                <a className="link mob" href="#pipeline" onClick={() => setMobileMenuOpen(false)}>
                  Pipeline
                </a>
                <a className="link mob" href="#security" onClick={() => setMobileMenuOpen(false)}>
                  Security
                </a>
                <a className="link mob" href="#roadmap" onClick={() => setMobileMenuOpen(false)}>
                  Roadmap
                </a>
                <a className="link mob" href="/case-study.html" onClick={() => setMobileMenuOpen(false)}>
                  Case Studies
                </a>
                <a className="link mob" href="/docs.html" onClick={() => setMobileMenuOpen(false)}>
                  Docs
                </a>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                <strong style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#687182", letterSpacing: "0.05em" }}>Features</strong>
                <a
                  aria-disabled="true"
                  className={`link mob ${soonTip === "Private Send" ? "is-soon" : ""}`}
                  data-soon="Private Send"
                  href="#"
                  onClick={(e) => triggerSoon(e, "Private Send")}
                >
                  Private Send
                </a>
                <a
                  aria-disabled="true"
                  className={`link mob ${soonTip === "Stealth Receive" ? "is-soon" : ""}`}
                  data-soon="Stealth Receive"
                  href="#"
                  onClick={(e) => triggerSoon(e, "Stealth Receive")}
                >
                  Stealth Receive
                </a>
                <a
                  aria-disabled="true"
                  className={`link mob ${soonTip === "Swaps" ? "is-soon" : ""}`}
                  data-soon="Swaps"
                  href="#"
                  onClick={(e) => triggerSoon(e, "Swaps")}
                >
                  Swaps
                </a>
                <a className="link mob" href="/docs.html#sdk" onClick={() => setMobileMenuOpen(false)}>
                  Open SDK
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="main-wrapper">
        {/* HERO SECTION */}
        <section className="section hero" id="top">
          <div className="padding-global">
            <div className="container-large">
              <div className="padding-section-large hero-padding">
                <div className="hero-texts_wrapper">
                  <div className="hero-texts">
                    <div className="text-size-regular small-on-mobile">
                      Private payments. Non-custodial. On Robinhood Chain.
                    </div>
                    <h1 className="heading-style-h1">Private payments. Non-custodial.</h1>
                    <ContractAddressBadge />
                    <div className="hero-gasless-tag" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "rgba(14, 18, 27, 0.7)", fontWeight: 500, marginTop: "4px" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ color: "#f64b43" }}>
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                      <span>Stake $PRIV to unlock 100% gasless transactions sponsored by protocol.</span>
                    </div>
                  </div>
                  <div className="button-wrapper">
                    <DownloadCta />
                    <a
                      className="primary-button w-variant-3a9f2dd0-9bc7-dc9a-a7bc-93d31eb4141a w-inline-block"
                      href="/docs.html"
                    >
                      <div className="primary-button-wrap">
                        <div className="primary-button-text">Read Docs</div>
                      </div>
                    </a>
                    <a
                      className="primary-button w-variant-3a9f2dd0-9bc7-dc9a-a7bc-93d31eb4141a w-inline-block"
                      href="https://github.com/PrivatumRH/privatum"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <div className="primary-button-wrap" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <svg fill="currentColor" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                          <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                          />
                        </svg>
                        <div className="primary-button-text">GitHub</div>
                      </div>
                    </a>
                  </div>
                  <div className="hero-platforms-bar">
                    <span className="hero-platforms-label">Direct downloads:</span>
                    <a href="https://api.privatumrh.com/v1/downloads/windows" className="hero-platform-chip">
                      <WindowsIcon /> Windows (.exe)
                    </a>
                    <a href="https://api.privatumrh.com/v1/downloads/macos" className="hero-platform-chip">
                      <AppleIcon /> macOS (.dmg)
                    </a>
                    <a href="https://api.privatumrh.com/v1/downloads/linux" className="hero-platform-chip">
                      <LinuxIcon /> Linux (.deb)
                    </a>
                    <a
                      href="https://www.npmjs.com/package/@privatumrh/robinhood-chain-sdk"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hero-platform-chip"
                      style={{ color: "#cb3837", display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      <svg viewBox="0 0 780 250" width="18" height="8" fill="currentColor" aria-hidden="true">
                        <path d="M240,250h100v-50h100V0H240V250z M340,50h50v100h-50V50z M480,0v200h100V50h50v150h50V50h50v150h50V0H480z M0,200h100V50h50v150h50V0H0V200z" />
                      </svg>
                      npm SDK &rarr;
                    </a>
                    <a href="#download" className="hero-platform-chip view-all">
                      All formats &darr;
                    </a>
                  </div>
                </div>

                <div className="hero-bottom_wrapper">
                  <div className="hero-star_texts_wrapper">
                    <div className="hero-star_wrapper">
                      <div className="text-size-small">2-of-3 Threshold Custody</div>
                    </div>
                    <p className="text-size-regular">
                      Hold, send, and swap frontier assets (USDG &amp; native ETH) privately with a signing key split into three independent shards (2-of-3 quorum).
                    </p>
                  </div>

                  <div className="agent-card">
                    <div className="agent-video_wrapper">
                      <div className="full-video w-background-video w-background-video-atom">
                        <video
                          autoPlay
                          loop
                          muted
                          playsInline
                          style={{
                            backgroundImage:
                              'url("/6a5d4e514d1e968239079f7a/6a60672a861ee7ca656e087b_loop_rotation_poster.0000000.jpg")',
                            objectFit: "cover",
                            width: "100%",
                            height: "100%",
                          }}
                        >
                          <source
                            src="/6a5d4e514d1e968239079f7a/6a60672a861ee7ca656e087b_loop_rotation_mp4.mp4"
                            type="video/mp4"
                          />
                          <source
                            src="/6a5d4e514d1e968239079f7a/6a60672a861ee7ca656e087b_loop_rotation_webm.webm"
                            type="video/webm"
                          />
                        </video>
                      </div>
                    </div>
                    <div className="agent-card_texts">
                      <div className="text-size-small text-color">Network</div>
                      <div className="text-size-small">Robinhood Chain (Chain ID: 4663)</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <img
            alt="PRIVATUM gradient background"
            className="bg-image"
            loading="lazy"
            src="/assets/privatum-gradient-clean.png"
          />
        </section>

        {/* OVERVIEW SECTION */}
        <section className="section" id="overview">
          <div className="padding-global">
            <div className="container-large">
              <div className="padding-section-large padding-bottom">
                <div className="section-heading_wrapper sticky-on-mobile">
                  <div className="heading_wrapper home-heading-one">
                    <div className="text-size-tiny brand-color">Overview</div>
                    <h2 className="heading-style-h2">Why choose Privatum for private self-custody?</h2>
                  </div>
                  <p className="text-size-regular overview-para">
                    A 2-of-3 smart wallet architecture engineered for Robinhood Chain: frontier asset settlement (USDG &amp; native ETH), automated policy co-signing, and passkey recovery.
                  </p>
                </div>

                <div className="why-card_wrapper">
                  {/* Card 1 */}
                  <div className="why-card">
                    <div aria-label="Single key wallet risk visualization" className="privatum-ui-scene risk-scene" role="img">
                      <div className="ui-window-bar">
                        <span></span>
                        <span></span>
                        <span></span>
                        <small>Browser wallet</small>
                      </div>
                      <div className="risk-device">
                        <div className="ui-row">
                          <span className="ui-icon">K</span>
                          <div>
                            <b>Signing key</b>
                            <small>Stored on this device</small>
                          </div>
                          <span className="risk-status">Exposed</span>
                        </div>
                        <div className="key-line">
                          <span></span>
                          <span></span>
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                        <div className="risk-alert">
                          <i>!</i>
                          <span>
                            <b>Single point of failure</b>
                            <small>One key can authorize funds</small>
                          </span>
                        </div>
                      </div>
                      <div className="scene-scan"></div>
                    </div>
                    <div className="why-card_texts">
                      <h3 className="heading-style-h6">Single-Key Hot Wallet</h3>
                      <p className="why-card_text">
                        Stores the complete private key in one browser or device, so one compromise can authorize every transaction.
                      </p>
                    </div>
                  </div>

                  {/* Card 2 */}
                  <div className="why-card">
                    <div aria-label="Hardware wallet isolation visualization" className="privatum-ui-scene hardware-scene" role="img">
                      <div className="ui-window-bar">
                        <span></span>
                        <span></span>
                        <span></span>
                        <small>Offline signer</small>
                      </div>
                      <div className="hardware-layout">
                        <div className="hardware-device">
                          <div className="device-screen">
                            <i></i>
                            <b>Confirm</b>
                            <small>0.25 ETH</small>
                          </div>
                          <div className="device-key"></div>
                        </div>
                        <div className="hardware-steps">
                          <div className="step done">
                            <i>1</i>
                            <span>Connect device</span>
                          </div>
                          <div className="step active">
                            <i>2</i>
                            <span>Verify address</span>
                          </div>
                          <div className="step">
                            <i>3</i>
                            <span>Sign manually</span>
                          </div>
                        </div>
                      </div>
                      <div className="trust-strip">
                        <span>Firmware</span>
                        <span>Shipping</span>
                        <span>Seed phrase</span>
                      </div>
                    </div>
                    <div className="why-card_texts">
                      <h3 className="heading-style-h6">Hardware Wallet</h3>
                      <p className="why-card_text">
                        Improves offline key isolation but adds hardware cost, firmware trust, shipping friction, and seed backup burden.
                      </p>
                    </div>
                  </div>

                  {/* Card 3 */}
                  <div className="why-card top-padding">
                    <div aria-label="Two of three threshold signing visualization" className="privatum-ui-scene threshold-scene" role="img">
                      <div className="ui-window-bar">
                        <span></span>
                        <span></span>
                        <span></span>
                        <small>Threshold quorum</small>
                        <b>2 of 3 ready</b>
                      </div>
                      <div className="quorum-map">
                        <div className="quorum-node node-a approved">
                          <i>A</i>
                          <span>Desktop</span>
                          <small>Signed</small>
                        </div>
                        <div className="quorum-node node-b approved">
                          <i>B</i>
                          <span>Co-signer</span>
                          <small>Policy passed</small>
                        </div>
                        <div className="quorum-node node-c">
                          <i>C</i>
                          <span>Passkey</span>
                          <small>Recovery</small>
                        </div>
                        <svg aria-hidden="true" viewBox="0 0 440 180">
                          <path d="M95 72 C155 20 285 20 345 72"></path>
                          <path d="M100 84 C170 155 270 155 340 84"></path>
                          <path d="M220 52 L220 125"></path>
                        </svg>
                        <div className="quorum-result">
                          <i>✓</i>
                          <span>
                            <b>Quorum reached</b>
                            <small>Key never assembled</small>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="why-card_texts">
                      <h3 className="heading-style-h6">2-of-3 Threshold Quorum</h3>
                      <p className="why-card_text">
                        Splits signing authority mathematically across client Shard A (OS Keystore), Shard B (Co-signer policy engine), and Shard C (Hardware passkey). No single party can move funds.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5-STEP SIGNING PIPELINE & ARCHITECTURE SECTION */}
        <section className="section pipeline-section" id="pipeline">
          <div className="padding-global">
            <div className="container-large">
              <div className="padding-section-large padding-bottom">
                <div className="section-heading_wrapper">
                  <div className="heading_wrapper home-heading-two">
                    <div className="text-size-tiny brand-color">Architecture</div>
                    <h2 className="heading-style-h2">The 5-Step Signing Pipeline</h2>
                  </div>
                  <p className="text-size-regular highlight-heading_para">
                    Zero single points of failure. Every transaction requires off-chain ECDSA shard aggregation
                    from two independent parties before executing on Robinhood Chain.
                  </p>
                </div>

                <div className="pipeline-grid">
                  {/* Step 1 */}
                  <div className="pipeline-card">
                    <div className="pipeline-card-num">1</div>
                    <h3 className="pipeline-card-title">Build</h3>
                    <span className="pipeline-card-surface">Desktop or SDK</span>
                    <p className="pipeline-card-desc">
                      Prepares an unsigned ERC-4337 UserOperation for USDG stablecoin or native ETH transfer.
                    </p>
                    <div className="pipeline-card-badge">unsigned userOpHash</div>
                  </div>

                  {/* Step 2 */}
                  <div className="pipeline-card">
                    <div className="pipeline-card-num">2</div>
                    <h3 className="pipeline-card-title">Client Sign</h3>
                    <span className="pipeline-card-surface">Local OS Keystore (Shard A)</span>
                    <p className="pipeline-card-desc">
                      Client decrypts Shard A via device credentials (Keychain, DPAPI) and signs the userOpHash.
                    </p>
                    <div className="pipeline-card-badge">sigA (65 bytes)</div>
                  </div>

                  {/* Step 3 */}
                  <div className="pipeline-card">
                    <div className="pipeline-card-num">3</div>
                    <h3 className="pipeline-card-title">Co-Sign</h3>
                    <span className="pipeline-card-surface">Co-Signer API (Shard B)</span>
                    <p className="pipeline-card-desc">
                      Payload dispatched over TLS. Engine evaluates daily spend limits and velocity rules, then signs with Shard B.
                    </p>
                    <div className="pipeline-card-badge">sigB (65 bytes)</div>
                  </div>

                  {/* Step 4 */}
                  <div className="pipeline-card">
                    <div className="pipeline-card-num">4</div>
                    <h3 className="pipeline-card-title">Combine</h3>
                    <span className="pipeline-card-surface">Aggregation Engine</span>
                    <p className="pipeline-card-desc">
                      The two 65-byte signatures merge into an aggregate 130-byte threshold payload without assembling the root key.
                    </p>
                    <div className="pipeline-card-badge">sigA || sigB (130B)</div>
                  </div>

                  {/* Step 5 */}
                  <div className="pipeline-card">
                    <div className="pipeline-card-num">5</div>
                    <h3 className="pipeline-card-title">Settle</h3>
                    <span className="pipeline-card-surface">Robinhood Chain</span>
                    <p className="pipeline-card-desc">
                      Dispatched to Robinhood Chain bundler. PrivatumAccount contract validates 2-of-3 quorum and executes.
                    </p>
                    <div className="pipeline-card-badge">EntryPoint (Chain 4663)</div>
                  </div>
                </div>

                {/* Emergency Passkey Recovery Callout */}
                <div className="pipeline-recovery-card">
                  <div className="pipeline-recovery-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" />
                      <path d="m21 2-9.6 9.6" />
                      <circle cx="7.5" cy="15.5" r="5.5" />
                    </svg>
                  </div>
                  <div className="pipeline-recovery-text">
                    <strong>Emergency Recovery Quorum (Shard C + Shard B):</strong> If your client device is lost or compromised,
                    Shard C (Hardware Passkey / WebAuthn) combines with Shard B (Co-signer) to initiate emergency key rotation or
                    fund migration without exposing a seed phrase.
                  </div>
                </div>

                {/* Technical Specifications & Co-Signer API Section */}
                <div style={{ marginTop: "44px" }} id="specs">
                  <div className="section-heading_wrapper">
                    <div className="heading_wrapper">
                      <div className="text-size-tiny brand-color">Protocol Specs</div>
                      <h2 className="heading-style-h3" style={{ fontSize: "22px" }}>Robinhood Chain Specifications &amp; Endpoints</h2>
                    </div>
                  </div>

                  <div className="specs-grid">
                    <div className="spec-item">
                      <div className="spec-label">Execution Network</div>
                      <div className="spec-value">Robinhood Chain Mainnet</div>
                    </div>
                    <div className="spec-item">
                      <div className="spec-label">Network Stack</div>
                      <div className="spec-value">Arbitrum Dedicated L2</div>
                    </div>
                    <div className="spec-item">
                      <div className="spec-label">Chain ID</div>
                      <div className="spec-value"><code>4663</code></div>
                    </div>
                    <div className="spec-item">
                      <div className="spec-label">Native Gas Token</div>
                      <div className="spec-value">ETH</div>
                    </div>
                    <div className="spec-item">
                      <div className="spec-label">Frontier Settlement Assets</div>
                      <div className="spec-value">USDG &amp; Native ETH</div>
                    </div>
                    <div className="spec-item">
                      <div className="spec-label">Account Abstraction</div>
                      <div className="spec-value">ERC-4337 v0.6</div>
                    </div>
                  </div>

                  {/* Co-Signer API Endpoints Table */}
                  <div style={{ marginTop: "22px" }}>
                    <div className="text-size-small" style={{ fontWeight: 700, color: "#0e121b", marginBottom: "8px" }}>
                      Co-Signer Engine API Endpoints
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table className="api-endpoints-table">
                        <thead>
                          <tr>
                            <th style={{ width: "80px" }}>Method</th>
                            <th style={{ width: "160px" }}>Endpoint</th>
                            <th>Description</th>
                            <th>Payload / Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td><span className="api-method-get">GET</span></td>
                            <td><code>/health</code></td>
                            <td>Service health, version, and Robinhood Chain ID check</td>
                            <td><code>{`{ status: "ok", chainId: 4663 }`}</code></td>
                          </tr>
                          <tr>
                            <td><span className="api-method-post">POST</span></td>
                            <td><code>/v1/wallets</code></td>
                            <td>Registers a new 2-of-3 threshold smart account</td>
                            <td><code>{`{ address, shardAPubkey, shardBEncrypted, shardCPasskeyPubkey }`}</code></td>
                          </tr>
                          <tr>
                            <td><span className="api-method-post">POST</span></td>
                            <td><code>/v1/cosign</code></td>
                            <td>Submits UserOp for policy validation and Shard B co-signing</td>
                            <td><code>{`{ walletAddress, asset, amount, userOpHash, recipient }`}</code></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HIGHLIGHTS SECTION */}
        <section className="section" id="highlights">
          <div className="padding-global">
            <div className="container-large">
              <div className="padding-section-large padding-bottom highlight-gap">
                <div className="highlight-header">
                  <div className="section-heading_wrapper flex-down home-header-two">
                    <div className="heading_wrapper home-heading-two">
                      <div className="text-size-tiny brand-color">Highlights</div>
                      <h2 className="heading-style-h2">Private frontier asset payments built for Robinhood Chain</h2>
                    </div>
                    <p className="text-size-regular highlight-heading_para">
                      Privatum delivers non-custodial USDG and native ETH settlement with 2-of-3 threshold security, automated policy co-signing, and passkey recovery.
                    </p>
                  </div>
                  <div className="highlight-header_image_wrapper">
                    <img
                      alt="PRIVATUM desktop command center"
                      className="highlight-header_inner_image privatum-card-art"
                      loading="lazy"
                      src="/assets/privatum-dashboard-1.jpg"
                    />
                  </div>
                </div>

                <div className="highlight-links_wrapper">
                  <a
                    aria-disabled="true"
                    className={`highlight-link w-inline-block ${soonTip === "Private Send" ? "is-soon" : ""}`}
                    data-soon="Private Send"
                    href="#"
                    onClick={(e) => triggerSoon(e, "Private Send")}
                  >
                    <h3 className="heading-style-h5">Private Send</h3>
                    <div className="highlight-texts_wrapper">
                      <p className="text-size-regular highlight-text">
                        Transfer USDG or native ETH to any .privatum handle or Robinhood Chain address through a threshold-signed flow.
                      </p>
                      <div className="highlight-icon_wrapper">
                        <svg className="highlight-icon" fill="none" viewBox="0 0 24 24" width="100%" xmlns="http://www.w3.org/2000/svg">
                          <path
                            d="M16.1716 11.0009L10.8076 5.63687L12.2218 4.22266L20 12.0009L12.2218 19.779L10.8076 18.3648L16.1716 13.0009H4V11.0009H16.1716Z"
                            fill="currentColor"
                          />
                        </svg>
                      </div>
                    </div>
                  </a>

                  <a
                    aria-disabled="true"
                    className={`highlight-link w-inline-block ${soonTip === "Stealth Receive" ? "is-soon" : ""}`}
                    data-soon="Stealth Receive"
                    href="#"
                    onClick={(e) => triggerSoon(e, "Stealth Receive")}
                  >
                    <h3 className="heading-style-h5">Stealth Receive</h3>
                    <div className="highlight-texts_wrapper">
                      <p className="text-size-regular highlight-text">
                        Share a public .privatum meta-address while incoming payments arrive at dynamic ERC-5564 stealth destinations for unlinkability.
                      </p>
                      <div className="highlight-icon_wrapper">
                        <svg className="highlight-icon" fill="none" viewBox="0 0 24 24" width="100%" xmlns="http://www.w3.org/2000/svg">
                          <path
                            d="M16.1716 11.0009L10.8076 5.63687L12.2218 4.22266L20 12.0009L12.2218 19.779L10.8076 18.3648L16.1716 13.0009H4V11.0009H16.1716Z"
                            fill="currentColor"
                          />
                        </svg>
                      </div>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* DOWNLOADS SECTION */}
        <section className="section pv-downloads-section" id="download">
          <div className="padding-global">
            <div className="container-large">
              <div className="pv-downloads-header">
                <div className="pv-downloads-badge">
                  <DownloadIcon />
                  <span>Latest Release {releaseInfo?.version || "v0.1.0"}</span>
                </div>
                <h2 className="pv-downloads-title">Download Privatum Desktop</h2>
                <p className="pv-downloads-subtitle">
                  Threshold custody, frontier asset settlement (USDG &amp; native ETH), stealth addresses, and atomic swaps natively on your desktop.
                  Built with Tauri v2 and Rust, connected directly to Robinhood Chain.
                </p>
              </div>

              <div className="pv-downloads-grid">
                {/* Windows */}
                <div className={`pv-download-card ${detectedPlatform === "windows" ? "is-detected" : ""}`}>
                  {detectedPlatform === "windows" && <div className="pv-detected-tag">Detected OS</div>}
                  <div className="pv-card-top">
                    <div className="pv-card-icon-wrap">
                      <WindowsIcon />
                    </div>
                    <div className="pv-card-heading">
                      <h3 className="pv-card-os-name">Windows</h3>
                      <span className="pv-card-arch-badge">64-bit (x64)</span>
                    </div>
                  </div>
                  <div className="pv-card-specs">
                    <div className="pv-spec-row">
                      <span>Platform</span>
                      <b>Windows 10 / 11</b>
                    </div>
                    <div className="pv-spec-row">
                      <span>Package</span>
                      <b>Setup (.exe)</b>
                    </div>
                    <div className="pv-spec-row">
                      <span>Target File</span>
                      <b>{releaseInfo?.downloads?.["windows"]?.filename || PLATFORM_DATA.windows.filename}</b>
                    </div>
                  </div>
                  <a
                    className="pv-card-btn"
                    href="https://api.privatumrh.com/v1/downloads/windows"
                  >
                    <DownloadIcon />
                    <span>Download for Windows (.exe)</span>
                  </a>
                  <div className="pv-card-instructions">
                    Double-click the installer to launch Privatum setup.
                  </div>
                </div>

                {/* macOS */}
                <div className={`pv-download-card ${detectedPlatform === "macos" ? "is-detected" : ""}`}>
                  {detectedPlatform === "macos" && <div className="pv-detected-tag">Detected OS</div>}
                  <div className="pv-card-top">
                    <div className="pv-card-icon-wrap">
                      <AppleIcon />
                    </div>
                    <div className="pv-card-heading">
                      <h3 className="pv-card-os-name">macOS</h3>
                      <span className="pv-card-arch-badge">Apple Silicon (arm64)</span>
                    </div>
                  </div>
                  <div className="pv-card-specs">
                    <div className="pv-spec-row">
                      <span>Platform</span>
                      <b>macOS 11.0+</b>
                    </div>
                    <div className="pv-spec-row">
                      <span>Package</span>
                      <b>App Bundle (.tar.gz / .dmg)</b>
                    </div>
                    <div className="pv-spec-row">
                      <span>Target File</span>
                      <b>{releaseInfo?.downloads?.["macos"]?.filename || PLATFORM_DATA.macos.filename}</b>
                    </div>
                  </div>
                  <a
                    className="pv-card-btn"
                    href="https://api.privatumrh.com/v1/downloads/macos"
                  >
                    <DownloadIcon />
                    <span>Download for macOS</span>
                  </a>
                  <div className="pv-card-instructions">
                    Extract archive and move Privatum.app to Applications.
                  </div>
                </div>

                {/* Linux */}
                <div className={`pv-download-card ${detectedPlatform === "linux" ? "is-detected" : ""}`}>
                  {detectedPlatform === "linux" && <div className="pv-detected-tag">Detected OS</div>}
                  <div className="pv-card-top">
                    <div className="pv-card-icon-wrap">
                      <LinuxIcon />
                    </div>
                    <div className="pv-card-heading">
                      <h3 className="pv-card-os-name">Linux</h3>
                      <span className="pv-card-arch-badge">x64 / amd64</span>
                    </div>
                  </div>
                  <div className="pv-card-specs">
                    <div className="pv-spec-row">
                      <span>Platform</span>
                      <b>Ubuntu / Debian / Arch / Fedora</b>
                    </div>
                    <div className="pv-spec-row">
                      <span>Packages</span>
                      <b>.deb &bull; .rpm &bull; AppImage</b>
                    </div>
                    <div className="pv-spec-row">
                      <span>Target File</span>
                      <b>{releaseInfo?.downloads?.["linux"]?.filename || PLATFORM_DATA.linux.filename}</b>
                    </div>
                  </div>
                  <a
                    className="pv-card-btn"
                    href="https://api.privatumrh.com/v1/downloads/linux"
                  >
                    <DownloadIcon />
                    <span>Download for Linux</span>
                  </a>
                  <div className="pv-card-instructions">
                    Debian/Ubuntu: <code>sudo apt install ./*.deb</code> &bull; Arch/Fedora: run AppImage or native binary
                  </div>
                </div>
              </div>

              <div className="pv-downloads-footer">
                <div>
                  <span>Automated releases built and signed for Windows, macOS, and Linux. </span>
                  <a
                    href="https://github.com/PrivatumRH/privatum"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View repository on GitHub &rarr;
                  </a>
                  <span style={{ margin: "0 8px", opacity: 0.4 }}>|</span>
                  <a
                    href="https://www.npmjs.com/package/@privatumrh/robinhood-chain-sdk"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    SDK on npm &rarr;
                  </a>
                </div>
                <div>
                  <span>Robinhood Chain Mainnet &bull; Chain ID: <code>4663</code> &bull; Arbitrum L2 &bull; Native Gas: <code>ETH</code></span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* BRIDGE REBATES SECTION */}
        <section className="section pv-rebate-section" id="rebates">
          <div className="padding-global">
            <div className="container-large">
              <div className="padding-section-large padding-bottom">
                <div className="section-heading_wrapper">
                  <div className="heading_wrapper home-heading-two">
                    <div className="text-size-tiny brand-color">Bridge Rebates</div>
                    <h2 className="heading-style-h2">Bridge across four chains and earn the spread back</h2>
                  </div>
                  <p className="text-size-regular">
                    Every bridge pays the relayer a spread on top of destination gas. Privatum returns {REBATE_PERCENT}% of
                    that spread to you in PRIV, settled on Robinhood Chain.
                  </p>
                </div>

                <div className="pv-rebate-chains">
                  {BRIDGE_CHAINS.map((chain) => (
                    <div className="pv-rebate-chain" key={chain.id}>
                      <span className="pv-rebate-chain-name">{chain.name}</span>
                      <span className="pv-rebate-chain-id">Chain ID {chain.id}</span>
                    </div>
                  ))}
                </div>

                <div className="pv-rebate-grid">
                  <div className="pv-rebate-steps">
                    {REBATE_STEPS.map((step, index) => (
                      <div className="pv-rebate-step" key={step.title}>
                        <div className="pv-rebate-step-index">{index + 1}</div>
                        <div className="pv-rebate-step-body">
                          <h3 className="pv-rebate-step-title">{step.title}</h3>
                          <p className="pv-rebate-step-copy">{step.copy}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pv-rebate-panel">
                    <div className="pv-rebate-panel-head">
                      <span className="pv-rebate-panel-label">Worked example</span>
                      <span className="pv-rebate-panel-rate">{REBATE_PERCENT}% of spread</span>
                    </div>

                    <div className="pv-rebate-rows">
                      <div className="pv-rebate-row">
                        <span>Route</span>
                        <b>Base &rarr; Robinhood Chain</b>
                      </div>
                      <div className="pv-rebate-row">
                        <span>Bridged</span>
                        <b>0.1 ETH</b>
                      </div>
                      <div className="pv-rebate-row">
                        <span>Relayer fee</span>
                        <b>$0.0795</b>
                      </div>
                      <div className="pv-rebate-row is-muted">
                        <span>&mdash; destination gas</span>
                        <b>$0.0099</b>
                      </div>
                      <div className="pv-rebate-row">
                        <span>&mdash; relayer spread</span>
                        <b>$0.0695</b>
                      </div>
                      <div className="pv-rebate-row is-total">
                        <span>Your rebate</span>
                        <b>$0.0174 in PRIV</b>
                      </div>
                    </div>

                    <p className="pv-rebate-note">
                      Figures from a live Relay quote. Rebates accrue per bridge and are claimable in PRIV on
                      Robinhood Chain once the bridge settles.
                    </p>
                  </div>
                </div>

                <div className="pv-rebate-token">
                  <div className="pv-rebate-token-main">
                    <span className="pv-rebate-token-symbol">PRIV</span>
                    <span className="pv-rebate-token-name">PrivatumRH &bull; 18 decimals &bull; Robinhood Chain</span>
                  </div>
                  <code className="pv-rebate-token-ca">{PRIV_TOKEN_ADDRESS}</code>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PRODUCT FLOW SLIDER */}
        <section className="section" id="product">
          <div className="padding-global">
            <div className="container-large">
              <div className="padding-section-large padding-bottom">
                <div className="section-heading_wrapper home-header-three">
                  <div className="heading_wrapper home-heading-three">
                    <div className="text-size-tiny brand-color">Overview</div>
                    <h2 className="heading-style-h2">Build and launch private payment flows with confidence</h2>
                  </div>
                  <p className="text-size-regular home-para-three">
                    Create threshold-secured payment workflows for users, teams, and developers using a native desktop app and open SDK.
                  </p>
                </div>

                <div className="slider_wrapper">
                  <div className="slider w-slider">
                    <div className="overview-slider_mask w-slider-mask" style={{ overflow: "hidden", position: "relative" }}>
                      <div
                        style={{
                          display: "flex",
                          transition: "transform 0.4s ease",
                          transform: `translateX(-${productSlide * 100}%)`,
                          width: "100%",
                        }}
                      >
                        {/* Slide 0 */}
                        <div className="slide w-slide" style={{ minWidth: "100%", flex: "0 0 100%" }}>
                          <div className="overview-card">
                            <div className="overview-card-image_wrapper">
                              <div aria-label="Private send and stealth receive flow" className="flow-scene" role="img">
                                <div className="flow-top">
                                  <span>Private transfer</span>
                                  <b>Protected</b>
                                </div>
                                <div className="payment-compose">
                                  <small>Send</small>
                                  <strong>
                                    2,500.00 <em>USDG</em>
                                  </strong>
                                  <div className="recipient-pill">
                                    <i>@</i>
                                    <span>treasury.privatum</span>
                                    <b>Verified</b>
                                  </div>
                                  <button type="button">
                                    Review private send <span>→</span>
                                  </button>
                                </div>
                                <div className="flow-receipt">
                                  <i>✓</i>
                                  <span>
                                    <b>Stealth address created</b>
                                    <small>0x8fa2 ··· 91bd</small>
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="overview-card_texts">
                              <h3 className="heading-style-h5">Private send and stealth receive</h3>
                              <p className="text-size-regular">
                                Send USDG and native ETH to handles or raw addresses, then receive payments through one-time stealth destinations.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Slide 1 */}
                        <div className="slide w-slide" style={{ minWidth: "100%", flex: "0 0 100%" }}>
                          <div className="overview-card">
                            <div className="overview-card-image_wrapper">
                              <div aria-label="In-wallet USDG and ETH swap interface" className="flow-scene swap-scene" role="img">
                                <div className="flow-top">
                                  <span>Swap route</span>
                                  <b>Best price</b>
                                </div>
                                <div className="swap-stack">
                                  <div>
                                    <span>
                                      <i>$</i> USDG
                                    </span>
                                    <strong>2,500.00</strong>
                                  </div>
                                  <div className="swap-arrow">↓</div>
                                  <div>
                                    <span>
                                      <i>Ξ</i> ETH
                                    </span>
                                    <strong>1.082</strong>
                                  </div>
                                </div>
                                <div className="route-line">
                                  <span>USDG</span>
                                  <i></i>
                                  <b>Robinhood Chain</b>
                                  <i></i>
                                  <span>ETH</span>
                                </div>
                                <div className="metric-row">
                                  <span>
                                    Slippage <b>0.10%</b>
                                  </span>
                                  <span>
                                    Gas <b>0.00004 ETH ($0.10)</b>
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="overview-card_texts">
                              <h3 className="heading-style-h5">In-wallet USDG &amp; ETH swaps</h3>
                              <p className="text-size-regular">
                                Route USDG and native ETH swaps through Robinhood Chain liquidity with clear quote and slippage controls.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Slide 2 */}
                        <div className="slide w-slide" style={{ minWidth: "100%", flex: "0 0 100%" }}>
                          <div className="overview-card">
                            <div className="overview-card-image_wrapper">
                              <div aria-label="Two of three threshold signing process" className="flow-scene signing-scene" role="img">
                                <div className="flow-top">
                                  <span>Signing session</span>
                                  <b>Live</b>
                                </div>
                                <div className="signing-total">
                                  <small>Transfer intent</small>
                                  <strong>620.00 USDG</strong>
                                  <span>ops.privatum</span>
                                </div>
                                <div className="signing-steps">
                                  <div className="signed">
                                    <i>A</i>
                                    <span>
                                      Desktop<small>Partial signed (65B)</small>
                                    </span>
                                    <b>✓</b>
                                  </div>
                                  <div className="signed">
                                    <i>B</i>
                                    <span>
                                      Co-signer<small>Policy approved (65B)</small>
                                    </span>
                                    <b>✓</b>
                                  </div>
                                  <div>
                                    <i>C</i>
                                    <span>
                                      Passkey<small>Standby (Recovery)</small>
                                    </span>
                                    <b>-</b>
                                  </div>
                                </div>
                                <div className="progress-track">
                                  <span></span>
                                </div>
                              </div>
                            </div>
                            <div className="overview-card_texts">
                              <h3 className="heading-style-h5">2-of-3 threshold signing</h3>
                              <p className="text-size-regular">
                                The desktop client signs locally with Shard A, the co-signer validates policy and signs with Shard B, and signatures merge into an aggregate 130-byte threshold payload.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Slide 3 */}
                        <div className="slide w-slide" style={{ minWidth: "100%", flex: "0 0 100%" }}>
                          <div className="overview-card">
                            <div className="overview-card-image_wrapper">
                              <div aria-label="Desktop command center interface" className="flow-scene command-scene" role="img">
                                <div className="command-rail">
                                  <b>P</b>
                                  <i></i>
                                  <i></i>
                                  <i></i>
                                  <i></i>
                                </div>
                                <div className="command-main">
                                  <div className="flow-top">
                                    <span>Command center</span>
                                    <b>All systems ready</b>
                                  </div>
                                  <strong className="mini-balance">$24,806.42</strong>
                                  <small>Shielded portfolio (USDG &amp; ETH)</small>
                                  <div className="mini-stats">
                                    <span>
                                      <small>Quorum</small>
                                      <b>2 of 3</b>
                                    </span>
                                    <span>
                                      <small>Policy</small>
                                      <b>Armed</b>
                                    </span>
                                  </div>
                                  <div className="mini-activity">
                                    <span>
                                      <i>↓</i> Stealth receive
                                    </span>
                                    <b>+4,200 USDG</b>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="overview-card_texts">
                              <h3 className="heading-style-h5">Native desktop command center</h3>
                              <p className="text-size-regular">
                                Manage USDG and native ETH balances, shard health, recovery passkeys, spending policy controls, swaps, and private payment activity from one desktop surface.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Arrow Navigation */}
                    <div
                      className="slide_arrow w-slider-arrow-left"
                      onClick={() => setProductSlide((prev) => (prev > 0 ? prev - 1 : 3))}
                      role="button"
                      aria-label="Previous slide"
                      tabIndex={0}
                    >
                      <svg className="slide_icon" fill="none" viewBox="0 0 14 14" width="100%" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M4.56689 7.5851L7.69589 10.7141L6.87094 11.5391L2.33366 7.00177L6.87094 2.46454L7.69589 3.28949L4.56689 6.41844L11.667 6.41844L11.667 7.5851L4.56689 7.5851Z"
                          fill="currentColor"
                        />
                      </svg>
                    </div>
                    <div
                      className="slide_arrow right_arrow w-slider-arrow-right"
                      onClick={() => setProductSlide((prev) => (prev < 3 ? prev + 1 : 0))}
                      role="button"
                      aria-label="Next slide"
                      tabIndex={0}
                    >
                      <svg className="slide_icon" fill="none" viewBox="0 0 14 14" width="100%" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M9.43311 6.4149L6.30411 3.28589L7.12906 2.46094L11.6663 6.99823L7.12906 11.5355L6.30411 10.7105L9.43311 7.58157H2.33301V6.4149H9.43311Z"
                          fill="currentColor"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* RELIABILITY & CUSTODY CONSOLE */}
        <section className="section" id="reliability">
          <div className="padding-global">
            <div className="container-large">
              <div className="padding-section-large padding-bottom">
                <div className="section-heading_wrapper home-header-four">
                  <div className="heading_wrapper home-heading-four">
                    <div className="text-size-tiny brand-color">Overview</div>
                    <h2 className="heading-style-h2">Reliable custody that continuously verifies itself</h2>
                  </div>
                  <p className="text-size-regular home-para-four">
                    Continuously monitor shard readiness, policy checks, activity, and recovery paths before funds move.
                  </p>
                </div>

                <div className="conversion-wrapper">
                  <div className="conversion-cards_wrapper">
                    {/* Item 0 */}
                    <div className="conversion-card_wrapper" onClick={() => setActiveReliability(0)}>
                      <div className={`conversion-card ${activeReliability === 0 ? "active-card" : ""}`} style={{ cursor: "pointer" }}>
                        <div className={`conversion-icon_wrapper ${activeReliability === 0 ? "active-icon" : ""}`}>
                          <svg className="conversion-icon" fill="none" viewBox="0 0 19 19" width="100%" xmlns="http://www.w3.org/2000/svg">
                            <path
                              d="M12.1901 12.1901C13.4525 12.1901 14.4758 13.2134 14.4758 14.4758C14.4758 15.7382 13.4525 16.7615 12.1901 16.7615C10.9277 16.7615 9.90439 15.7382 9.90439 14.4758C9.90439 13.2134 10.9277 12.1901 12.1901 12.1901ZM4.57106 9.14249C6.25421 9.14249 7.61868 10.507 7.61868 12.1901C7.61868 13.8732 6.25421 15.2377 4.57106 15.2377C2.8879 15.2377 1.52344 13.8732 1.52344 12.1901C1.52344 10.507 2.8879 9.14249 4.57106 9.14249Z"
                              fill="currentColor"
                            />
                          </svg>
                        </div>
                        <h3 className="heading-style-h6">Shard health monitoring</h3>
                        <div className={`conversion-para ${activeReliability === 0 ? "active-para" : ""}`}>
                          <p>Check client, co-signer, and passkey readiness before a transaction reaches the signing pipeline.</p>
                        </div>
                      </div>
                    </div>

                    {/* Item 1 */}
                    <div className="conversion-card_wrapper" onClick={() => setActiveReliability(1)}>
                      <div className={`conversion-card ${activeReliability === 1 ? "active-card" : ""}`} style={{ cursor: "pointer" }}>
                        <div className={`conversion-icon_wrapper ${activeReliability === 1 ? "active-icon" : ""}`}>
                          <svg className="conversion-icon" fill="none" viewBox="0 0 19 19" width="100%" xmlns="http://www.w3.org/2000/svg">
                            <path
                              d="M6.85677 1.87224V3.49031C4.623 4.39452 3.04725 6.58448 3.04725 9.14249C3.04725 12.5088 5.77618 15.2377 9.14249 15.2377C11.7005 15.2377 13.8904 13.662 14.7947 11.4282H16.4127C15.4418 14.5193 12.554 16.7615 9.14249 16.7615C4.9346 16.7615 1.52344 13.3503 1.52344 9.14249C1.52344 5.73095 3.76564 2.84311 6.85677 1.87224Z"
                              fill="currentColor"
                            />
                          </svg>
                        </div>
                        <h3 className="heading-style-h6">Co-signer policy enforcement</h3>
                        <div className={`conversion-para ${activeReliability === 1 ? "active-para" : ""}`}>
                          <p>Validate session, transaction intent, spending limits, velocity, and anomaly signals before the second signature.</p>
                        </div>
                      </div>
                    </div>

                    {/* Item 2 */}
                    <div className="conversion-card_wrapper" onClick={() => setActiveReliability(2)}>
                      <div className={`conversion-card ${activeReliability === 2 ? "active-card" : ""}`} style={{ cursor: "pointer" }}>
                        <div className={`conversion-icon_wrapper ${activeReliability === 2 ? "active-icon" : ""}`}>
                          <svg className="conversion-icon" fill="none" viewBox="0 0 19 19" width="100%" xmlns="http://www.w3.org/2000/svg">
                            <path
                              d="M15.3012 11.5791L16.2171 12.1287C16.3974 12.2369 16.4559 12.4709 16.3477 12.6513C16.3155 12.705 16.2706 12.7499 16.2171 12.782L9.53441 16.7915C9.29311 16.9364 8.99171 16.9364 8.75041 16.7915L2.06783 12.782C1.88742 12.6737 1.82891 12.4398 1.93716 12.2593C1.96933 12.2057 2.0142 12.1608 2.06783 12.1287L2.98371 11.5791L9.14241 15.2743L15.3012 11.5791Z"
                              fill="currentColor"
                            />
                          </svg>
                        </div>
                        <h3 className="heading-style-h6">Activity and recovery visibility</h3>
                        <div className={`conversion-para ${activeReliability === 2 ? "active-para" : ""}`}>
                          <p>Track settlement history, export activity, rehearse recovery, and rotate a lost client shard without a seed phrase.</p>
                        </div>
                      </div>
                    </div>

                    <div className="button-wrapper">
                      <DownloadCta
                        className="primary-button w-variant-1f9277f6-d978-6891-434e-df9bad743ce3 w-inline-block"
                        textClassName="primary-button-text w-variant-1f9277f6-d978-6891-434e-df9bad743ce3"
                        label="Download Privatum Desktop"
                        href="#download"
                      />
                      <div className="reliability-platform-chips">
                        <a href="https://api.privatumrh.com/v1/downloads/windows" className="reliability-chip">Windows (.exe)</a>
                        <a href="https://api.privatumrh.com/v1/downloads/macos" className="reliability-chip">macOS (.dmg)</a>
                        <a href="https://api.privatumrh.com/v1/downloads/linux" className="reliability-chip">Linux (.deb)</a>
                      </div>
                    </div>
                  </div>

                  <div className="conversion-image_wrapper">
                    <div aria-label="Continuous custody verification console" className="custody-console" role="img">
                      <div className="custody-rail">
                        <div className="rail-brand">P</div>
                        <span className="active"></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                      <div className="custody-main">
                        <div className="custody-head">
                          <div>
                            <small>Custody posture</small>
                            <b>Continuous verification</b>
                          </div>
                          <span>
                            <i></i> All systems ready
                          </span>
                        </div>
                        <div className="custody-score">
                          <div className="score-ring">
                            <b>3/3</b>
                            <small>shards online</small>
                          </div>
                          <div>
                            <small>Current quorum</small>
                            <strong>2 of 3</strong>
                            <span>No single shard can sign alone</span>
                          </div>
                        </div>
                        <div className="custody-list">
                          <div>
                            <i>A</i>
                            <span>
                              <b>Desktop shard</b>
                              <small>Local enclave · just checked</small>
                            </span>
                            <em>Ready</em>
                          </div>
                          <div>
                            <i>B</i>
                            <span>
                              <b>Policy co-signer</b>
                              <small>Limits + intent verified</small>
                            </span>
                            <em>Ready</em>
                          </div>
                          <div>
                            <i>C</i>
                            <span>
                              <b>Recovery passkey</b>
                              <small>Last rehearsal · 2 days ago</small>
                            </span>
                            <em>Ready</em>
                          </div>
                        </div>
                        <div className="policy-stream">
                          <span>Session</span>
                          <i></i>
                          <span>Intent</span>
                          <i></i>
                          <span>Velocity</span>
                          <i></i>
                          <span>Sign</span>
                        </div>
                      </div>
                      <div className="scene-scan"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* LIVE DEMO SECTION */}
        <section className="section" id="live-demo">
          <div className="padding-global">
            <div className="container-large">
              <div className="padding-section-large padding-bottom">
                <div className="section-heading_wrapper align-center">
                  <div className="heading_wrapper demo_header">
                    <div className="text-size-tiny brand-color">Try our live demo</div>
                    <h2 className="heading-style-h2">Discover the full potential of Privatum Live</h2>
                  </div>
                </div>

                <div className="demo-details_wrapper">
                  <div className="demo-video_wrapper">
                    <div className="demo-video w-background-video w-background-video-atom">
                      <video
                        autoPlay
                        loop
                        muted
                        playsInline
                        style={{
                          backgroundImage:
                            'url("/6a5d4e514d1e968239079f7a/6a61b73386c1d1bb86086c78_loop_rotation%201_poster.0000000.jpg")',
                          objectFit: "cover",
                          width: "100%",
                          height: "100%",
                        }}
                      >
                        <source
                          src="/6a5d4e514d1e968239079f7a/6a61b73386c1d1bb86086c78_loop_rotation%201_mp4.mp4"
                          type="video/mp4"
                        />
                        <source
                          src="/6a5d4e514d1e968239079f7a/6a61b73386c1d1bb86086c78_loop_rotation%201_webm.webm"
                          type="video/webm"
                        />
                      </video>
                    </div>
                  </div>

                  <div className="demo-form_wrapper">
                    <h3 className="heading-style-h4 demo-form-text">
                      See how threshold custody coordinates private send, stealth receive, swaps, policy checks, and recovery in one operational flow.
                    </h3>
                    <div className="form-wrapper w-form">
                      <form
                        className="demo-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          triggerSoon(e, "Live Demo");
                        }}
                      >
                        <div className="fields-wrapper">
                          <div className="field-wrapper">
                            <label className="field-label" htmlFor="Use-Case">
                              Module
                            </label>
                            <input
                              className="demo-text_field w-input"
                              defaultValue="Private Send & Swaps"
                              id="Use-Case"
                              name="Use-Case"
                              type="text"
                            />
                          </div>
                          <div className="field-wrapper">
                            <label className="field-label" htmlFor="name">
                              Wallet Handle
                            </label>
                            <input
                              className="demo-text_field w-input"
                              defaultValue="treasury.privatum"
                              id="name"
                              name="name"
                              type="text"
                            />
                          </div>
                          <div className="field-wrapper">
                            <label className="field-label" htmlFor="phone">
                              Passkey Session
                            </label>
                            <input
                              className="demo-text_field w-input"
                              defaultValue="TouchID / WebAuthn"
                              id="phone"
                              name="phone"
                              type="text"
                            />
                          </div>
                        </div>
                        <DownloadCta
                          className="primary-form-button black w-button"
                          textClassName=""
                          label="Download"
                          href="#download"
                        />
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CASE STUDIES SECTION */}
        <section className="section" id="case-studies">
          <div className="padding-global">
            <div className="container-large">
              <div className="padding-section-large padding-bottom">
                <div className="section-heading_wrapper sticky">
                  <div className="heading_wrapper small_header home-heading-five">
                    <div className="text-size-tiny brand-color">Case Studies</div>
                    <h2 className="heading-style-h2">Research driving the Privatum product thesis</h2>
                  </div>
                  <p className="text-size-regular heading-para home-para-five">
                    What wallet drainers, custodial collapse, hardware recovery, and privacy infrastructure reveal about modern custody.
                  </p>
                </div>

                <div className="w-dyn-list">
                  <div className="case-study-collection-list w-dyn-items" role="list">
                    {/* Case Study 1 */}
                    <div className="case-study-sticky w-dyn-item" role="listitem">
                      <a className="case-card_link w-inline-block" href="/case-study/higher-lead-conversion.html">
                        <div className="case-study_card" style={{ backgroundColor: "#ffc88e" }}>
                          <div className="case-study-card_texts">
                            <p className="heading-style-h3 case-study-heading" style={{ color: "#0e121b" }}>
                              Wallet drainers show why one valid signature should never control an entire balance.
                            </p>
                            <div className="primary-button">
                              <div className="primary-button-wrap">
                                <div className="primary-button-text">Read Case Study</div>
                              </div>
                            </div>
                          </div>
                          <div className="case-card_images_wrapper">
                            <img
                              alt=""
                              className="card-image"
                              loading="lazy"
                              src="/6a5d4e514d1e968239079f78/6a61c2f5d094d475fafcba41_Rectangle%2015.webp"
                            />
                            <div className="case-card-tag_wrapper">
                              <div className="case-study-tag_header">
                                <div className="text-size-small text-color">Case Study</div>
                              </div>
                              <div className="text-size-small">$494M wallet drainer losses</div>
                            </div>
                          </div>
                        </div>
                      </a>
                    </div>

                    {/* Case Study 2 */}
                    <div className="case-study-sticky w-dyn-item" role="listitem">
                      <a className="case-card_link w-inline-block" href="/case-study/fewer-missed-calls.html">
                        <div className="case-study_card" style={{ backgroundColor: "#6e91f5" }}>
                          <div className="case-study-card_texts">
                            <p className="heading-style-h3 case-study-heading" style={{ color: "#000" }}>
                              FTX shows how custodial convenience becomes counterparty risk when users cannot verify control.
                            </p>
                            <div className="primary-button">
                              <div className="primary-button-wrap">
                                <div className="primary-button-text">Read Case Study</div>
                              </div>
                            </div>
                          </div>
                          <div className="case-card_images_wrapper">
                            <img
                              alt=""
                              className="card-image"
                              loading="lazy"
                              src="/6a5d4e514d1e968239079f78/6a61cff7c19cb0462a7d15e0_Rectangle%2015%203.webp"
                            />
                            <div className="case-card-tag_wrapper">
                              <div className="case-study-tag_header">
                                <div className="text-size-small text-color">Case Study</div>
                              </div>
                              <div className="text-size-small">$9B custodial liabilities</div>
                            </div>
                          </div>
                        </div>
                      </a>
                    </div>

                    {/* Case Study 3 */}
                    <div className="case-study-sticky w-dyn-item" role="listitem">
                      <a className="case-card_link w-inline-block" href="/case-study/lower-support-costs.html">
                        <div className="case-study_card" style={{ backgroundColor: "#ff5781" }}>
                          <div className="case-study-card_texts">
                            <p className="heading-style-h3 case-study-heading" style={{ color: "#000" }}>
                              Hardware recovery debates show why seed phrases remain a fragile default for mainstream users.
                            </p>
                            <div className="primary-button">
                              <div className="primary-button-wrap">
                                <div className="primary-button-text">Read Case Study</div>
                              </div>
                            </div>
                          </div>
                          <div className="case-card_images_wrapper">
                            <img
                              alt=""
                              className="card-image"
                              loading="lazy"
                              src="/6a5d4e514d1e968239079f78/6a61d04dc19cb0462a7d55bc_Rectangle%2015%204.webp"
                            />
                            <div className="case-card-tag_wrapper">
                              <div className="case-study-tag_header">
                                <div className="text-size-small text-color">Case Study</div>
                              </div>
                              <div className="text-size-small">3-party recovery debate</div>
                            </div>
                          </div>
                        </div>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* INTEGRATIONS & MARQUEE SECTION */}
        <section className="section" id="integrations">
          <div className="padding-global">
            <div className="container-large">
              <div className="padding-section-large padding-bottom">
                <div className="section-heading_wrapper align-center">
                  <div className="heading_wrapper home-heading-six">
                    <div className="text-size-tiny brand-color">Integrations</div>
                    <h2 className="heading-style-h2">Connect every payment touchpoint effortlessly</h2>
                  </div>
                </div>

                <div className="integration-cards_wrapper">
                  <div className="integration-card">
                    <h3 className="heading-style-h6">Private Send</h3>
                    <div className="integration-card_details">
                      <img
                        alt="Phone"
                        className="integration-card_image"
                        loading="lazy"
                        src="/6a5d4e514d1e968239079f7a/6a61e52dc29749bba7a9e3a4_Frame%2013.webp"
                      />
                      <p className="text-size-small">Transfer stablecoins through a two-shard signing flow with policy checks.</p>
                    </div>
                  </div>

                  <div className="integration-card">
                    <h3 className="heading-style-h6">Stealth Receive</h3>
                    <div className="integration-card_details">
                      <img
                        alt="Checkmark"
                        className="integration-card_image"
                        loading="lazy"
                        src="/6a5d4e514d1e968239079f7a/6a61e5c1c9ae8d9b85f70ad2_Frame%2014.webp"
                      />
                      <p className="text-size-small">Share one handle while incoming payments arrive at one-time addresses.</p>
                    </div>
                  </div>

                  <div className="integration-card">
                    <h3 className="heading-style-h6">In-Wallet Swaps</h3>
                    <div className="integration-card_details">
                      <img
                        alt="Swaps"
                        className="integration-card_image"
                        loading="lazy"
                        src="/6a5d4e514d1e968239079f7a/6a61e5c19a4570eb4047cbdc_Frame%2015.webp"
                      />
                      <p className="text-size-small">Swap supported stablecoins with route, quote, and slippage visibility.</p>
                    </div>
                  </div>

                  <a
                    className="integration-card"
                    href="https://www.npmjs.com/package/@privatumrh/robinhood-chain-sdk"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: "none", color: "inherit", display: "block" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h3 className="heading-style-h6">Open SDK</h3>
                      <span style={{ fontSize: "11px", letterSpacing: "0.04em", color: "rgba(255, 255, 255, 0.6)" }}>npm &rarr;</span>
                    </div>
                    <div className="integration-card_details">
                      <img
                        alt="Code icon"
                        className="integration-card_image"
                        loading="lazy"
                        src="/6a5d4e514d1e968239079f7a/6a61e5c1424bac9a0e4b60a1_Frame%2016.webp"
                      />
                      <p className="text-size-small">Embed threshold wallets into applications with a Viem based TypeScript SDK.</p>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Continuous Hardware-Accelerated Marquee */}
          <div className="marquee-wrapper" style={{ overflow: "hidden" }}>
            <div
              style={{
                display: "flex",
                gap: "12px",
                width: "max-content",
                animation: "privatumMarquee 32s linear infinite",
              }}
            >
              {[...STACK_CHIPS, ...STACK_CHIPS, ...STACK_CHIPS].map((chip, idx) => (
                <div key={idx} className="stack-chip">
                  <span className="stack-chip_name">{chip.name}</span>
                  <span className="stack-chip_sub">{chip.sub}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* COMPLIANCE & SECURITY SECTION */}
        <section className="section" id="security">
          <div className="padding-global">
            <div className="container-large">
              <div className="padding-section-large padding-bottom">
                <div className="section-heading_wrapper">
                  <div className="heading_wrapper home-heading-seven">
                    <div className="text-size-tiny brand-color">Compliance &amp; Security</div>
                    <h2 className="heading-style-h2">Enterprise security for every private payment</h2>
                  </div>
                </div>

                <div className="slider_wrapper">
                  <div className="slider w-slider">
                    <div className="compliance-slider_mask w-slider-mask" style={{ overflow: "hidden", position: "relative" }}>
                      <div
                        style={{
                          display: "flex",
                          transition: "transform 0.4s ease",
                          transform: `translateX(-${complianceSlide * 100}%)`,
                          width: "100%",
                        }}
                      >
                        {/* Slide 0 */}
                        <div className="slide w-slide" style={{ minWidth: "100%", flex: "0 0 100%" }}>
                          <div className="compliance-card">
                            <div className="compliance-icon_wrapper">
                              <img
                                alt="Security shield"
                                className="compliance-icon"
                                loading="lazy"
                                src="/6a5d4e514d1e968239079f7a/6a61ef541d4ee1d7ab86a2ff_Frame%2017.webp"
                              />
                            </div>
                            <div className="compliance-card_texts">
                              <h3 className="heading-style-h5">Data Protection</h3>
                              <p className="text-size-small">
                                Protect local shards with encrypted storage, OS keychains, isolated environments, and strict session controls.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Slide 1 */}
                        <div className="slide w-slide" style={{ minWidth: "100%", flex: "0 0 100%" }}>
                          <div className="compliance-card">
                            <div className="compliance-icon_wrapper">
                              <img
                                alt="Lightning bolt"
                                className="compliance-icon"
                                loading="lazy"
                                src="/6a5d4e514d1e968239079f7a/6a61f00b691493be7316d5f8_Frame%2018.webp"
                              />
                            </div>
                            <div className="compliance-card_texts">
                              <h3 className="heading-style-h5">Policy Controls</h3>
                              <p className="text-size-small">
                                Enforce daily limits, velocity checks, anomaly detection, and transaction intent validation before co-signing.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Slide 2 */}
                        <div className="slide w-slide" style={{ minWidth: "100%", flex: "0 0 100%" }}>
                          <div className="compliance-card">
                            <div className="compliance-icon_wrapper">
                              <img
                                alt="Security shield"
                                className="compliance-icon"
                                loading="lazy"
                                src="/6a5d4e514d1e968239079f7a/6a61ef541d4ee1d7ab86a2ff_Frame%2017.webp"
                              />
                            </div>
                            <div className="compliance-card_texts">
                              <h3 className="heading-style-h5">High Availability</h3>
                              <p className="text-size-small">
                                Maintain co-signer availability with monitored infrastructure, failover planning, and operational alerts.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Slide 3 */}
                        <div className="slide w-slide" style={{ minWidth: "100%", flex: "0 0 100%" }}>
                          <div className="compliance-card">
                            <div className="compliance-icon_wrapper">
                              <img
                                alt="Lightning bolt"
                                className="compliance-icon"
                                loading="lazy"
                                src="/6a5d4e514d1e968239079f7a/6a61f00b691493be7316d5f8_Frame%2018.webp"
                              />
                            </div>
                            <div className="compliance-card_texts">
                              <h3 className="heading-style-h5">Secure Access Control</h3>
                              <p className="text-size-small">
                                Use passkeys, session checks, and quorum rules to manage access without giving any one party custody.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div
                      className="slide_arrow w-slider-arrow-left"
                      onClick={() => setComplianceSlide((prev) => (prev > 0 ? prev - 1 : 3))}
                      role="button"
                      aria-label="Previous slide"
                      tabIndex={0}
                    >
                      <svg className="slide_icon" fill="none" viewBox="0 0 14 14" width="100%" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M4.56689 7.5851L7.69589 10.7141L6.87094 11.5391L2.33366 7.00177L6.87094 2.46454L7.69589 3.28949L4.56689 6.41844L11.667 6.41844L11.667 7.5851L4.56689 7.5851Z"
                          fill="currentColor"
                        />
                      </svg>
                    </div>
                    <div
                      className="slide_arrow right_arrow w-slider-arrow-right"
                      onClick={() => setComplianceSlide((prev) => (prev < 3 ? prev + 1 : 0))}
                      role="button"
                      aria-label="Next slide"
                      tabIndex={0}
                    >
                      <svg className="slide_icon" fill="none" viewBox="0 0 14 14" width="100%" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M9.43311 6.4149L6.30411 3.28589L7.12906 2.46094L11.6663 6.99823L7.12906 11.5355L6.30411 10.7105L9.43311 7.58157H2.33301V6.4149H9.43311Z"
                          fill="currentColor"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CONNECTED CHANNELS / SURFACES */}
        <section className="section" id="channels">
          <div className="padding-global">
            <div className="container-large">
              <div className="padding-section-large padding-bottom">
                <div className="section-heading_wrapper align-bottom hero-header-eight">
                  <div className="heading_wrapper">
                    <div className="text-size-tiny brand-color">Connected</div>
                    <h2 className="heading-style-h2">Reach users across every payment surface</h2>
                  </div>
                  <p className="text-size-regular">
                    Privatum connects desktop, Viem SDK, Robinhood Chain, USDG &amp; ETH swaps, stealth receive, and recovery surfaces in one 2-of-3 custody model.
                  </p>
                </div>

                <div className="tab-wrapper">
                  <div className="price-tabs w-tabs">
                    {/* Tab Navigation Buttons */}
                    <div className="tabs-menu w-tab-menu">
                      <a
                        className={`tab-link w-inline-block w-tab-link ${activeTab === 1 ? "w--current" : ""}`}
                        onClick={(e) => {
                          e.preventDefault();
                          setActiveTab(1);
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="tab-icon_wrapper one">
                          <svg className="tab-icon" fill="none" viewBox="0 0 20 20" width="100%" xmlns="http://www.w3.org/2000/svg">
                            <path
                              d="M12 0H8V6.0316C7.98315 7.1217 7.09425 8 6.00025 8H0V12H4.34314C5.404 12 6.42145 11.5786 7.17155 10.8285L10.8285 7.17155C11.5786 6.42145 12 5.404 12 4.34314V0Z"
                              fill="currentColor"
                            />
                            <path
                              d="M8 20H12V13.9684C12.0168 12.8783 12.9058 12 13.9998 12H20V8H15.6568C14.596 8 13.5786 8.42145 12.8285 9.17155L9.17155 12.8285C8.42145 13.5786 8 14.596 8 15.6568V20Z"
                              fill="currentColor"
                            />
                          </svg>
                        </div>
                        <div className="text-size-tiny">Desktop</div>
                      </a>

                      <a
                        className={`tab-link w-inline-block w-tab-link ${activeTab === 2 ? "w--current" : ""}`}
                        onClick={(e) => {
                          e.preventDefault();
                          setActiveTab(2);
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="tab-icon_wrapper two">
                          <svg className="tab-icon" fill="none" viewBox="0 0 20 20" width="100%" xmlns="http://www.w3.org/2000/svg">
                            <path
                              d="M0 16.5L2.00263 12.5H5.32383C7.503 12.5 9.34552 14.3551 9.63352 16.8392L10 20H5.65217L5.02543 18.3183C4.61435 17.2152 3.67121 16.5 2.62766 16.5H0Z"
                              fill="currentColor"
                            />
                            <path
                              d="M20 16.5L17.9973 12.5H14.6762C12.497 12.5 10.6545 14.3551 10.3665 16.8392L10 20H14.3478L14.9746 18.3183C15.3857 17.2152 16.3288 16.5 17.3723 16.5H20Z"
                              fill="currentColor"
                            />
                          </svg>
                        </div>
                        <div className="text-size-tiny">Open SDK</div>
                      </a>

                      <a
                        className={`tab-link w-inline-block w-tab-link ${activeTab === 3 ? "w--current" : ""}`}
                        onClick={(e) => {
                          e.preventDefault();
                          setActiveTab(3);
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="tab-icon_wrapper three">
                          <svg className="tab-icon" fill="none" viewBox="0 0 20 20" width="100%" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 0L13.6363 2.66667L0 12.6666V7.33335L10 0Z" fill="currentColor" />
                            <path
                              d="M1.93885 14.0898L10 20.0013L20 12.668V7.33463L13.6363 2.66797L0 12.668L0.0027792 12.67L13.6363 2.66797V10.3346L7.5 14.8346V10.0675L1.93885 14.0898Z"
                              fill="currentColor"
                            />
                          </svg>
                        </div>
                        <div className="text-size-tiny">USDG</div>
                      </a>

                      <a
                        className={`tab-link w-inline-block w-tab-link ${activeTab === 4 ? "w--current" : ""}`}
                        onClick={(e) => {
                          e.preventDefault();
                          setActiveTab(4);
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="tab-icon_wrapper four">
                          <svg className="tab-icon" fill="none" viewBox="0 0 20 20" width="100%" xmlns="http://www.w3.org/2000/svg">
                            <path
                              d="M16.8622 18.2904C18.8715 16.2811 20.0004 13.5559 20.0004 10.7143C20.0004 7.8727 18.8715 5.14745 16.8622 3.13814C14.8529 1.12882 12.1277 5.1094e-07 9.2861 0C6.4445 -5.1094e-07 3.71928 1.12882 1.70996 3.13814L5.2455 6.67365C5.8034 7.23155 6.7043 7.2037 7.41405 6.85905C7.99205 6.5784 8.63135 6.42855 9.2861 6.42855C10.4227 6.42855 11.5128 6.8801 12.3165 7.68385C13.1203 8.48755 13.5718 9.57765 13.5718 10.7143C13.5718 11.3691 13.422 12.0084 13.1413 12.5864C12.7967 13.2961 12.7688 14.197 13.3267 14.7549L16.8622 18.2904Z"
                              fill="currentColor"
                            />
                            <path d="M15 20H9.7549C8.99715 20 8.2704 19.699 7.7346 19.1632L0.83684 12.2654C0.30102 11.7296 0 11.0029 0 10.2451V5L15 20Z" fill="currentColor" />
                          </svg>
                        </div>
                        <div className="text-size-tiny">ETH</div>
                      </a>

                      <a
                        className={`tab-link w-inline-block w-tab-link ${activeTab === 5 ? "w--current" : ""}`}
                        onClick={(e) => {
                          e.preventDefault();
                          setActiveTab(5);
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="tab-icon_wrapper five">
                          <svg className="tab-icon" fill="none" viewBox="0 0 20 20" width="100%" xmlns="http://www.w3.org/2000/svg">
                            <path
                              d="M19.9723 10.75H16.4C13.2795 10.75 10.75 13.2796 10.75 16.4V19.9723C15.675 19.6071 19.6071 15.675 19.9723 10.75Z"
                              fill="currentColor"
                            />
                            <path
                              d="M9.25065 19.9723V16.4C9.25065 13.2796 6.72105 10.75 3.60062 10.75H0.0283203C0.393488 15.675 4.32567 19.6071 9.25065 19.9723Z"
                              fill="currentColor"
                            />
                            <path
                              d="M19.9723 9.24966C19.6071 4.32469 15.675 0.392511 10.75 0.0273438V3.59964C10.75 6.72006 13.2795 9.24966 16.4 9.24966H19.9723Z"
                              fill="currentColor"
                            />
                            <path
                              d="M9.25065 0.0273438C4.32567 0.392511 0.393488 4.32469 0.0283203 9.24966H3.60062C6.72105 9.24966 9.25065 6.72006 9.25065 3.59964V0.0273438Z"
                              fill="currentColor"
                            />
                          </svg>
                        </div>
                        <div className="text-size-tiny">Robinhood Chain</div>
                      </a>
                    </div>

                    {/* Tab Panes */}
                    <div className="tabs-content w-tab-content" style={{ width: "100%" }}>
                      {/* Tab 1: Desktop */}
                      {activeTab === 1 && (
                        <div className="tab-pane w-tab-pane w--tab-active">
                          <div className="tab-image_wrapper">
                            <div aria-label="Desktop custody workspace" className="connected-scene desktop-connected" role="img">
                              <div className="connected-top">
                                <span>Desktop command center</span>
                                <b>
                                  <i></i> Connected
                                </b>
                              </div>
                              <div className="desktop-window">
                                <aside>
                                  <strong>P</strong>
                                  <i></i>
                                  <i></i>
                                  <i></i>
                                </aside>
                                <main>
                                  <small>Shielded portfolio</small>
                                  <h4>$24,806.42</h4>
                                  <div className="connected-metrics">
                                    <span>
                                      <small>Quorum</small>
                                      <b>2 of 3</b>
                                    </span>
                                    <span>
                                      <small>Policy</small>
                                      <b>Armed</b>
                                    </span>
                                  </div>
                                  <div className="connected-route">
                                    <i>A</i>
                                    <em></em>
                                    <i>B</i>
                                    <em></em>
                                    <strong>Ready</strong>
                                  </div>
                                </main>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Tab 2: Open SDK */}
                      {activeTab === 2 && (
                        <div className="tab-pane w-tab-pane w--tab-active">
                          <div className="tab-image_wrapper two">
                            <div aria-label="Open SDK sending threshold payment" className="connected-scene sdk-connected" role="img">
                              <div className="connected-top">
                                <span>TypeScript SDK (@privatumrh/robinhood-chain-sdk)</span>
                                <a
                                  href="https://www.npmjs.com/package/@privatumrh/robinhood-chain-sdk"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: "inherit", textDecoration: "none" }}
                                >
                                  <b>
                                    <i></i> Live on npm &rarr;
                                  </b>
                                </a>
                              </div>
                              <div className="code-lines">
                                <span>
                                  <em>import</em> &#123; PrivatumWallet, LocalShard &#125; <em>from</em> <strong style={{ color: "#91d5b2" }}>"@privatumrh/robinhood-chain-sdk"</strong>;
                                </span>
                                <span>
                                  <em>import</em> &#123; parseUnits &#125; <em>from</em> <strong style={{ color: "#91d5b2" }}>"viem"</strong>;
                                </span>
                                <span style={{ marginTop: "4px" }}>
                                  <small style={{ color: "#64748b" }}>// Send USDG on Robinhood Chain via 2-of-3 threshold quorum</small>
                                </span>
                                <span>
                                  <em>const</em> receipt = <em>await</em> wallet.<b>sendAsset</b>(&#123;
                                </span>
                                <span>&nbsp;&nbsp;to: <strong style={{ color: "#ffd36a" }}>"0x742d...f44e"</strong>,</span>
                                <span>&nbsp;&nbsp;amount: parseUnits(<strong style={{ color: "#ffd36a" }}>"250.0"</strong>, 6),</span>
                                <span>&nbsp;&nbsp;asset: <strong style={{ color: "#ffd36a" }}>"USDG"</strong>,</span>
                                <span>&#125;);</span>
                                <span className="code-run">
                                  console.log(<strong style={{ color: "#ffd36a" }}>"Submitted UserOp hash:"</strong>, receipt.userOpHash);
                                </span>
                              </div>
                              <div className="sdk-result">
                                <i>✓</i>
                                <span>
                                  <b>Threshold signature aggregated</b>
                                  <small>130-byte payload submitted to Robinhood Chain</small>
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Tab 3: USDG */}
                      {activeTab === 3 && (
                        <div className="tab-pane w-tab-pane w--tab-active">
                          <div className="tab-image_wrapper">
                            <div aria-label="USDG private payment routed through custody" className="connected-scene coin-connected" role="img">
                              <div className="connected-top">
                                <span>Frontier Stablecoin Rail</span>
                                <b>
                                  <i></i> USDG ready
                                </b>
                              </div>
                              <div className="coin-route">
                                <div className="coin usdg">$</div>
                                <span className="route-copy">
                                  <small>Frontier send</small>
                                  <strong>2,500.00 USDG</strong>
                                  <em>treasury.privatum</em>
                                </span>
                                <div className="route-nodes">
                                  <i>A</i>
                                  <i>B</i>
                                  <i>C</i>
                                </div>
                              </div>
                              <div className="settlement-line">
                                <span></span>
                                <b>Robinhood Chain EntryPoint settled</b>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Tab 4: ETH */}
                      {activeTab === 4 && (
                        <div className="tab-pane w-tab-pane w--tab-active">
                          <div className="tab-image_wrapper">
                            <div aria-label="Native ETH settlement and gas liquidity" className="connected-scene coin-connected" role="img">
                              <div className="connected-top">
                                <span>Native Gas &amp; Settlement</span>
                                <b>
                                  <i></i> ETH active
                                </b>
                              </div>
                              <div className="coin-route">
                                <div className="coin eth">Ξ</div>
                                <span className="route-copy">
                                  <small>Native settlement</small>
                                  <strong>1.450 ETH</strong>
                                  <em>Arbitrum L2 gas &amp; transfers</em>
                                </span>
                                <div className="swap-loop">↕</div>
                              </div>
                              <div className="settlement-line">
                                <span></span>
                                <b>Instant L2 settlement &bull; Chain ID 4663</b>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Tab 5: Robinhood Chain */}
                      {activeTab === 5 && (
                        <div className="tab-pane w-tab-pane w--tab-active">
                          <div className="tab-image_wrapper">
                            <div aria-label="Robinhood Chain settlement" className="connected-scene chain-connected" role="img">
                              <div className="connected-top">
                                <span>Robinhood Chain Mainnet</span>
                                <b>
                                  <i></i> Chain ID: 4663
                                </b>
                              </div>
                              <div className="chain-map">
                                <div className="chain-core">R</div>
                                <div className="chain-node n1">Send</div>
                                <div className="chain-node n2">Swap</div>
                                <div className="chain-node n3">Receive</div>
                                <svg aria-hidden="true" viewBox="0 0 600 280">
                                  <path d="M300 140 C210 65 150 55 88 82"></path>
                                  <path d="M300 140 C410 54 475 60 530 92"></path>
                                  <path d="M300 140 C310 215 390 225 466 224"></path>
                                </svg>
                              </div>
                              <div className="chain-blocks">
                                <i></i>
                                <i></i>
                                <i></i>
                                <b>4663</b>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ROADMAP SECTION */}
        <section className="section" id="roadmap">
          <div className="padding-global">
            <div className="container-large">
              <div className="padding-section-large padding-bottom">
                <div className="section-heading_wrapper align-bottom">
                  <div className="heading_wrapper pricing_header">
                    <div className="text-size-tiny brand-color">Roadmap</div>
                    <h2 className="heading-style-h2">Roadmap to native privacy.</h2>
                  </div>
                </div>

                <div className="pv-timeline" style={{ "--pv-tl-progress": timelineProgress } as React.CSSProperties}>
                  <div className="pv-tl-rail">
                    <span className="pv-tl-rail_fill"></span>
                  </div>

                  {/* Phase 1 */}
                  <div className={`pv-tl-item is-shipped ${timelineVisible ? "is-visible" : ""}`} style={{ "--pv-tl-i": 0 } as React.CSSProperties}>
                    <div className="pv-tl-marker">
                      <span className="pv-tl-dot"></span>
                    </div>
                    <div className="pv-tl-card">
                      <div className="pv-tl-top">
                        <div className="text-size-tiny pv-tl-phase">Phase 1</div>
                        <div className="pv-tl-status">shipped</div>
                      </div>
                      <h3 className="pv-tl-title">Robinhood Chain Custody MVP</h3>
                      <p className="pv-tl-desc">
                        ERC-4337 smart accounts, 2-of-3 threshold sharding and passkey recovery, live on Robinhood Chain mainnet with a Tauri v2 desktop client.
                      </p>
                      <div className="pv-tl-chips">
                        <span className="pv-tl-chip">ERC-4337 accounts</span>
                        <span className="pv-tl-chip">Threshold sharding</span>
                        <span className="pv-tl-chip">Passkey recovery</span>
                        <span className="pv-tl-chip">Desktop client</span>
                      </div>
                    </div>
                  </div>

                  {/* Phase 2 */}
                  <div className={`pv-tl-item is-in-progress ${timelineVisible ? "is-visible" : ""}`} style={{ "--pv-tl-i": 1 } as React.CSSProperties}>
                    <div className="pv-tl-marker">
                      <span className="pv-tl-dot"></span>
                    </div>
                    <div className="pv-tl-card">
                      <div className="pv-tl-top">
                        <div className="text-size-tiny pv-tl-phase">Phase 2</div>
                        <div className="pv-tl-status">in progress</div>
                      </div>
                      <h3 className="pv-tl-title">Open SDK &amp; Developer Ecosystem</h3>
                      <p className="pv-tl-desc">
                        A public, typed TypeScript toolkit built on Viem (@privatumrh/robinhood-chain-sdk), with guides, sample apps and audit-ready threshold primitives under MIT licensing.
                      </p>
                      <div className="pv-tl-chips">
                        <a
                          className="pv-tl-chip"
                          href="https://www.npmjs.com/package/@privatumrh/robinhood-chain-sdk"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ textDecoration: "none", color: "inherit" }}
                        >
                          npm SDK &rarr;
                        </a>
                        <span className="pv-tl-chip">Viem APIs</span>
                        <span className="pv-tl-chip">Developer guides</span>
                        <span className="pv-tl-chip">MIT licensed</span>
                      </div>
                    </div>
                  </div>

                  {/* Phase 3 */}
                  <div className={`pv-tl-item is-in-progress ${timelineVisible ? "is-visible" : ""}`} style={{ "--pv-tl-i": 2 } as React.CSSProperties}>
                    <div className="pv-tl-marker">
                      <span className="pv-tl-dot"></span>
                    </div>
                    <div className="pv-tl-card">
                      <div className="pv-tl-top">
                        <div className="text-size-tiny pv-tl-phase">Phase 3</div>
                        <div className="pv-tl-status">in progress</div>
                      </div>
                      <h3 className="pv-tl-title">DEX Aggregation &amp; USDG/ETH Swaps</h3>
                      <p className="pv-tl-desc">
                        Low-slippage USDG and native ETH routing with transparent quotes, slippage controls and policy-checked execution across desktop and SDK.
                      </p>
                      <div className="pv-tl-chips">
                        <span className="pv-tl-chip">USDG / ETH swaps</span>
                        <span className="pv-tl-chip">Aggregated routes</span>
                        <span className="pv-tl-chip">Quote previews</span>
                        <span className="pv-tl-chip">Slippage controls</span>
                      </div>
                    </div>
                  </div>

                  {/* Phase 4 */}
                  <div className={`pv-tl-item is-next ${timelineVisible ? "is-visible" : ""}`} style={{ "--pv-tl-i": 3 } as React.CSSProperties}>
                    <div className="pv-tl-marker">
                      <span className="pv-tl-dot"></span>
                    </div>
                    <div className="pv-tl-card">
                      <div className="pv-tl-top">
                        <div className="text-size-tiny pv-tl-phase">Phase 4</div>
                        <div className="pv-tl-status">next</div>
                      </div>
                      <h3 className="pv-tl-title">Privacy Plane One</h3>
                      <p className="pv-tl-desc">
                        Threshold ECDSA and blind co-signing with ZK policy proofs, so signatures look standard and policy runs without profiling.
                      </p>
                      <div className="pv-tl-chips">
                        <span className="pv-tl-chip">Threshold ECDSA</span>
                        <span className="pv-tl-chip">Blind co-signing</span>
                        <span className="pv-tl-chip">ZK policy proofs</span>
                        <span className="pv-tl-chip">Invisible setup</span>
                      </div>
                    </div>
                  </div>

                  {/* Phase 5 */}
                  <div className={`pv-tl-item is-planned ${timelineVisible ? "is-visible" : ""}`} style={{ "--pv-tl-i": 4 } as React.CSSProperties}>
                    <div className="pv-tl-marker">
                      <span className="pv-tl-dot"></span>
                    </div>
                    <div className="pv-tl-card">
                      <div className="pv-tl-top">
                        <div className="text-size-tiny pv-tl-phase">Phase 5</div>
                        <div className="pv-tl-status">planned</div>
                      </div>
                      <h3 className="pv-tl-title">Privacy Plane Two</h3>
                      <p className="pv-tl-desc">
                        ERC-5564 stealth addresses, receiver unlinkability and screened privacy pools with association-set proofs for compliance-aware privacy.
                      </p>
                      <div className="pv-tl-chips">
                        <span className="pv-tl-chip">Stealth addresses</span>
                        <span className="pv-tl-chip">Unlinkability</span>
                        <span className="pv-tl-chip">Privacy pools</span>
                        <span className="pv-tl-chip">Provenance checks</span>
                      </div>
                    </div>
                  </div>

                  {/* Phase 6 */}
                  <div className={`pv-tl-item is-planned ${timelineVisible ? "is-visible" : ""}`} style={{ "--pv-tl-i": 5 } as React.CSSProperties}>
                    <div className="pv-tl-marker">
                      <span className="pv-tl-dot"></span>
                    </div>
                    <div className="pv-tl-card">
                      <div className="pv-tl-top">
                        <div className="text-size-tiny pv-tl-phase">Phase 6</div>
                        <div className="pv-tl-status">planned</div>
                      </div>
                      <h3 className="pv-tl-title">Multichain expansion</h3>
                      <p className="pv-tl-desc">
                        Additional EVM adapters and new L2 networks with one shard model, a portable co-signer and a consistent desktop experience everywhere.
                      </p>
                      <div className="pv-tl-chips">
                        <span className="pv-tl-chip">EVM adapters</span>
                        <span className="pv-tl-chip">New L2s</span>
                        <span className="pv-tl-chip">Portable co-signer</span>
                        <span className="pv-tl-chip">Unified recovery</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ SECTION */}
        <section className="section" id="faq">
          <div className="padding-global">
            <div className="container-large">
              <div className="padding-section-large">
                <div className="section-heading_wrapper align-bottom">
                  <div className="heading_wrapper pricing_header">
                    <div className="text-size-tiny brand-color">FAQ</div>
                    <h2 className="heading-style-h2">Common Questions</h2>
                  </div>
                </div>

                <div className="faq-card">
                  {FAQS.map((faq, index) => {
                    const isOpen = openFaq === index;
                    return (
                      <div
                        key={index}
                        className={`faq-wrapper ${index === 0 ? "one" : ""}`}
                        onClick={() => setOpenFaq(isOpen ? null : index)}
                        style={{ cursor: "pointer" }}
                      >
                        <div className="faq-question-wrapper">
                          <div className="heading-style-h5">{faq.q}</div>
                          {isOpen && (
                            <div className="faq-answer-wrapper" style={{ marginTop: "0.75rem" }}>
                              <p className="text-size-regular faq-answer">{faq.a}</p>
                            </div>
                          )}
                        </div>
                        <div className="faq-icon">
                          <svg
                            fill="none"
                            viewBox="0 0 24 24"
                            width="100%"
                            xmlns="http://www.w3.org/2000/svg"
                            style={{
                              transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                              transition: "transform 0.22s ease",
                            }}
                          >
                            <path
                              d="M11 10.9996V2.00001L13 2V10.9996L22.0001 10.9994L22.0002 12.9994L13 12.9996L13.0001 21.9995H11.0001V12.9996L2.00004 12.9998L2 10.9998L11 10.9996Z"
                              fill="currentColor"
                            />
                          </svg>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA SECTION */}
        <section className="section" id="cta">
          <div className="padding-global">
            <div className="container-large">
              <div className="padding-section-large cta-padding">
                <div className="cta-text_wrapper">
                  <h2 className="heading-style-h1">Build private payments on Robinhood Chain</h2>
                </div>
                <div className="cta-form_wrapper">
                  <h3 className="heading-style-h4 cta-mail_heading">
                    Read the developer docs, explore the architecture, and follow the roadmap to native privacy.
                  </h3>
                  <div className="w-form">
                    <form
                      action="/docs.html"
                      className="form"
                      method="get"
                      onSubmit={(e) => {
                        e.preventDefault();
                        window.location.href = "/docs.html";
                      }}
                    >
                      <label className="newsletter-label hide" htmlFor="Newsletter-Email">
                        Email Address
                      </label>
                      <input
                        className="text-field w-input"
                        id="Newsletter-Email"
                        placeholder="Read the PRIVATUM docs"
                        type="text"
                      />
                      <input className="submit-button w-button" type="submit" value="" />
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <img
            alt="PRIVATUM gradient background"
            className="bg-image"
            loading="lazy"
            src="/assets/privatum-gradient-clean.png"
          />
        </section>
      </div>

      {/* FOOTER */}
      <section className="section privatum-footer" id="footer">
        <div className="footer-top_wrapper">
          <div className="padding-global">
            <div className="container-large">
              <div className="padding-section-large footer-padding">
                <div className="footer-links-section">
                  <a aria-current="page" className="footer-logo_link w-inline-block w--current" href="/">
                    <img alt="PRIVATUM logo" loading="lazy" src="/assets/privatum-mark-black.png" />
                  </a>
                  <div className="footer-links_wrapper">
                    <div className="footer-link_wrapper">
                      <div className="footer_link_heading">Main Pages</div>
                      <div className="footer-links">
                        <a className="inner-link w-inline-block" href="#download">
                          <div>Download App</div>
                        </a>
                        <a className="inner-link w-inline-block" href="#overview">
                          <div>Overview</div>
                        </a>
                        <a className="inner-link w-inline-block" href="#security">
                          <div>Security</div>
                        </a>
                        <a className="inner-link w-inline-block" href="/case-study.html">
                          <div>Case Studies</div>
                        </a>
                        <a className="inner-link w-inline-block" href="/docs.html">
                          <div>Docs</div>
                        </a>
                      </div>
                    </div>

                    <div className="footer-link_wrapper">
                      <div className="footer_link_heading">Product</div>
                      <div className="dropdown-links">
                        <a className="inner-link w-inline-block" href="#download">
                          <div>Desktop Application</div>
                        </a>
                        <a
                            aria-disabled="true"
                            className={`inner-link w-inline-block ${soonTip === "Private Send" ? "is-soon" : ""}`}
                            data-soon="Private Send"
                            href="#"
                            onClick={(e) => triggerSoon(e, "Private Send")}
                          >
                            <div>Private Send</div>
                        </a>
                        <a
                            aria-disabled="true"
                            className={`inner-link w-inline-block ${soonTip === "Stealth Receive" ? "is-soon" : ""}`}
                            data-soon="Stealth Receive"
                            href="#"
                            onClick={(e) => triggerSoon(e, "Stealth Receive")}
                          >
                            <div>Stealth Receive</div>
                        </a>
                        <a
                            aria-disabled="true"
                            className={`inner-link w-inline-block ${soonTip === "Swaps" ? "is-soon" : ""}`}
                            data-soon="Swaps"
                            href="#"
                            onClick={(e) => triggerSoon(e, "Swaps")}
                          >
                            <div>Swaps</div>
                        </a>
                        <a className="inner-link w-inline-block" href="/docs.html#sdk">
                          <div>Open SDK</div>
                        </a>
                      </div>
                    </div>

                    <div className="footer-link_wrapper">
                      <div className="footer_link_heading">Research</div>
                      <div className="dropdown-links">
                        <a className="inner-link w-inline-block" href="/case-study/higher-lead-conversion.html">
                          <div>Research</div>
                        </a>
                        <a className="inner-link w-inline-block" href="/docs.html#sdk">
                          <div>SDK Docs</div>
                        </a>
                        <a
                          className="inner-link w-inline-block"
                          href="https://www.npmjs.com/package/@privatumrh/robinhood-chain-sdk"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <div>SDK on npm</div>
                        </a>
                      </div>
                    </div>

                    <div className="footer-link_wrapper">
                      <div className="footer_link_heading">Social Media</div>
                      <div className="dropdown-links">
                        <a
                          className="inner-link w-inline-block"
                          href="https://x.com/privatumrh"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <div>X</div>
                        </a>
                        <a
                          className="inner-link w-inline-block"
                          href="https://github.com/PrivatumRH/privatum"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <div>GitHub</div>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="footer-links_bottom_wrapper">
                  <div className="footer_divider"></div>
                  <div className="footer-bottom_details-wrapper">
                    <p className="text-size-small footer-bottom_text">
                      Private payments. Non-custodial. On Robinhood Chain. Hold, send, and swap frontier assets (USDG &amp; native ETH) with 2-of-3 threshold security.
                    </p>
                  </div>
                  <div className="footer-socials_award_wrapper">
                    <div className="footer-socials_wrapper">
                      <a
                        aria-label="PRIVATUM on X"
                        className="w-inline-block"
                        href="https://x.com/privatumrh"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <div className="social">
                          <svg fill="none" viewBox="0 0 24 24" width="100%" xmlns="http://www.w3.org/2000/svg">
                            <path
                              d="M18.9 2H22L15.2 9.8L23.3 22H17L12.1 15.6L6.5 22H3.3L10.6 13.7L2.8 2H9.2L13.6 7.9L18.9 2ZM17.8 20.1H19.5L7.1 3.8H5.3L17.8 20.1Z"
                              fill="currentColor"
                            />
                          </svg>
                        </div>
                      </a>
                      <a
                        aria-label="PRIVATUM on GitHub"
                        className="w-inline-block"
                        href="https://github.com/PrivatumRH/privatum"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <div className="social">
                          <svg fill="none" viewBox="0 0 24 24" width="100%" xmlns="http://www.w3.org/2000/svg">
                            <path
                              fillRule="evenodd"
                              clipRule="evenodd"
                              d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                              fill="currentColor"
                            />
                          </svg>
                        </div>
                      </a>
                    </div>
                  </div>
                  <div className="footer_divider"></div>
                  <div className="copywrite_wrapper">
                    <div className="text-size-small">© 2026 Privatum. All rights reserved.</div>
                    <div className="bottom-links_wrapper"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Marquee Keyframe Styles */}
      <style>{`
        @keyframes privatumMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
      `}</style>
    </div>
  );
}
