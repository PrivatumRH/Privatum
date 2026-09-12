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
  const [androidBtnHover, setAndroidBtnHover] = useState(false);
  const [cardBtnHover, setCardBtnHover] = useState(false);

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
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0a0a0b",
        color: "#ffffff",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Header Navigation */}
      <header
        style={{
          borderBottom: "1px solid #27272a",
          backgroundColor: "rgba(10, 10, 11, 0.95)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: "1152px",
            margin: "0 auto",
            padding: "0 1.5rem",
            height: "64px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Logo Brand Item */}
          <a
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              textDecoration: "none",
            }}
          >
            <img
              alt="PRIVATUM logo"
              src="/assets/privatum-mark-black.png"
              style={{
                width: "32px",
                height: "32px",
                maxWidth: "32px",
                maxHeight: "32px",
                objectFit: "contain",
                display: "block",
                filter: "invert(1)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontWeight: 700,
                fontSize: "1.125rem",
                letterSpacing: "-0.025em",
                color: "#ffffff",
              }}
            >
              PRIVATUM
            </span>
          </a>

          {/* Nav Links */}
          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1.5rem",
              fontSize: "0.875rem",
            }}
          >
            <a
              href="/"
              style={{
                color: "#a1a1aa",
                textDecoration: "none",
                transition: "color 0.2s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#a1a1aa")}
            >
              Home
            </a>
            <a
              href="/#download"
              style={{
                color: "#a1a1aa",
                textDecoration: "none",
                transition: "color 0.2s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#a1a1aa")}
            >
              Desktop
            </a>
            <a
              href="/docs.html"
              style={{
                color: "#a1a1aa",
                textDecoration: "none",
                transition: "color 0.2s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#a1a1aa")}
            >
              Docs
            </a>
            <a
              href="https://github.com/PrivatumRH/privatum"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                color: "#a1a1aa",
                textDecoration: "none",
                transition: "color 0.2s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#a1a1aa")}
            >
              <span>GitHub</span>
              <ExternalLink style={{ width: "14px", height: "14px" }} />
            </a>
          </nav>
        </div>
      </header>

      <main
        style={{
          maxWidth: "1152px",
          margin: "0 auto",
          padding: "3.5rem 1.5rem 6rem",
        }}
      >
        {/* Hero Section */}
        <div
          style={{
            maxWidth: "768px",
            margin: "0 auto 5rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "#f54842",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: "1rem",
            }}
          >
            <Smartphone style={{ width: "16px", height: "16px" }} />
            <span>Mobile Self-Custody</span>
          </div>

          <h1
            style={{
              fontSize: "clamp(2rem, 5vw, 3.25rem)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "#ffffff",
              lineHeight: 1.15,
              marginBottom: "1.5rem",
            }}
          >
            Private payments on Robinhood Chain, in your pocket.
          </h1>

          <p
            style={{
              fontSize: "1.125rem",
              color: "#a1a1aa",
              lineHeight: 1.6,
              marginBottom: "2.5rem",
              maxWidth: "680px",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            A fast, non-custodial mobile wallet built for Robinhood Chain. Threshold 2-of-3 quorum,
            in-app spending guardrails, and disposable pay links without seed phrase vulnerabilities.
          </p>

          {/* Action CTAs */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "center",
              gap: "1rem",
            }}
          >
            <a
              href={downloadUrl}
              onMouseEnter={() => setAndroidBtnHover(true)}
              onMouseLeave={() => setAndroidBtnHover(false)}
              style={{
                backgroundColor: androidBtnHover ? "#d93832" : "#f54842",
                color: "#ffffff",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.625rem",
                padding: "0.875rem 2rem",
                borderRadius: "0.75rem",
                fontWeight: 600,
                fontSize: "0.875rem",
                textDecoration: "none",
                boxShadow: "0 10px 25px -5px rgba(245, 72, 66, 0.3)",
                transition: "background-color 0.2s ease",
              }}
            >
              <Download style={{ width: "16px", height: "16px" }} />
              <span>Download for Android (APK)</span>
            </a>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.625rem",
                padding: "0.875rem 1.5rem",
                borderRadius: "0.75rem",
                border: "1px solid #27272a",
                backgroundColor: "#141416",
                color: "#a1a1aa",
                fontSize: "0.875rem",
                fontWeight: 500,
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: "#f54842",
                }}
              />
              <span>iOS: Coming soon</span>
            </div>
          </div>

          {releaseInfo?.version && (
            <p
              style={{
                fontSize: "0.75rem",
                color: "#71717a",
                marginTop: "1rem",
              }}
            >
              Latest release: {releaseInfo.version} • Android 8.0+ (ARM64 / x86_64)
            </p>
          )}
        </div>

        {/* Feature Grid */}
        <div style={{ marginBottom: "6rem" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <h2
              style={{
                fontSize: "1.75rem",
                fontWeight: 700,
                letterSpacing: "-0.025em",
                color: "#ffffff",
                marginBottom: "0.75rem",
              }}
            >
              Engineered for Mobile Freedom
            </h2>
            <p
              style={{
                fontSize: "1rem",
                color: "#a1a1aa",
                maxWidth: "560px",
                margin: "0 auto",
              }}
            >
              Everything you need to transact safely on Robinhood Chain without central counterparty risk.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {CORE_CAPABILITIES.map((cap) => {
              const Icon = cap.icon;
              return (
                <div
                  key={cap.title}
                  style={{
                    borderRadius: "1rem",
                    border: "1px solid #27272a",
                    backgroundColor: "#111113",
                    padding: "1.75rem",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "0.75rem",
                        backgroundColor: "#18181b",
                        border: "1px solid #27272a",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#f54842",
                        marginBottom: "1.25rem",
                      }}
                    >
                      <Icon style={{ width: "20px", height: "20px" }} />
                    </div>
                    <h3
                      style={{
                        fontSize: "1rem",
                        fontWeight: 600,
                        color: "#ffffff",
                        marginBottom: "0.5rem",
                      }}
                    >
                      {cap.title}
                    </h3>
                    <p
                      style={{
                        fontSize: "0.875rem",
                        color: "#a1a1aa",
                        lineHeight: 1.55,
                        margin: 0,
                      }}
                    >
                      {cap.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Download & Platform Availability Section */}
        <div
          style={{
            borderRadius: "1.5rem",
            border: "1px solid #27272a",
            backgroundColor: "#111113",
            padding: "clamp(1.5rem, 4vw, 3rem)",
            marginBottom: "5rem",
          }}
        >
          <div style={{ maxWidth: "640px", marginBottom: "2.5rem" }}>
            <h2
              style={{
                fontSize: "1.75rem",
                fontWeight: 700,
                color: "#ffffff",
                letterSpacing: "-0.025em",
                marginBottom: "0.75rem",
              }}
            >
              Get the App
            </h2>
            <p style={{ fontSize: "0.95rem", color: "#a1a1aa", margin: 0 }}>
              Install the Android APK directly today. iOS TestFlight and App Store distribution are currently in progress.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {/* Android Card */}
            <div
              style={{
                borderRadius: "1rem",
                border: "1px solid #27272a",
                backgroundColor: "#18181b",
                padding: "2rem",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "1rem",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "1.125rem",
                      fontWeight: 700,
                      color: "#ffffff",
                      margin: 0,
                    }}
                  >
                    Android
                  </h3>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "#a1a1aa",
                    }}
                  >
                    Ready to Install
                  </span>
                </div>
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "#a1a1aa",
                    lineHeight: 1.5,
                    marginBottom: "1.5rem",
                  }}
                >
                  Direct standalone APK package for all modern Android phones and tablets.
                </p>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.625rem",
                    fontSize: "0.8125rem",
                    color: "#d4d4d8",
                    marginBottom: "2rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Check style={{ width: "16px", height: "16px", color: "#f54842", flexShrink: 0 }} />
                    <span>Native Robinhood Chain execution (Chain ID 4663)</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Check style={{ width: "16px", height: "16px", color: "#f54842", flexShrink: 0 }} />
                    <span>Full 2-of-3 threshold custody with local Shard A</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Check style={{ width: "16px", height: "16px", color: "#f54842", flexShrink: 0 }} />
                    <span>In-app spending limits and private address book</span>
                  </div>
                </div>
              </div>

              <a
                href={downloadUrl}
                onMouseEnter={() => setCardBtnHover(true)}
                onMouseLeave={() => setCardBtnHover(false)}
                style={{
                  backgroundColor: cardBtnHover ? "#d93832" : "#f54842",
                  color: "#ffffff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.625rem",
                  width: "100%",
                  padding: "0.875rem",
                  borderRadius: "0.75rem",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  textDecoration: "none",
                  transition: "background-color 0.2s ease",
                }}
              >
                <Download style={{ width: "16px", height: "16px" }} />
                <span>Download Android APK</span>
              </a>
            </div>

            {/* iOS Card */}
            <div
              style={{
                borderRadius: "1rem",
                border: "1px solid #27272a",
                backgroundColor: "#18181b",
                padding: "2rem",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "1rem",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "1.125rem",
                      fontWeight: 700,
                      color: "#ffffff",
                      margin: 0,
                    }}
                  >
                    iOS
                  </h3>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "#f54842",
                      fontWeight: 500,
                    }}
                  >
                    Coming Soon
                  </span>
                </div>
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "#a1a1aa",
                    lineHeight: 1.5,
                    marginBottom: "1.5rem",
                  }}
                >
                  Apple TestFlight beta and App Store release are currently undergoing packaging and review.
                </p>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.625rem",
                    fontSize: "0.8125rem",
                    color: "#71717a",
                    marginBottom: "2rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#71717a", flexShrink: 0 }} />
                    <span>Apple Secure Enclave Shard A storage</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#71717a", flexShrink: 0 }} />
                    <span>Face ID and Touch ID biometric authentication</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#71717a", flexShrink: 0 }} />
                    <span>Public TestFlight link will be announced on X</span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  width: "100%",
                  padding: "0.875rem",
                  borderRadius: "0.75rem",
                  border: "1px solid #27272a",
                  backgroundColor: "#141416",
                  color: "#71717a",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  cursor: "not-allowed",
                }}
              >
                <span>iOS Build In Progress</span>
              </div>
            </div>
          </div>
        </div>

        {/* Installation Guide */}
        <div style={{ marginBottom: "5rem" }}>
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "-0.025em",
              marginBottom: "2rem",
              textAlign: "center",
            }}
          >
            How to Install the Android APK
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {INSTALL_STEPS.map((item) => (
              <div
                key={item.step}
                style={{
                  borderRadius: "1rem",
                  border: "1px solid #27272a",
                  backgroundColor: "#111113",
                  padding: "1.5rem",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "0.5rem",
                    backgroundColor: "#18181b",
                    border: "1px solid #27272a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "#f54842",
                    marginBottom: "1rem",
                  }}
                >
                  {item.step}
                </div>
                <h3
                  style={{
                    fontSize: "1rem",
                    fontWeight: 600,
                    color: "#ffffff",
                    marginBottom: "0.5rem",
                  }}
                >
                  {item.title}
                </h3>
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "#a1a1aa",
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid #27272a",
          backgroundColor: "#0a0a0b",
          padding: "2.5rem 1.5rem",
        }}
      >
        <div
          style={{
            maxWidth: "1152px",
            margin: "0 auto",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            fontSize: "0.75rem",
            color: "#71717a",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontWeight: 600, color: "#a1a1aa" }}>PRIVATUM</span>
            <span>Robinhood Chain L2 (Chain ID 4663)</span>
          </div>
          <div>© 2026 Privatum. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
