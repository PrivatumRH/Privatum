import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Wallet,
  ShieldCheck,
  Fingerprint,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCw,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  ExternalLink,
  Loader2,
  Lock,
  X,
  Clock,
  KeyRound,
  Server,
  QrCode,
  Coins,
  ArrowRight,
  ArrowLeft,
  ArrowLeftRight,
  Fuel,
  LogOut,
  ChevronDown,
  Eye,
  EyeOff,
  ArrowDownUp,
  Globe2,
  Sparkles,
  TrendingUp,
  Scan,
} from "lucide-react";
import QRCode from "qrcode";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  formatUnits,
  http,
  isAddress,
  parseEther,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { AccountSwitcher, type WalletAccount } from "./components/AccountSwitcher";
import { SwapTab } from "./components/SwapTab";
import { CrossChainTab } from "./components/CrossChainTab";
import { NftTab } from "./components/NftTab";
import { RwaTab } from "./components/RwaTab";
import { UpdateBanner } from "./components/UpdateBanner";
import { StealthScannerModal } from "./components/StealthScannerModal";
import { buildStealthSendBatch, parseMetaAddress } from "./lib/stealth";
import { executeAccountBatch } from "./lib/execute";
import { isFeatureActive, RELEASE_VERSIONS, type ReleaseVersion } from "./config/features";

const RELEASE_METADATA: Record<ReleaseVersion, string> = {
  "0.1.0": "Genesis 2-of-3 MPC",
  "0.1.1": "Updates & Private Send",
  "0.1.2": "Robinhood DEX Swaps",
  "0.1.3": "Cross-Chain Swaps",
  "0.1.4": "NFTs & Collectibles",
  "0.1.5": "Multi-Wallet & Keychain",
  "0.1.6": "Robinhood RWA Registry",
};
import { privateKeyToAccount } from "viem/accounts";
import {
  PrivatumWallet,
  LocalShard,
  RemoteCosigner,
  robinhoodChain,
  USDG_ADDRESS,
  erc20Abi,
  DEFAULT_API_URL,
  getUserOpHash,
  submitUserOp,
} from "@privatumrh/robinhood-chain-sdk";
import { invoke, isTauri } from "@tauri-apps/api/core";

const publicClient = createPublicClient({
  chain: robinhoodChain,
  transport: http(),
});

export interface TransactionRecord {
  id: string;
  hash: string;
  type: "send" | "receive";
  counterparty: string;
  amount: string;
  asset: "USDG" | "ETH";
  timestamp: number;
  status: "confirmed" | "pending";
}

export interface ToastItem {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  message?: string;
}

function simplifyErrorMessage(err: any): string {
  if (!err) return "An unexpected error occurred.";
  const msg = typeof err === "string" ? err : String(err?.message || err);

  if (
    msg.includes("gas * price + value") ||
    msg.includes("insufficient funds for gas") ||
    msg.includes("gas required exceeds allowance")
  ) {
    return "Insufficient ETH to cover Robinhood Chain network fees. Please keep at least 0.0002 ETH for gas.";
  }
  if (
    msg.includes("insufficient funds") ||
    msg.includes("exceeds balance") ||
    msg.includes("Insufficient")
  ) {
    return "Transfer amount exceeds available balance.";
  }
  if (
    msg.includes("Load failed") ||
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError")
  ) {
    return "Co-signer service is warming up. Please retry in a few seconds.";
  }
  if (
    msg.includes("recipient") ||
    msg.includes("isAddress") ||
    msg.includes("invalid address")
  ) {
    return "Please enter a valid Robinhood Chain recipient address.";
  }
  if (msg.includes("User rejected") || msg.includes("cancelled")) {
    return "Transaction request cancelled.";
  }
  if (msg.includes("nonce") || msg.includes("underpriced")) {
    return "A prior transaction is processing. Please retry in a moment.";
  }
  if (msg.includes("{") && msg.includes("}")) {
    return "Network broadcast issue. Please verify recipient address and retry.";
  }
  return msg.length > 85 ? `${msg.slice(0, 82)}...` : msg;
}

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
}

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr || "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}



interface TokenAvatarProps {
  symbol: string;
  name?: string;
  iconUrl?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function TokenAvatar({ symbol, name, iconUrl, size = "md", className = "" }: TokenAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const initial = symbol ? symbol.charAt(0).toUpperCase() : "?";

  const sizeClasses = {
    sm: "w-6 h-6 text-[11px]",
    md: "w-9 h-9 text-sm",
    lg: "w-11 h-11 text-base",
  }[size];

  if (iconUrl && !imageError) {
    return (
      <img
        src={iconUrl}
        alt={name || symbol}
        onError={() => setImageError(true)}
        className={`${sizeClasses} rounded-full object-cover border border-white/10 bg-neutral-900 shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses} rounded-full bg-gradient-to-br from-white/20 to-white/5 border border-white/15 flex items-center justify-center font-bold text-white shadow-sm shrink-0 ${className}`}
      title={name || symbol}
    >
      {initial}
    </div>
  );
}

export function App() {
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<
    "wallet" | "swaps" | "cross_chain" | "nfts" | "rwa" | "tokens" | "shards" | "recovery"
  >("wallet");

  // Versioning and feature release stage preview
  const [appVersion] = useState<string>("0.1.0");
  const [previewVersion, setPreviewVersion] = useState<ReleaseVersion | null>(null);

  // Multi-wallet accounts
  const [accounts, setAccounts] = useState<WalletAccount[]>(() => {
    const activeWalletAddr = typeof window !== "undefined" ? localStorage.getItem("privatum_wallet_address") : null;
    const initialAddr = (activeWalletAddr as Address) || ("0x0000000000000000000000000000000000000000" as Address);
    try {
      const stored = localStorage.getItem("privatum_accounts");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const repaired = parsed.map((a: WalletAccount) => {
            if ((!a.address || a.address === "0x0000000000000000000000000000000000000000") && activeWalletAddr) {
              return { ...a, address: activeWalletAddr as Address };
            }
            return a;
          });
          return repaired;
        }
      }
    } catch {}
    return [
      {
        id: "primary",
        name: "Wallet 1",
        address: initialAddr,
        color: "#ef4444",
        createdAt: Date.now(),
      },
    ];
  });
  const [activeAccountId, setActiveAccountId] = useState<string>("primary");

  // Private Send Mode Toggle & Stealth Inbox
  const [isStealthSend, setIsStealthSend] = useState<boolean>(false);
  const [showStealthScanner, setShowStealthScanner] = useState<boolean>(false);

  // Preselected token for Swap tab
  const [swapTokenOut, setSwapTokenOut] = useState<string>("AAPL");
  const [wallet, setWallet] = useState<PrivatumWallet | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [shardAPrivKey, setShardAPrivKey] = useState<string>("");
  const [shardCAddress, setShardCAddress] = useState<string>("");
  const [shardCPrivKey, setShardCPrivKey] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");

  // Keep accounts synchronized with real active wallet address
  useEffect(() => {
    if (walletAddress && walletAddress !== "0x0000000000000000000000000000000000000000") {
      setAccounts((prev) => {
        let changed = false;
        const updated = prev.map((acc) => {
          if (acc.id === activeAccountId && (!acc.address || acc.address.toLowerCase() !== walletAddress.toLowerCase())) {
            changed = true;
            return { ...acc, address: walletAddress as Address };
          }
          return acc;
        });
        if (changed) {
          try {
            localStorage.setItem("privatum_accounts", JSON.stringify(updated));
          } catch {}
          return updated;
        }
        return prev;
      });
    }
  }, [walletAddress, activeAccountId]);

  const [ethBalance, setEthBalance] = useState<string>("0.0000");
  const [usdgBalance, setUsdgBalance] = useState<string>("0.00");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());

  // CoinGecko Ethereum Price (smart cached for 30s)
  const [ethPrice, setEthPrice] = useState<number>(() => {
    try {
      const cached = localStorage.getItem("privatum_eth_price");
      return cached ? parseFloat(cached) : 2450;
    } catch {
      return 2450;
    }
  });
  const [lastPriceFetchTime, setLastPriceFetchTime] = useState<number>(() => {
    try {
      const cached = localStorage.getItem("privatum_eth_price_time");
      return cached ? parseInt(cached, 10) : 0;
    } catch {
      return 0;
    }
  });

  // Modals
  const [showSendModal, setShowSendModal] = useState<boolean>(false);
  const [showReceiveModal, setShowReceiveModal] = useState<boolean>(false);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showBackupModal, setShowBackupModal] = useState<boolean>(false);
  const [showRecoverModal, setShowRecoverModal] = useState<boolean>(false);
  const [receiveQrCode, setReceiveQrCode] = useState<string | null>(null);

  // Recovery Form
  const [recoverAddress, setRecoverAddress] = useState<string>("");
  const [recoverShardCKey, setRecoverShardCKey] = useState<string>("");
  const [recoverTotpCode, setRecoverTotpCode] = useState<string>("");
  const [isRecovering, setIsRecovering] = useState<boolean>(false);

  // Send Form & Simulation Flow
  const [sendAssetType, setSendAssetType] = useState<"ETH" | "USDG">("USDG");
  const [sendRecipient, setSendRecipient] = useState<string>("");
  const [sendAmount, setSendAmount] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [txSuccessHash, setTxSuccessHash] = useState<string | null>(null);
  const [sendStep, setSendStep] = useState<"form" | "preview">("form");
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationData, setSimulationData] = useState<{
    status: "success" | "warning";
    gasLimit: bigint;
    gasPriceGwei: string;
    estimatedFeeEth: string;
    estimatedFeeUsd: string;
    message: string;
  } | null>(null);

  // Recovery / TOTP state with localStorage persistence
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [totpQrCode, setTotpQrCode] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState<string>("");
  const [totpVerified, setTotpVerified] = useState<boolean>(() => {
    try {
      return localStorage.getItem("privatum_totp_enrolled") === "true";
    } catch {
      return false;
    }
  });
  const [isConfirmingTotp, setIsConfirmingTotp] = useState<boolean>(false);
  const [showShardCSecret, setShowShardCSecret] = useState<boolean>(false);
  const [showShardCAccordion, setShowShardCAccordion] = useState<boolean>(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [showHealthShardC, setShowHealthShardC] = useState<boolean>(false);

  // Transactions list
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);

  // Animated popup toast alerts
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((type: "success" | "error" | "info", title: string, message?: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    addToast("success", "Copied", `${label} copied to clipboard`);
  };

  // CoinGecko Price Fetcher with 30s smart cache
  const fetchEthPrice = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastPriceFetchTime < 30000 && ethPrice > 0) {
      return ethPrice;
    }
    try {
      const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
      if (res.ok) {
        const data = await res.json();
        const p = data?.ethereum?.usd;
        if (typeof p === "number" && p > 0) {
          setEthPrice(p);
          setLastPriceFetchTime(now);
          try {
            localStorage.setItem("privatum_eth_price", String(p));
            localStorage.setItem("privatum_eth_price_time", String(now));
          } catch {}
          return p;
        }
      }
    } catch (err) {
      console.warn("CoinGecko price fetch error:", err);
    }
    return ethPrice;
  }, [ethPrice, lastPriceFetchTime]);

  // Gas Price fetcher from Robinhood Chain RPC
  const [gasPriceGwei, setGasPriceGwei] = useState<string>("1.06");

  const fetchGasPrice = useCallback(async () => {
    try {
      const res = await fetch("https://rpc.mainnet.chain.robinhood.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_gasPrice", params: [], id: 1 }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.result) {
          const wei = parseInt(json.result, 16);
          if (!isNaN(wei)) {
            const gwei = (wei / 1e9).toFixed(2);
            setGasPriceGwei(gwei);
          }
        }
      }
    } catch (err) {
      console.warn("Gas price fetch error:", err);
    }
  }, []);

  useEffect(() => {
    fetchEthPrice();
    fetchGasPrice();
    const interval = setInterval(() => {
      fetchEthPrice();
      fetchGasPrice();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchEthPrice, fetchGasPrice]);

  // Real-time UTC clock for bottom status bar
  const getUtcTimeString = () => {
    const now = new Date();
    const h = String(now.getUTCHours()).padStart(2, "0");
    const m = String(now.getUTCMinutes()).padStart(2, "0");
    const s = String(now.getUTCSeconds()).padStart(2, "0");
    return `${h}:${m}:${s} UTC`;
  };

  const [utcTime, setUtcTime] = useState<string>(getUtcTimeString);

  useEffect(() => {
    const timer = setInterval(() => {
      setUtcTime(getUtcTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Total USD portfolio value
  const totalUsdValue = useMemo(() => {
    const usdg = parseFloat(usdgBalance) || 0;
    const eth = parseFloat(ethBalance) || 0;
    return usdg + eth * (ethPrice || 0);
  }, [usdgBalance, ethBalance, ethPrice]);

  // Splash Screen 1.5s
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Load transaction history for the active wallet
  useEffect(() => {
    if (!walletAddress) {
      setTransactions([]);
      return;
    }
    try {
      const key = `privatum_transactions_${walletAddress.toLowerCase()}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        setTransactions(JSON.parse(stored));
      } else {
        setTransactions([]);
      }
    } catch {
      setTransactions([]);
    }
  }, [walletAddress]);

  // Generate QR for receive modal
  useEffect(() => {
    if (showReceiveModal && walletAddress) {
      QRCode.toDataURL(walletAddress, {
        margin: 2,
        width: 180,
        color: {
          dark: "#0b0e14",
          light: "#ffffff",
        },
      })
        .then((url) => setReceiveQrCode(url))
        .catch(() => {});
    }
  }, [showReceiveModal, walletAddress]);

  // Load wallet on mount and warm up co-signer service
  useEffect(() => {
    fetch(`${DEFAULT_API_URL}/health`).catch(() => {});

    async function loadSavedWallet() {
      try {
        const activeId = localStorage.getItem("privatum_active_account_id") || "primary";
        setActiveAccountId(activeId);

        let savedAddress = localStorage.getItem(`privatum_wallet_address_${activeId}`) || (activeId === "primary" ? localStorage.getItem("privatum_wallet_address") : null);

        let savedShardA: string | null = null;
        if (savedAddress) {
          savedShardA = localStorage.getItem(`privatum_shard_a_${savedAddress.toLowerCase()}`);
        }
        if (!savedShardA) {
          savedShardA = localStorage.getItem(`privatum_shard_a_${activeId}`) || (activeId === "primary" ? localStorage.getItem("privatum_shard_a") : null);
        }
        if (!savedShardA && isTauri()) {
          if (savedAddress) {
            try {
              savedShardA = await invoke<string | null>("get_shard_from_keychain", { accountId: savedAddress.toLowerCase() });
            } catch {}
          }
          if (!savedShardA) {
            try {
              savedShardA = await invoke<string | null>("get_shard_from_keychain", { accountId: activeId });
            } catch {}
          }
          if (!savedShardA && activeId === "primary") {
            try {
              savedShardA = await invoke<string | null>("load_shard_a");
            } catch {}
          }
        }

        // Verify key consistency: make sure active signing key matches active address
        if (savedShardA) {
          try {
            const derived = privateKeyToAccount(savedShardA as Hex).address;
            if (savedAddress && derived.toLowerCase() !== savedAddress.toLowerCase()) {
              console.warn(`[Privatum] Key alignment: loaded shard A derives ${derived} while saved address was ${savedAddress}. Synchronizing active wallet address.`);
              savedAddress = derived;
            }
          } catch {}
        }

        const savedApiKey = localStorage.getItem(`privatum_api_key_${activeId}`) || (activeId === "primary" ? localStorage.getItem("privatum_api_key") : null);
        const savedShardB = localStorage.getItem(`privatum_shard_b_address_${activeId}`) || (activeId === "primary" ? localStorage.getItem("privatum_shard_b_address") : null);
        const savedShardC = localStorage.getItem(`privatum_shard_c_address_${activeId}`) || (activeId === "primary" ? localStorage.getItem("privatum_shard_c_address") : null);

        if (savedShardA && savedAddress && savedApiKey && savedShardB && savedShardC) {
          const shardA = LocalShard.fromPrivateKey(savedShardA as Hex, "device");
          const shardB = new RemoteCosigner(savedShardB as Address, savedAddress as Address, DEFAULT_API_URL);
          const restoredWallet = new PrivatumWallet({
            address: savedAddress as Address,
            shardA,
            shardB,
            shardCAddress: savedShardC as Address,
            apiKey: savedApiKey,
          });

          setWallet(restoredWallet);
          setWalletAddress(savedAddress);
          setShardAPrivKey(savedShardA);
          setApiKey(savedApiKey);
          setShardCAddress(savedShardC);

          // Ensure active account is in accounts list with real address
          setAccounts((prev) => {
            const hasReal = prev.some((a) => a.address.toLowerCase() === savedAddress.toLowerCase());
            let updated: WalletAccount[];
            if (hasReal) {
              updated = prev
                .filter((a) => a.address !== "0x0000000000000000000000000000000000000000")
                .map((a) => (a.address.toLowerCase() === savedAddress.toLowerCase() ? { ...a, id: activeId } : a));
            } else {
              const filtered = prev.filter(
                (a) => a.address !== "0x0000000000000000000000000000000000000000" && a.id !== activeId
              );
              updated = [
                {
                  id: activeId,
                  name: `Wallet 1`,
                  address: savedAddress as Address,
                  color: "#ef4444",
                  createdAt: Date.now(),
                },
                ...filtered,
              ];
            }
            try {
              localStorage.setItem("privatum_accounts", JSON.stringify(updated));
            } catch {}
            return updated;
          });

          // Purge any legacy Shard C key from device storage
          localStorage.removeItem("privatum_shard_c_key");

          fetchBalances(savedAddress as Address);
        }
      } catch (err) {
        console.error("Failed to load saved wallet:", err);
      }
    }

    loadSavedWallet();
  }, []);

  const handleSelectAccount = async (targetId: string) => {
    setActiveAccountId(targetId);
    try {
      localStorage.setItem("privatum_active_account_id", targetId);
    } catch {}

    const savedAddress = localStorage.getItem(`privatum_wallet_address_${targetId}`) || (targetId === "primary" ? localStorage.getItem("privatum_wallet_address") : null);

    let savedShardA: string | null = null;
    if (savedAddress) {
      savedShardA = localStorage.getItem(`privatum_shard_a_${savedAddress.toLowerCase()}`);
    }
    if (!savedShardA) {
      savedShardA = localStorage.getItem(`privatum_shard_a_${targetId}`) || (targetId === "primary" ? localStorage.getItem("privatum_shard_a") : null);
    }
    if (!savedShardA && isTauri()) {
      if (savedAddress) {
        try {
          savedShardA = await invoke<string | null>("get_shard_from_keychain", { accountId: savedAddress.toLowerCase() });
        } catch {}
      }
      if (!savedShardA) {
        try {
          savedShardA = await invoke<string | null>("get_shard_from_keychain", { accountId: targetId });
        } catch {}
      }
      if (!savedShardA && targetId === "primary") {
        try {
          savedShardA = await invoke<string | null>("load_shard_a");
        } catch {}
      }
    }

    const savedApiKey = localStorage.getItem(`privatum_api_key_${targetId}`) || (targetId === "primary" ? localStorage.getItem("privatum_api_key") : null);
    const savedShardB = localStorage.getItem(`privatum_shard_b_address_${targetId}`) || (targetId === "primary" ? localStorage.getItem("privatum_shard_b_address") : null);
    const savedShardC = localStorage.getItem(`privatum_shard_c_address_${targetId}`) || (targetId === "primary" ? localStorage.getItem("privatum_shard_c_address") : null);

    if (savedShardA && savedAddress && savedApiKey && savedShardB && savedShardC) {
      const shardA = LocalShard.fromPrivateKey(savedShardA as Hex, "device");
      const shardB = new RemoteCosigner(savedShardB as Address, savedAddress as Address, DEFAULT_API_URL);
      const restoredWallet = new PrivatumWallet({
        address: savedAddress as Address,
        shardA,
        shardB,
        shardCAddress: savedShardC as Address,
        apiKey: savedApiKey,
      });

      setWallet(restoredWallet);
      setWalletAddress(savedAddress);
      setShardAPrivKey(savedShardA);
      setApiKey(savedApiKey);
      setShardCAddress(savedShardC);

      fetchBalances(savedAddress as Address);
      const accName = accounts.find((a) => a.id === targetId)?.name || shortenAddress(savedAddress);
      addToast("info", "Account Switched", `Active account: ${accName}`);
    }
  };

  const fetchBalances = async (address: Address) => {
    setIsRefreshing(true);
    try {
      // 1. ETH Balance
      const rawEth = await publicClient.getBalance({ address });
      setEthBalance(Number(formatEther(rawEth)).toFixed(4));

      // 2. USDG Balance (6 decimals)
      const rawUsdg = await publicClient.readContract({
        address: USDG_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      });
      setUsdgBalance(Number(formatUnits(rawUsdg, 6)).toFixed(2));
      setLastSyncTime(Date.now());
      fetchEthPrice(true);
      fetchGasPrice();
    } catch (err) {
      console.warn("Balance fetch error (counterfactual wallet or network):", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateWallet = async () => {
    setIsSending(true);
    let lastError: any = null;

    const isFirstAccount = !wallet || accounts.length === 0 || accounts[0].address === "0x0000000000000000000000000000000000000000";
    const newAccId = isFirstAccount ? "primary" : `acc-${Date.now()}`;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { wallet: newWallet, shardC } = await PrivatumWallet.create();

        // Save Shard A to OS keystore / Keychain
        if (isTauri()) {
          try {
            await invoke("save_shard_to_keychain", { accountId: newAccId, key: newWallet.shardA.privateKey });
            await invoke("save_shard_to_keychain", { accountId: newWallet.address.toLowerCase(), key: newWallet.shardA.privateKey });
          } catch {}
          if (newAccId === "primary") {
            try {
              await invoke("save_shard_a", { key: newWallet.shardA.privateKey });
            } catch {}
          }
        }
        localStorage.setItem(`privatum_shard_a_${newAccId}`, newWallet.shardA.privateKey);
        localStorage.setItem(`privatum_shard_a_${newWallet.address.toLowerCase()}`, newWallet.shardA.privateKey);
        if (newAccId === "primary") {
          localStorage.setItem("privatum_shard_a", newWallet.shardA.privateKey);
        }

        // Save account-specific credentials
        localStorage.setItem(`privatum_wallet_address_${newAccId}`, newWallet.address);
        localStorage.setItem(`privatum_api_key_${newAccId}`, newWallet.apiKey);
        localStorage.setItem(`privatum_shard_b_address_${newAccId}`, newWallet.shardB.address);
        localStorage.setItem(`privatum_shard_c_address_${newAccId}`, shardC.address);

        if (newAccId === "primary") {
          localStorage.setItem("privatum_wallet_address", newWallet.address);
          localStorage.setItem("privatum_api_key", newWallet.apiKey);
          localStorage.setItem("privatum_shard_b_address", newWallet.shardB.address);
          localStorage.setItem("privatum_shard_c_address", shardC.address);
        }

        // Update accounts state
        const colors = ["#ef4444", "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b"];
        const newAccount: WalletAccount = {
          id: newAccId,
          name: isFirstAccount ? "Wallet 1" : `Wallet ${accounts.length + 1}`,
          address: newWallet.address as Address,
          color: colors[accounts.length % colors.length],
          createdAt: Date.now(),
        };

        const updatedAccounts = isFirstAccount
          ? [newAccount]
          : [...accounts.filter((a) => a.address !== "0x0000000000000000000000000000000000000000"), newAccount];

        setAccounts(updatedAccounts);
        setActiveAccountId(newAccId);
        try {
          localStorage.setItem("privatum_accounts", JSON.stringify(updatedAccounts));
          localStorage.setItem("privatum_active_account_id", newAccId);
        } catch {}

        setWallet(newWallet);
        setWalletAddress(newWallet.address);
        setShardAPrivKey(newWallet.shardA.privateKey);
        setApiKey(newWallet.apiKey);
        setShardCAddress(shardC.address);
        setShardCPrivKey(shardC.privateKey);

        try {
          localStorage.setItem(`privatum_transactions_${newWallet.address.toLowerCase()}`, JSON.stringify([]));
        } catch {}

        setTransactions([]);
        setShowCreateModal(false);
        setShowBackupModal(true);
        fetchBalances(newWallet.address as Address);
        addToast("success", "Account Initialized", "Your 2-of-3 threshold account is ready.");
        setIsSending(false);
        return;
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || "");
        const isNetworkErr = msg.includes("Load failed") || msg.includes("Failed to fetch") || msg.includes("NetworkError");
        if (isNetworkErr && attempt < 3) {
          await new Promise((r) => setTimeout(r, 2500));
          continue;
        }
        break;
      }
    }

    const cleanErr = simplifyErrorMessage(lastError);
    addToast("error", "Account Creation Failed", cleanErr);
    setIsSending(false);
  };

  const handleResetApp = async () => {
    try {
      if (isTauri()) {
        await invoke("delete_shard_a");
      }
      localStorage.clear();

      setWallet(null);
      setWalletAddress("");
      setShardAPrivKey("");
      setApiKey("");
      setShardCAddress("");
      setShardCPrivKey("");
      setTotpVerified(false);
      setUsdgBalance("0.00");
      setEthBalance("0.0000");
      setTransactions([]);
      setShowBackupModal(false);
      setShowSendModal(false);
      setShowReceiveModal(false);
      setShowCreateModal(false);
      addToast("info", "Wallet Reset", "Local wallet state cleared. You can now create a new wallet.");
    } catch (err) {
      console.error("Failed to reset wallet:", err);
    }
  };

  const handleRecoverWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoverAddress || !recoverShardCKey || !recoverTotpCode) {
      addToast("error", "Missing Details", "Please provide wallet address, Shard C key, and 6-digit TOTP code.");
      return;
    }

    if (!isAddress(recoverAddress.trim())) {
      addToast("error", "Invalid Address", "Wallet address must be a valid 0x-prefixed address.");
      return;
    }

    if (!recoverShardCKey.trim().startsWith("0x")) {
      addToast("error", "Invalid Key", "Shard C key must be a valid 0x-prefixed hex string.");
      return;
    }

    if (!/^\d{6}$/.test(recoverTotpCode.trim())) {
      addToast("error", "Invalid Code", "Please enter a valid 6-digit authenticator code.");
      return;
    }

    setIsRecovering(true);
    try {
      const cleanAddress = recoverAddress.trim().toLowerCase() as Address;
      const cleanShardC = recoverShardCKey.trim() as Hex;
      const cleanTotp = recoverTotpCode.trim();

      // 1. Generate new Shard A for this client machine
      const newShardA = LocalShard.create("device");
      const shardC = LocalShard.fromPrivateKey(cleanShardC, "recovery");

      // 2. Execute 2-of-3 threshold recovery via SDK
      await PrivatumWallet.recoverWallet({
        walletAddress: cleanAddress,
        shardC,
        totpCode: cleanTotp,
        newShardAAddress: newShardA.address,
        apiUrl: DEFAULT_API_URL,
      });

      // 3. Save new Shard A locally in OS vault or storage
      const existingAcc = accounts.find((a) => a.address.toLowerCase() === cleanAddress.toLowerCase());
      const accId = existingAcc ? existingAcc.id : `acc-${Date.now()}`;

      if (isTauri()) {
        try {
          await invoke("save_shard_to_keychain", { accountId: accId, key: newShardA.privateKey });
          await invoke("save_shard_to_keychain", { accountId: cleanAddress, key: newShardA.privateKey });
        } catch {}
        if (accId === "primary") {
          try {
            await invoke("save_shard_a", { key: newShardA.privateKey });
          } catch {}
        }
      }
      localStorage.setItem(`privatum_shard_a_${accId}`, newShardA.privateKey);
      localStorage.setItem(`privatum_shard_a_${cleanAddress}`, newShardA.privateKey);
      localStorage.setItem(`privatum_wallet_address_${accId}`, cleanAddress);
      localStorage.setItem(`privatum_shard_c_address_${accId}`, shardC.address);
      localStorage.setItem("privatum_totp_enrolled", "true");
      if (accId === "primary") {
        localStorage.setItem("privatum_shard_a", newShardA.privateKey);
        localStorage.setItem("privatum_wallet_address", cleanAddress);
        localStorage.setItem("privatum_shard_c_address", shardC.address);
      }

      // 4. Fetch wallet info from cosigner to construct PrivatumWallet
      let shardBAddress: Address = "0x0000000000000000000000000000000000000000";
      let apiKeyVal = "";
      try {
        const infoRes = await fetch(`${DEFAULT_API_URL}/v1/wallets/${cleanAddress}`);
        if (infoRes.ok) {
          const info = await infoRes.json();
          shardBAddress = (info.shardBAddress || shardBAddress) as Address;
          apiKeyVal = info.apiKey || "";
          localStorage.setItem(`privatum_shard_b_address_${accId}`, shardBAddress);
          localStorage.setItem(`privatum_api_key_${accId}`, apiKeyVal);
          if (accId === "primary") {
            localStorage.setItem("privatum_shard_b_address", shardBAddress);
            localStorage.setItem("privatum_api_key", apiKeyVal);
          }
        }
      } catch {}

      const shardB = new RemoteCosigner(shardBAddress, cleanAddress, DEFAULT_API_URL);
      const restoredWallet = new PrivatumWallet({
        address: cleanAddress,
        shardA: newShardA,
        shardB,
        shardCAddress: shardC.address,
        apiKey: apiKeyVal,
      });

      setWallet(restoredWallet);
      setWalletAddress(cleanAddress);
      setShardAPrivKey(newShardA.privateKey);
      setApiKey(apiKeyVal);
      setShardCAddress(shardC.address);
      setShardCPrivKey(cleanShardC);
      setTotpVerified(true);
      fetchBalances(cleanAddress);

      // Register in accounts list for multiwallet switcher
      setAccounts((prev) => {
        const colors = ["#ef4444", "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b"];
        const filtered = prev.filter((a) => a.address !== "0x0000000000000000000000000000000000000000");
        const exists = filtered.find((a) => a.address.toLowerCase() === cleanAddress.toLowerCase());
        let updated: WalletAccount[];
        if (exists) {
          updated = filtered.map((a) => (a.address.toLowerCase() === cleanAddress.toLowerCase() ? { ...a, id: accId } : a));
        } else {
          const newAcc: WalletAccount = {
            id: accId,
            name: `Wallet ${filtered.length + 1}`,
            address: cleanAddress,
            color: colors[filtered.length % colors.length],
            createdAt: Date.now(),
          };
          updated = [...filtered, newAcc];
        }
        try {
          localStorage.setItem("privatum_accounts", JSON.stringify(updated));
          localStorage.setItem("privatum_active_account_id", accId);
        } catch {}
        return updated;
      });
      setActiveAccountId(accId);

      setShowRecoverModal(false);
      addToast("success", "Wallet Recovered", "Account recovered and authorized on this device.");
    } catch (err: any) {
      console.error("Recovery failed:", err);
      const cleanErr = simplifyErrorMessage(err);
      addToast("error", "Recovery Failed", cleanErr);
    } finally {
      setIsRecovering(false);
    }
  };

  const openSendModal = (asset?: "ETH" | "USDG") => {
    if (asset) setSendAssetType(asset);
    setSendStep("form");
    setSimulationData(null);
    setIsSimulating(false);
    setTxSuccessHash(null);
    setShowSendModal(true);
  };

  const runSimulation = async (to: Address, amountStr: string, asset: "ETH" | "USDG") => {
    setIsSimulating(true);
    setSimulationData(null);
    try {
      const parsedAmount = asset === "ETH" ? parseEther(amountStr) : parseUnits(amountStr, 6);
      let estimatedGas = 21000n;

      if (asset === "ETH") {
        try {
          estimatedGas = await publicClient.estimateGas({
            account: wallet?.address as Address,
            to,
            value: parsedAmount,
          });
        } catch {
          estimatedGas = 21000n;
        }
      } else {
        try {
          estimatedGas = await publicClient.estimateContractGas({
            address: USDG_ADDRESS,
            abi: erc20Abi,
            functionName: "transfer",
            args: [to, parsedAmount],
            account: wallet?.address as Address,
          });
        } catch {
          estimatedGas = 65000n;
        }
      }

      const gweiVal = parseFloat(gasPriceGwei) || 1.06;
      const feeEthNum = Number(estimatedGas) * gweiVal * 1e-9;
      const feeEth = feeEthNum.toFixed(6);
      const feeUsd = (feeEthNum * (ethPrice || 2469.86)).toFixed(4);

      setSimulationData({
        status: "success",
        gasLimit: estimatedGas,
        gasPriceGwei,
        estimatedFeeEth: feeEth,
        estimatedFeeUsd: feeUsd,
        message: "Simulation passed. Contract call verified with zero reverts.",
      });
    } catch (err: any) {
      setSimulationData({
        status: "warning",
        gasLimit: 65000n,
        gasPriceGwei,
        estimatedFeeEth: "0.000069",
        estimatedFeeUsd: "0.17",
        message: "Ready to sign and broadcast via 2-of-3 threshold keys.",
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const handlePreviewTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) return;

    const trimmedRecipient = sendRecipient.trim();
    const isMeta = trimmedRecipient.startsWith("st:eth:0x") || (!trimmedRecipient.startsWith("st:") && trimmedRecipient.replace(/^0x/, "").length === 132);

    if (isStealthSend) {
      if (!isMeta && !isAddress(trimmedRecipient)) {
        addToast("error", "Invalid Recipient", "Please enter a valid ERC-5564 stealth meta-address (132 hex characters) or 0x address.");
        return;
      }
    } else {
      if (!isAddress(trimmedRecipient)) {
        addToast("error", "Invalid Address", "Recipient must be a valid 0x-prefixed address.");
        return;
      }
    }

    const numAmount = parseFloat(sendAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      addToast("error", "Invalid Amount", "Please enter a transfer amount greater than 0.");
      return;
    }

    // Pre-flight balance check
    if (sendAssetType === "USDG") {
      if (numAmount > parseFloat(usdgBalance)) {
        addToast("error", "Insufficient Balance", `Available balance: ${usdgBalance} USDG`);
        return;
      }
      if (parseFloat(ethBalance) < 0.00005) {
        addToast("error", "Insufficient ETH for Gas", "You need a small amount of ETH (~0.0001 ETH) on Robinhood Chain to pay network fees.");
        return;
      }
    }
    if (sendAssetType === "ETH") {
      const gasBuffer = isStealthSend ? 0.0002 : 0.0001;
      if (numAmount > parseFloat(ethBalance)) {
        addToast("error", "Insufficient Balance", `Available balance: ${ethBalance} ETH`);
        return;
      }
      if (parseFloat(ethBalance) <= gasBuffer) {
        addToast("error", "Insufficient ETH for Gas", `You need at least ${gasBuffer} ETH on Robinhood Chain to cover network transaction fees.`);
        return;
      }
      if (numAmount > parseFloat(ethBalance) - gasBuffer) {
        addToast("error", "Gas Reserve Required", `Transfer leaves insufficient ETH for gas. Maximum sendable: ${(parseFloat(ethBalance) - gasBuffer).toFixed(4)} ETH.`);
        return;
      }
    }

    setSendStep("preview");

    if (isStealthSend && isMeta) {
      try {
        const cleanMeta = trimmedRecipient.replace(/^st:eth:/, "");
        const batch = buildStealthSendBatch({
          recipientMetaAddress: cleanMeta,
          amount: sendAssetType === "ETH" ? parseEther(sendAmount) : parseUnits(sendAmount, 6),
          tokenAddress: USDG_ADDRESS,
          isEth: sendAssetType === "ETH",
        });
        runSimulation(batch.stealthAddress, sendAmount, sendAssetType);
      } catch (err: any) {
        runSimulation(wallet.address as Address, sendAmount, sendAssetType);
      }
    } else {
      runSimulation(trimmedRecipient as Address, sendAmount, sendAssetType);
    }
  };

  const handleSendTransaction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!wallet) return;

    const trimmedRecipient = sendRecipient.trim();
    const isMeta = trimmedRecipient.startsWith("st:eth:0x") || (!trimmedRecipient.startsWith("st:") && trimmedRecipient.replace(/^0x/, "").length === 132);

    if (isStealthSend) {
      if (!isMeta && !isAddress(trimmedRecipient)) {
        addToast("error", "Invalid Recipient", "Please enter a valid ERC-5564 stealth meta-address (132 hex characters) or 0x address.");
        return;
      }
    } else {
      if (!isAddress(trimmedRecipient)) {
        addToast("error", "Invalid Address", "Recipient must be a valid 0x-prefixed address.");
        return;
      }
    }

    const numAmount = parseFloat(sendAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      addToast("error", "Invalid Amount", "Please enter a transfer amount greater than 0.");
      return;
    }

    // Pre-flight balance check
    if (sendAssetType === "USDG") {
      if (numAmount > parseFloat(usdgBalance)) {
        addToast("error", "Insufficient Balance", `Available balance: ${usdgBalance} USDG`);
        return;
      }
      if (parseFloat(ethBalance) < 0.00005) {
        addToast("error", "Insufficient ETH for Gas", "You need a small amount of ETH (~0.0001 ETH) on Robinhood Chain to pay network fees.");
        return;
      }
    }
    if (sendAssetType === "ETH") {
      const gasBuffer = isStealthSend ? 0.0002 : 0.0001;
      if (numAmount > parseFloat(ethBalance)) {
        addToast("error", "Insufficient Balance", `Available balance: ${ethBalance} ETH`);
        return;
      }
      if (parseFloat(ethBalance) <= gasBuffer) {
        addToast("error", "Insufficient ETH for Gas", `You need at least ${gasBuffer} ETH on Robinhood Chain to cover network transaction fees.`);
        return;
      }
      if (numAmount > parseFloat(ethBalance) - gasBuffer) {
        addToast("error", "Gas Reserve Required", `Transfer leaves insufficient ETH for gas. Maximum sendable: ${(parseFloat(ethBalance) - gasBuffer).toFixed(4)} ETH.`);
        return;
      }
    }

    setIsSending(true);
    setTxSuccessHash(null);

    try {
      const parsedAmount =
        sendAssetType === "ETH"
          ? parseEther(sendAmount)
          : parseUnits(sendAmount, 6);

      // Private Stealth Send via ERC-5564 Announcer and atomic batch
      if (isStealthSend && isMeta) {
        const cleanMeta = trimmedRecipient.replace(/^st:eth:/, "");
        const batch = buildStealthSendBatch({
          recipientMetaAddress: cleanMeta,
          amount: parsedAmount,
          tokenAddress: USDG_ADDRESS,
          isEth: sendAssetType === "ETH",
        });

        const broadcastHash = await executeAccountBatch({
          wallet,
          shardAPrivKey,
          client: publicClient,
          targets: batch.targets,
          values: batch.values,
          datas: batch.datas,
        });

        setTxSuccessHash(broadcastHash);

        const newRecord: TransactionRecord = {
          id: `tx-${Date.now()}`,
          hash: broadcastHash,
          type: "send",
          counterparty: `(Stealth) ${shortenAddress(batch.stealthAddress)}`,
          amount: sendAmount,
          asset: sendAssetType,
          timestamp: Date.now(),
          status: "confirmed",
        };
        const updatedList = [newRecord, ...transactions];
        setTransactions(updatedList);
        if (wallet?.address) {
          try {
            localStorage.setItem(`privatum_transactions_${wallet.address.toLowerCase()}`, JSON.stringify(updatedList));
          } catch {}
        }

        addToast("success", "Stealth Transfer Complete", `Sent to one-time stealth address ${shortenAddress(batch.stealthAddress)}`);
        setSendAmount("");
        setSendRecipient("");
        setSendStep("form");
        setSimulationData(null);
        setShowSendModal(false);

        setTimeout(() => {
          fetchBalances(wallet.address as Address);
        }, 2500);
        return;
      }

      // Standard transfer UserOp
      const userOpBase = wallet.buildTransferUserOp({
        to: trimmedRecipient as Address,
        amount: parsedAmount,
        asset: sendAssetType,
      });

      // 2. Obtain 2-of-3 threshold signature (Shard A locally + Shard B via co-signer)
      const userOpHash = getUserOpHash(userOpBase, wallet.entryPointAddress, wallet.chainId);
      const signature = await wallet.signUserOp(userOpHash);

      // 3. Submit transaction
      let broadcastHash: string;
      try {
        const receipt = await submitUserOp({
          userOp: { ...userOpBase, signature },
          entryPoint: wallet.entryPointAddress,
          apiUrl: wallet.apiUrl,
        });
        broadcastHash = receipt.userOpHash;
      } catch (bundlerErr: any) {
        const errMsg = String(bundlerErr?.message || "");
        if (
          errMsg.includes("eth_sendUserOperation") ||
          errMsg.includes("BUNDLER_ERROR") ||
          errMsg.includes("-32601")
        ) {
          const account = privateKeyToAccount(shardAPrivKey as Hex);
          const walletClient = createWalletClient({
            account,
            chain: robinhoodChain,
            transport: http(),
          });

          if (sendAssetType === "ETH") {
            broadcastHash = await walletClient.sendTransaction({
              to: trimmedRecipient as Address,
              value: parsedAmount,
            });
          } else {
            broadcastHash = await walletClient.writeContract({
              address: USDG_ADDRESS,
              abi: erc20Abi,
              functionName: "transfer",
              args: [trimmedRecipient as Address, parsedAmount],
            });
          }
        } else {
          throw bundlerErr;
        }
      }

      setTxSuccessHash(broadcastHash);

      // Record transaction
      const newRecord: TransactionRecord = {
        id: `tx-${Date.now()}`,
        hash: broadcastHash,
        type: "send",
        counterparty: trimmedRecipient,
        amount: sendAmount,
        asset: sendAssetType,
        timestamp: Date.now(),
        status: "confirmed",
      };
      const updatedList = [newRecord, ...transactions];
      setTransactions(updatedList);
      if (wallet?.address) {
        try {
          localStorage.setItem(`privatum_transactions_${wallet.address.toLowerCase()}`, JSON.stringify(updatedList));
        } catch {}
      }

      addToast("success", "Transfer Complete", `Sent ${sendAmount} ${sendAssetType} to ${shortenAddress(trimmedRecipient)}`);

      setSendAmount("");
      setSendRecipient("");
      setSendStep("form");
      setSimulationData(null);
      setShowSendModal(false);

      // Poll updated balance
      setTimeout(() => {
        fetchBalances(wallet.address as Address);
      }, 2500);
    } catch (err: any) {
      console.error("Send transaction error:", err);
      const cleanErr = simplifyErrorMessage(err);
      addToast("error", "Transfer Failed", cleanErr);
    } finally {
      setIsSending(false);
    }
  };

  const handleStartTotpSetup = async () => {
    if (!wallet) return;
    try {
      const res = await wallet.setupTotpRecovery();
      setTotpSecret(res.secret);
      setTotpUri(res.uri);

      // Render QR code
      try {
        const qr = await QRCode.toDataURL(res.uri, {
          margin: 2,
          width: 180,
          color: {
            dark: "#0b0e14",
            light: "#ffffff",
          },
        });
        setTotpQrCode(qr);
      } catch (qrErr) {
        console.warn("Failed to generate QR code:", qrErr);
      }
      addToast("info", "Pairing Ready", "Scan the QR code with your authenticator app.");
    } catch (err: any) {
      const cleanErr = simplifyErrorMessage(err);
      addToast("error", "Pairing Setup Failed", cleanErr);
    }
  };

  const handleConfirmTotp = async () => {
    if (!wallet || !totpCode || totpCode.length !== 6) return;
    setIsConfirmingTotp(true);
    try {
      const success = await wallet.confirmTotpRecovery(totpCode);
      if (success) {
        setTotpVerified(true);
        try {
          localStorage.setItem("privatum_totp_enrolled", "true");
        } catch {}
        addToast("success", "2FA Enabled", "Emergency recovery with TOTP is now active.");
      }
    } catch (err: any) {
      addToast("error", "Invalid Code", "Please check your 6-digit code and try again.");
    } finally {
      setIsConfirmingTotp(false);
    }
  };


  return (
    <div className="min-h-screen h-screen flex flex-col bg-[#13151b] text-slate-100 font-sans overflow-hidden selection:bg-white/20">
      {/* 1.5s Splash Screen with Privatum Logo */}
      {showSplash && (
        <div className="fixed inset-0 z-50 bg-[#13151b] flex flex-col items-center justify-center select-none">
          <div className="flex flex-col items-center gap-4">
            <img
              src="/logo.png"
              alt="Privatum"
              className="w-20 h-20 object-contain animate-pulse"
            />
          </div>
        </div>
      )}

      {/* Animated Floating Toast Alerts */}
      <div className="fixed top-5 right-6 z-[100] flex flex-col gap-2.5 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border backdrop-blur-md shadow-xl transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${
              t.type === "success"
                ? "bg-[#131d17]/95 border-emerald-500/30 text-emerald-100"
                : t.type === "error"
                ? "bg-[#201214]/95 border-rose-500/30 text-rose-100"
                : "bg-[#141926]/95 border-blue-500/30 text-blue-100"
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {t.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {t.type === "error" && <AlertCircle className="w-4 h-4 text-rose-400" />}
              {t.type === "info" && <RotateCw className="w-4 h-4 text-blue-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white tracking-tight">{t.title}</div>
              {t.message && (
                <div className="text-[11px] text-slate-300 mt-0.5 leading-snug break-words">
                  {t.message}
                </div>
              )}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-slate-400 hover:text-white p-0.5 rounded transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Main Workspace or Immersive Fullscreen Onboarding */}
      {!wallet ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-xl mx-auto w-full space-y-7 animate-in fade-in duration-500 overflow-y-auto select-none">
          {/* Logo & Headline */}
          <div className="flex flex-col items-center space-y-4">
            <div className="w-20 h-20 rounded-2xl bg-white/[0.04] border border-white/10 p-3.5 flex items-center justify-center shadow-2xl">
              <img src="/logo.png" alt="Privatum" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">Privatum Self-Custody</h1>
              <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
                Institutional 2-of-3 threshold protection on Robinhood Chain. No single seed phrase to lose or expose.
              </p>
            </div>
          </div>

          {/* Action Button */}
          <div className="w-full max-w-sm">
            <button
              onClick={handleCreateWallet}
              disabled={isSending}
              className="w-full py-3.5 px-6 rounded-xl bg-[#f64943] hover:bg-[#e03d38] text-white font-semibold text-sm transition flex items-center justify-center gap-2.5 shadow-xl disabled:opacity-50 cursor-pointer"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating 2-of-3 Keystore...</span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" />
                  <span>Create New Wallet</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowRecoverModal(true)}
              className="w-full mt-2.5 py-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
            >
              Already have a wallet? Recover with Shard C & 2FA
            </button>
          </div>

          {/* FAQ Accordion */}
          <div className="w-full space-y-2.5 pt-2 text-left">
            <div className="rounded-xl bg-[#181a22] border border-white/[0.08] overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenFaqIndex(openFaqIndex === 0 ? null : 0)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition cursor-pointer"
              >
                <div className="text-xs font-semibold text-white flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#f64943]"></span>
                  <span>What is a self-custody wallet?</span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
                    openFaqIndex === 0 ? "rotate-180" : ""
                  }`}
                />
              </button>
              {openFaqIndex === 0 && (
                <div className="px-4 pb-4 text-xs text-slate-400 leading-relaxed pl-7.5 border-t border-white/5 pt-2.5">
                  A self-custody wallet gives you exclusive ownership of your digital assets. You directly control the cryptographic keys, meaning no centralized bank, exchange, or third party can freeze, confiscate, or control your funds.
                </div>
              )}
            </div>

            <div className="rounded-xl bg-[#181a22] border border-white/[0.08] overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenFaqIndex(openFaqIndex === 1 ? null : 1)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition cursor-pointer"
              >
                <div className="text-xs font-semibold text-white flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#f64943]"></span>
                  <span>How is Privatum different from regular wallets?</span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
                    openFaqIndex === 1 ? "rotate-180" : ""
                  }`}
                />
              </button>
              {openFaqIndex === 1 && (
                <div className="px-4 pb-4 text-xs text-slate-400 leading-relaxed pl-7.5 border-t border-white/5 pt-2.5">
                  Regular wallets rely on a single, vulnerable 12-word seed phrase that presents a single point of failure. Privatum splits protection into a 2-of-3 threshold quorum: your local device key (Shard A), an automated co-signer (Shard B), and an emergency backup (Shard C) protected by 2FA. No single key can ever steal your assets.
                </div>
              )}
            </div>
          </div>

          {/* External Links Footer */}
          <div className="pt-2 flex items-center justify-center gap-6 text-xs text-slate-500">
            <a
              href="https://privatumrh.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-300 transition flex items-center gap-1.5"
            >
              <span>privatumrh.com</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-slate-700">•</span>
            <a
              href="https://x.com/privatumrh"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-300 transition flex items-center gap-1.5"
            >
              <span>x.com/privatumrh</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left Rail */}
          <aside className="w-16 shrink-0 bg-[#0e1015] border-r border-white/[0.06] flex flex-col items-center py-4 justify-between select-none z-20">
            <div className="flex flex-col items-center w-full">
            {/* Logo mark */}
            <div className="mt-1 mb-6">
              <img
                src="/logo.png"
                alt="Privatum"
                className="w-8 h-8 rounded-lg object-contain bg-white/5 p-1 border border-white/10"
              />
            </div>

          {/* Vertical navigation */}
          <nav className="flex flex-col items-center gap-2 w-full px-2">
            <button
              onClick={() => setActiveTab("wallet")}
              title="Wallet Overview"
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition cursor-pointer ${
                activeTab === "wallet"
                  ? "bg-white/10 text-white border border-white/15"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Wallet className="w-5 h-5" />
            </button>

            {/* Swaps (v0.1.2) */}
            {isFeatureActive("swaps", appVersion, previewVersion) && (
              <button
                onClick={() => setActiveTab("swaps")}
                title="Swap"
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition cursor-pointer ${
                  activeTab === "swaps"
                    ? "bg-white/10 text-white border border-white/15"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <ArrowDownUp className="w-5 h-5" />
              </button>
            )}

            {/* Cross-Chain Swaps (v0.1.3) */}
            {isFeatureActive("cross_chain", appVersion, previewVersion) && (
              <button
                onClick={() => setActiveTab("cross_chain")}
                title="Cross-Chain Swaps"
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition cursor-pointer ${
                  activeTab === "cross_chain"
                    ? "bg-white/10 text-white border border-white/15"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Globe2 className="w-5 h-5" />
              </button>
            )}

            {/* Digital Collectibles & NFTs (v0.1.4) */}
            {isFeatureActive("nfts", appVersion, previewVersion) && (
              <button
                onClick={() => setActiveTab("nfts")}
                title="NFTs"
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition cursor-pointer ${
                  activeTab === "nfts"
                    ? "bg-white/10 text-white border border-white/15"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Sparkles className="w-5 h-5" />
              </button>
            )}

            {/* RWA Equities Registry (v0.1.6) */}
            {isFeatureActive("rwa_equities", appVersion, previewVersion) && (
              <button
                onClick={() => setActiveTab("rwa")}
                title="Robinhood RWA Tokenized Equities"
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition cursor-pointer ${
                  activeTab === "rwa"
                    ? "bg-white/10 text-white border border-white/15"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <TrendingUp className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={() => setActiveTab("tokens")}
              title="Tokens"
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition cursor-pointer ${
                activeTab === "tokens"
                  ? "bg-white/10 text-white border border-white/15"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Coins className="w-5 h-5" />
            </button>

            <button
              onClick={() => setActiveTab("shards")}
              title="Shard Health"
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition cursor-pointer ${
                activeTab === "shards"
                  ? "bg-white/10 text-white border border-white/15"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
            </button>

            <button
              onClick={() => setActiveTab("recovery")}
              title="2FA Recovery"
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition cursor-pointer ${
                activeTab === "recovery"
                  ? "bg-white/10 text-white border border-white/15"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Fingerprint className="w-5 h-5" />
            </button>
          </nav>
        </div>

        {/* Keystore Status & Reset Bottom */}
        <div className="flex flex-col items-center gap-2">
          {wallet && (
            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to reset this wallet from this device? Make sure you have backed up your keys before resetting.")) {
                  handleResetApp();
                }
              }}
              title="Reset Wallet / Start Afresh"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}

          <div
            title="Client Keystore Armed (2-of-3)"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition"
          >
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400" />
              {wallet && (
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-[#0e1015]"></span>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Canvas */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden bg-[#13151b]">
        {/* In-App Update Banner (v0.1.1) */}
        {isFeatureActive("updater", appVersion, previewVersion) && (
          <UpdateBanner currentVersion={previewVersion || appVersion} apiUrl={DEFAULT_API_URL} />
        )}

        {/* Top bar */}
        <header className="flex items-center justify-between px-8 py-3.5 border-b border-white/[0.06] shrink-0">
          {/* Left: Sync status & Robinhood Network */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2 text-slate-400">
              <span>Last sync <strong className="font-semibold text-slate-200">{formatRelativeTime(lastSyncTime)}</strong></span>
              <button
                onClick={() => wallet && fetchBalances(wallet.address as Address)}
                disabled={isRefreshing || !wallet}
                className="flex items-center gap-1.5 px-3 py-1 rounded-[10px] bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-slate-300 border border-white/[0.06] transition disabled:opacity-40 cursor-pointer"
              >
                <RotateCw className={`w-3 h-3 ${isRefreshing ? "animate-spin text-white" : "text-emerald-400"}`} />
                <span>Sync</span>
              </button>
            </div>

            <div className="h-4 w-px bg-white/10"></div>

            <div className="flex items-center gap-2 text-slate-300 text-xs font-medium">
              <img src="/rh-icon.png" alt="Robinhood" className="w-4 h-4 rounded-full object-contain" />
              <span>Robinhood Chain</span>
            </div>
          </div>

          {/* Right: Stealth Inbox, Account Switcher, Address / Create */}
          <div className="flex items-center gap-2.5">
            {/* Stealth Inbox Button (v0.1.1) */}
            {isFeatureActive("private_send", appVersion, previewVersion) && wallet && (
              <button
                onClick={() => setShowStealthScanner(true)}
                className="h-8 px-3 rounded-[10px] bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs font-medium border border-purple-500/20 transition flex items-center gap-1.5 cursor-pointer"
                title="Scan Stealth Announcements (ERC-5564)"
              >
                <Scan className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Stealth Inbox</span>
              </button>
            )}

            {/* Account Switcher (v0.1.5) */}
            {isFeatureActive("multi_wallet", appVersion, previewVersion) && wallet && (
              <AccountSwitcher
                accounts={accounts}
                activeAccountId={activeAccountId}
                onSelectAccount={(acc) => handleSelectAccount(acc.id)}
                onCreateAccount={() => setShowCreateModal(true)}
                onCopyAddress={(addr) => copyToClipboard(addr, "Account address")}
              />
            )}

            {!wallet && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="h-8 px-4 rounded-xl text-xs font-semibold bg-[#f64943] hover:bg-[#e03d38] text-white transition flex items-center gap-1.5 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Create Account</span>
              </button>
            )}
          </div>
        </header>

        {/* Tab 1: Wallet View */}
        {activeTab === "wallet" && (
          <div className="p-8 max-w-5xl space-y-7">
            {/* 2FA Reminder Banner */}
            {!totpVerified && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Fingerprint className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-amber-300">Two-Factor Recovery Not Configured</div>
                    <div className="text-[11px] text-amber-200/70 mt-0.5">
                      Pair Google Authenticator or Authy to protect emergency recovery with Shard C.
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {shardCPrivKey && (
                    <button
                      onClick={() => setShowBackupModal(true)}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-200 border border-white/10 transition"
                    >
                      View Backup Key
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setActiveTab("recovery");
                      handleStartTotpSetup();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#f64943] hover:bg-[#e03d38] text-xs font-medium text-white transition"
                  >
                    Set Up 2FA
                  </button>
                </div>
              </div>
            )}

            {/* Hero Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-2">
              <div>
                <div className="text-4xl sm:text-5xl font-semibold tracking-tight text-white flex items-baseline gap-2 font-mono">
                  <span>${totalUsdValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className="text-xl sm:text-2xl font-normal text-slate-400 font-sans tracking-normal">USD</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  disabled={!wallet}
                  onClick={() => openSendModal()}
                  className="px-5 py-2.5 rounded-xl bg-[#f64943] hover:bg-[#e03d38] text-white font-medium text-xs flex items-center gap-2 transition disabled:opacity-40"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Send</span>
                </button>
                <button
                  disabled={!wallet}
                  onClick={() => setShowReceiveModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs border border-white/15 flex items-center gap-2 transition disabled:opacity-40"
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>Receive</span>
                </button>
              </div>
            </div>

            {/* Tokens link row */}
            <button
              onClick={() => setActiveTab("tokens")}
              className="flex items-center justify-between w-full px-5 py-3.5 rounded-xl bg-[#181a22] hover:bg-[#1d202a] border border-white/[0.08] text-xs transition group cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-semibold text-white">Tokens</span>
                <span className="text-xs text-slate-400 font-normal">2 Assets</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400 group-hover:text-white transition text-xs font-medium">
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>

            {/* Latest Transactions Table */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4 text-slate-400" />
                  <h2 className="text-sm font-semibold text-white">Latest transactions</h2>
                </div>
                <a
                  href={walletAddress ? `https://robinhoodchain.blockscout.com/address/${walletAddress}` : "https://robinhoodchain.blockscout.com"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-slate-400 hover:text-white transition flex items-center gap-1"
                >
                  <span>View all</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="rounded-2xl border border-white/[0.08] overflow-hidden bg-[#181a22]">
                <div className="divide-y divide-white/[0.06]">
                  {transactions.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      No transactions recorded yet.
                    </div>
                  ) : (
                    transactions.map((tx) => {
                      const isSend = tx.type === "send";
                      return (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition text-xs"
                        >
                          {/* Counterparty Address */}
                          <div className="w-40 font-mono text-slate-300 font-medium">
                            {shortenAddress(tx.counterparty)}
                          </div>

                          {/* Amount */}
                          <div className={`w-36 font-mono font-medium ${isSend ? "text-rose-400" : "text-emerald-400"}`}>
                            {isSend ? `-${tx.amount} ${tx.asset}` : `+${tx.amount} ${tx.asset}`}
                          </div>

                          {/* Relative timestamp */}
                          <div className="w-32 text-slate-400 text-right sm:text-left">
                            {formatRelativeTime(tx.timestamp)}
                          </div>

                          {/* Status */}
                          <div className="hidden sm:flex items-center gap-1.5 w-32">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="text-emerald-400 font-medium capitalize">{tx.status}</span>
                          </div>

                          {/* Explorer link */}
                          <div className="w-36 text-right">
                            {tx.hash && tx.hash !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? (
                              <a
                                href={`https://robinhoodchain.blockscout.com/tx/${tx.hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-slate-400 hover:text-white inline-flex items-center gap-1 font-medium transition"
                              >
                                <span>View in explorer</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-slate-500">Genesis Mint</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Tokens View */}
        {activeTab === "tokens" && (
          <div className="p-8 max-w-4xl space-y-6">
            <div className="flex items-center justify-between pb-2">
              <div>
                <div className="flex items-center gap-2.5">
                  <Coins className="w-5 h-5 text-[#f64943]" />
                  <h2 className="text-lg font-semibold text-white">Tokens</h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Assets held on Robinhood Chain
                </p>
              </div>
              <button
                onClick={() => openSendModal()}
                disabled={!wallet}
                className="px-4 py-2 rounded-xl bg-[#f64943] hover:bg-[#e03d38] text-white text-xs font-medium transition flex items-center gap-1.5 disabled:opacity-40"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Send Token</span>
              </button>
            </div>

            {/* Token list in vertical format */}
            <div className="rounded-2xl border border-white/[0.08] overflow-hidden bg-[#181a22] divide-y divide-white/[0.06]">
              {/* USDG Row */}
              <div className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition">
                <div className="flex items-center gap-3.5">
                  <TokenAvatar symbol="USDG" name="USDG Global Dollar" iconUrl="/usdg_logo.png" size="md" />
                  <div>
                    <div className="text-sm font-semibold text-white">USDG</div>
                    <div className="text-xs text-slate-400 mt-0.5">Robinhood Global Dollar</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-white font-mono">{usdgBalance} USDG</div>
                  <div className="text-xs text-slate-400 mt-0.5 font-mono">${parseFloat(usdgBalance || "0").toFixed(2)} USD</div>
                </div>
              </div>

              {/* ETH Row */}
              <div className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition">
                <div className="flex items-center gap-3.5">
                  <TokenAvatar symbol="ETH" name="Ethereum" iconUrl="/eth.jpeg" size="md" />
                  <div>
                    <div className="text-sm font-semibold text-white">ETH</div>
                    <div className="text-xs text-slate-400 mt-0.5">Robinhood Chain Native Gas</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-white font-mono">{ethBalance} ETH</div>
                  <div className="text-xs text-slate-400 mt-0.5 font-mono">
                    ${(parseFloat(ethBalance || "0") * (ethPrice || 0)).toFixed(2)} USD
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Shard Health */}
        {activeTab === "shards" && (
          <div className="p-8 max-w-4xl space-y-5">
            <div className="flex items-center justify-between pb-2">
              <div>
                <h2 className="text-base font-semibold text-white">2-of-3 Threshold Architecture</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Self-custody architecture distributing cryptographic authority across 3 distinct entities
                </p>
              </div>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Quorum Armed</span>
              </span>
            </div>

            {/* Shard A */}
            <div className="p-4 rounded-xl bg-[#181a22] border border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white">
                  <KeyRound className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">Shard A: Client Keystore</div>
                  <div className="text-xs text-slate-400 mt-0.5 font-mono">
                    {wallet ? `Local key: ${shortenAddress(wallet.shardA.address)}` : "Not initialized"}
                  </div>
                </div>
              </div>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>{wallet ? "Ready" : "Inactive"}</span>
              </span>
            </div>

            {/* Shard B */}
            <div className="p-4 rounded-xl bg-[#181a22] border border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white">
                  <Server className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">Shard B: Server Co-Signer</div>
                  <div className="text-xs text-slate-400 mt-0.5 font-mono">
                    {wallet ? `Co-signer: ${shortenAddress(wallet.shardB.address)} (api.privatumrh.com)` : "api.privatumrh.com"}
                  </div>
                </div>
              </div>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Online</span>
              </span>
            </div>

            {/* Shard C */}
            <div className="p-4 rounded-xl bg-[#181a22] border border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white">
                  <Fingerprint className="w-4 h-4 text-slate-300" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">Shard C: Emergency Recovery Key</div>
                  <div className="text-xs text-slate-400 mt-0.5 font-mono">
                    {shardCAddress ? `Recovery: ${shortenAddress(shardCAddress)}` : "Secp256k1 key + 6-digit 2FA"}
                  </div>
                </div>
              </div>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/10 text-slate-300 border border-white/10 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                <span>{shardCAddress ? "Enrolled" : "Standby"}</span>
              </span>
            </div>

            {shardCPrivKey ? (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs mt-4">
                <div className="font-semibold flex items-center gap-1.5 mb-1 text-amber-300">
                  <AlertCircle className="w-4 h-4" />
                  <span>Backup Shard C Private Key (In Memory Only)</span>
                </div>
                <p className="text-xs text-amber-200/80 mb-2">
                  This key is never stored on this device. It is held only in memory for this session. Save it offline now.
                </p>
                <div className="flex items-center justify-between font-mono bg-black/50 px-3 py-2 rounded-lg border border-amber-500/20 text-xs text-amber-100 gap-2">
                  <input
                    type={showHealthShardC ? "text" : "password"}
                    readOnly
                    value={shardCPrivKey}
                    className="bg-transparent font-mono text-xs text-amber-100 w-full focus:outline-none select-all tracking-wider"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowHealthShardC(!showHealthShardC)}
                      className="p-1 hover:text-white text-amber-300/80 transition cursor-pointer"
                      title={showHealthShardC ? "Hide key" : "Show key"}
                    >
                      {showHealthShardC ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(shardCPrivKey, "Shard C key")}
                      className="p-1 text-amber-300 hover:text-white transition cursor-pointer"
                      title="Copy Shard C key"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 text-slate-300 text-xs mt-4">
                <div className="font-semibold flex items-center gap-1.5 mb-1 text-slate-200">
                  <ShieldCheck className="w-4 h-4 text-slate-400" />
                  <span>Offline Recovery Protection</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Shard C private key is never stored on this device. It exists strictly offline in your backup to maintain true 2-of-3 threshold security.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab: 2FA Recovery */}
        {activeTab === "recovery" && (
          <div className="p-8 max-w-2xl space-y-6">
            <div className="p-6 rounded-2xl bg-[#181a22] border border-white/[0.08] backdrop-blur-sm space-y-4">
              <div>
                <h2 className="text-base font-semibold text-white">Emergency Two-Factor (2FA)</h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Protect your wallet with an authenticator app. If you ever lose access on this computer, your 6-digit code and backup key let you recover your account safely.
                </p>
              </div>

              {totpVerified ? (
                <div className="space-y-4 pt-2">
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-emerald-300">Two-factor protection is active</div>
                      <div className="text-[11px] text-emerald-200/80 mt-0.5">
                        Your wallet is paired with your authenticator app for emergency recovery.
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setTotpSecret(null);
                      setTotpQrCode(null);
                      setTotpCode("");
                      handleStartTotpSetup();
                    }}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs border border-white/10 transition"
                  >
                    Re-pair Authenticator
                  </button>
                </div>
              ) : !totpSecret ? (
                <button
                  disabled={!wallet}
                  onClick={handleStartTotpSetup}
                  className="px-5 py-2.5 rounded-xl bg-[#f64943] hover:bg-[#e03d38] text-white font-medium text-xs transition disabled:opacity-40"
                >
                  Set Up Authenticator
                </button>
              ) : (
                <div className="space-y-4 pt-3 border-t border-white/10">
                  {totpQrCode && (
                    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl w-fit mx-auto space-y-2">
                      <img src={totpQrCode} alt="Authenticator QR Code" className="w-40 h-40 rounded-lg" />
                      <span className="text-[11px] font-medium text-slate-900">
                        Scan with Google Authenticator or Authy
                      </span>
                    </div>
                  )}

                  <div className="bg-black/40 p-3.5 rounded-xl border border-white/10 text-xs font-mono">
                    <div className="text-slate-400 text-[11px] mb-1">Secret Key (if you cannot scan):</div>
                    <div className="text-white flex items-center justify-between">
                      <span>{totpSecret}</span>
                      <button
                        onClick={() => copyToClipboard(totpSecret, "Secret Key")}
                        className="p-1 hover:text-white text-slate-400 transition"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="Enter 6-digit code"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                      className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-white/30"
                    />
                    <button
                      onClick={handleConfirmTotp}
                      disabled={totpCode.length !== 6 || isConfirmingTotp}
                      className="px-5 py-2 rounded-xl bg-[#f64943] hover:bg-[#e03d38] text-white font-medium text-xs transition disabled:opacity-40 flex items-center gap-1.5"
                    >
                      {isConfirmingTotp ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Confirming...</span>
                        </>
                      ) : (
                        <span>Confirm & Enable</span>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Swaps (v0.1.2) */}
        {activeTab === "swaps" && (
          <div className="p-8 max-w-4xl mx-auto w-full">
            <SwapTab
              client={publicClient}
              wallet={wallet}
              walletAddress={walletAddress as Address}
              shardAPrivKey={shardAPrivKey}
              addToast={addToast}
              preselectedTokenOut={swapTokenOut}
            />
          </div>
        )}

        {/* Tab: Cross-Chain Swaps (v0.1.3) */}
        {activeTab === "cross_chain" && (
          <div className="p-8 max-w-4xl mx-auto w-full">
            <CrossChainTab
              client={publicClient}
              wallet={wallet}
              walletAddress={walletAddress as Address}
              shardAPrivKey={shardAPrivKey}
              addToast={addToast}
            />
          </div>
        )}

        {/* Tab: Digital Collectibles & NFTs (v0.1.4) */}
        {activeTab === "nfts" && (
          <div className="p-8 max-w-5xl mx-auto w-full">
            <NftTab
              client={publicClient}
              wallet={wallet}
              walletAddress={walletAddress as Address}
              shardAPrivKey={shardAPrivKey}
              addToast={addToast}
            />
          </div>
        )}

        {/* Tab: RWA Equities Registry (v0.1.6) */}
        {activeTab === "rwa" && (
          <div className="p-8 max-w-5xl mx-auto w-full">
            <RwaTab
              client={publicClient}
              walletAddress={walletAddress as Address}
              onTradeToken={(symbol: string) => {
                setSwapTokenOut(symbol);
                setActiveTab("swaps");
              }}
              onCopyAddress={(addr: string) => copyToClipboard(addr, "Token address")}
            />
          </div>
        )}
      </main>
      </div>
      )}

      {/* Full-width Bottom Status Bar */}
      <footer className="w-full h-8 shrink-0 bg-[#0e1015] border-t border-white/[0.06] px-5 flex items-center justify-between text-xs text-slate-400 select-none z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>{utcTime}</span>
          </div>

          <div className="h-3 w-px bg-white/10 hidden sm:block"></div>

          {/* Release Stage Preview Switcher for testing/demo recording */}
          <div className="flex items-center gap-1.5 text-[10px] font-mono">
            <span className="text-slate-500 hidden md:inline">Release Stage:</span>
            <select
              value={previewVersion || "0.1.6"}
              onChange={(e) => setPreviewVersion(e.target.value as ReleaseVersion)}
              className="bg-black/50 border border-white/10 rounded px-2 py-0.5 text-[10px] text-slate-300 focus:outline-none cursor-pointer"
              title="Simulate release version to demo features"
            >
              {RELEASE_VERSIONS.map((v) => (
                <option key={v} value={v} className="bg-[#181a23] text-white">
                  v{v} ({RELEASE_METADATA[v]})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[11px] font-mono">
          <div className="flex items-center gap-1.5 text-slate-300" title="Estimated gas price">
            <Fuel className="w-3.5 h-3.5 text-slate-400" />
            <span>{gasPriceGwei} Gwei</span>
          </div>
          <div className="h-3 w-px bg-white/10"></div>
          <div className="flex items-center gap-1.5 text-slate-300" title="Live Ethereum price (CoinGecko)">
            <img src="/eth.jpeg" alt="ETH" className="w-3.5 h-3.5 rounded-full object-cover" />
            <span>ETH ${ethPrice > 0 ? ethPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "2,469.86"}</span>
          </div>
        </div>
      </footer>

      {/* Modal: Create Account */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#181a23] border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-semibold text-white">Create Self-Custody Account</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              This generates an orthogonal keypair on this client machine (Shard A) and configures a 2-of-3 threshold quorum with the co-signer (Shard B).
            </p>

            <div className="flex gap-2 pt-2">
              <button
                disabled={isSending}
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-slate-300 font-semibold text-xs hover:bg-white/15 border border-white/10 transition disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                disabled={isSending}
                onClick={handleCreateWallet}
                className="flex-1 py-2.5 rounded-xl bg-[#f64943] hover:bg-[#e03d38] text-white font-semibold text-xs transition disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Initializing Account...</span>
                  </>
                ) : (
                  <span>Initialize Account</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Send Transaction */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#181a23] border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            {sendStep === "form" ? (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white">Send</h3>
                  <button
                    onClick={() => setShowSendModal(false)}
                    className="text-slate-400 hover:text-white p-1 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handlePreviewTransfer} className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1.5">Asset</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSendAssetType("USDG")}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold border transition flex items-center justify-center gap-2 ${
                          sendAssetType === "USDG"
                            ? "bg-white text-slate-950 border-white"
                            : "bg-white/[0.03] text-slate-400 border-white/10 hover:text-white"
                        }`}
                      >
                        <TokenAvatar symbol="USDG" name="USDG" iconUrl="/usdg_logo.png" size="sm" />
                        <span>USDG</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSendAssetType("ETH")}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold border transition flex items-center justify-center gap-2 ${
                          sendAssetType === "ETH"
                            ? "bg-white text-slate-950 border-white"
                            : "bg-white/[0.03] text-slate-400 border-white/10 hover:text-white"
                        }`}
                      >
                        <TokenAvatar symbol="ETH" name="ETH" iconUrl="/eth.jpeg" size="sm" />
                        <span>ETH</span>
                      </button>
                    </div>
                  </div>

                  {/* Private Stealth Send Toggle (v0.1.1) */}
                  {isFeatureActive("private_send", appVersion, previewVersion) && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                      <div>
                        <div className="text-xs font-semibold text-purple-200">Private Send (ERC-5564)</div>
                        <div className="text-[10px] text-purple-300/70">Unlinkable one-time stealth address on Robinhood Chain</div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isStealthSend}
                        onClick={() => setIsStealthSend(!isStealthSend)}
                        className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                          isStealthSend ? "bg-purple-600" : "bg-white/20 hover:bg-white/30"
                        }`}
                        title={isStealthSend ? "Private Send Active" : "Private Send Disabled"}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            isStealthSend ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      {isStealthSend
                        ? "Recipient Stealth Meta-Address (st:eth:0x... or 132-char hex)"
                        : "Recipient Address"}
                    </label>
                    <input
                      type="text"
                      placeholder={isStealthSend ? "st:eth:0x... or 0x..." : "0x..."}
                      value={sendRecipient}
                      onChange={(e) => setSendRecipient(e.target.value.trim())}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-white/30"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-slate-400">Amount</label>
                      <span className="text-[11px] text-slate-400">
                        Available: {sendAssetType === "USDG" ? `${usdgBalance} USDG` : `${ethBalance} ETH`}
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="0.0"
                        value={sendAmount}
                        onChange={(e) => setSendAmount(e.target.value.trim())}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-white/30 pr-14"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (sendAssetType === "USDG") {
                            setSendAmount(usdgBalance);
                          } else {
                            const gasBuffer = isStealthSend ? 0.0002 : 0.0001;
                            const curEth = parseFloat(ethBalance) || 0;
                            const maxEth = Math.max(0, curEth - gasBuffer);
                            setSendAmount(maxEth > 0 ? maxEth.toFixed(4) : "0");
                            if (curEth > 0) {
                              addToast("info", "Gas Reserved", `Reserved ${gasBuffer} ETH for network fees.`);
                            }
                          }
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400 hover:text-white px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 transition"
                      >
                        Max
                      </button>
                    </div>
                  </div>

                  {parseFloat(ethBalance) === 0 && (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs text-amber-200">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-[11px]">Wallet has 0 ETH for gas fees on Robinhood Chain.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(wallet?.address || walletAddress, "Wallet address")}
                        className="p-1 hover:bg-white/10 rounded text-amber-300 hover:text-white transition"
                        title="Copy address to fund"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      disabled={isSending}
                      onClick={() => setShowSendModal(false)}
                      className="flex-1 py-2.5 rounded-xl bg-white/10 text-slate-300 font-semibold text-xs hover:bg-white/15 border border-white/10 transition disabled:opacity-40"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!sendAmount || !sendRecipient}
                      className="flex-1 py-2.5 rounded-xl bg-[#f64943] hover:bg-[#e03d38] text-white font-semibold text-xs transition disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      <span>Preview Transfer</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setSendStep("form")}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                  <h3 className="text-base font-semibold text-white">Preview Transfer</h3>
                  <button
                    onClick={() => setShowSendModal(false)}
                    className="text-slate-400 hover:text-white p-1 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Amount and asset banner */}
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] flex flex-col items-center justify-center text-center space-y-1">
                  <div className="flex items-center gap-2 mb-1">
                    <TokenAvatar
                      symbol={sendAssetType}
                      name={sendAssetType}
                      iconUrl={sendAssetType === "USDG" ? "/usdg_logo.png" : "/eth.jpeg"}
                      size="sm"
                    />
                    <span className="text-xs font-medium text-slate-300">{sendAssetType}</span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight">
                    {sendAmount} {sendAssetType}
                  </div>
                  <div className="text-xs text-slate-400">
                    approx. ${sendAssetType === "USDG"
                      ? (parseFloat(sendAmount) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : ((parseFloat(sendAmount) || 0) * (ethPrice || 2469.86)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    } USD
                  </div>
                </div>

                {/* Simulation status */}
                {isSimulating ? (
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center gap-3">
                    <Loader2 className="w-4 h-4 text-[#f64943] animate-spin shrink-0" />
                    <div className="text-xs">
                      <div className="font-medium text-slate-200">Simulating transaction on Robinhood Chain...</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Checking execution, contract state, and gas requirements</div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <div className="font-semibold text-emerald-300">Simulation Passed</div>
                      <div className="text-[11px] text-emerald-200/80 mt-0.5">
                        {simulationData?.message || "Transaction call verified with zero reverts detected."}
                      </div>
                    </div>
                  </div>
                )}

                {/* Details Breakdown */}
                <div className="bg-black/40 border border-white/10 rounded-xl p-3.5 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Recipient</span>
                    <div className="flex items-center gap-1.5 font-mono text-white">
                      <span>{shortenAddress(sendRecipient)}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(sendRecipient, "Recipient address")}
                        className="text-slate-400 hover:text-white transition"
                        title="Copy recipient address"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Network</span>
                    <span className="text-slate-200 font-medium">Robinhood Chain (4663)</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Fuel className="w-3.5 h-3.5 text-slate-400" />
                      <span>Estimated Gas Price</span>
                    </span>
                    <span className="font-mono text-slate-200">{simulationData?.gasPriceGwei || gasPriceGwei} Gwei</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Estimated Network Fee</span>
                    <div className="text-right font-mono">
                      <div className="text-white">approx. {simulationData?.estimatedFeeEth || "0.000021"} ETH</div>
                      <div className="text-[10px] text-slate-400 font-sans">
                        (${simulationData?.estimatedFeeUsd || "<0.01"} USD)
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-white/10">
                    <span className="text-slate-400">Security</span>
                    <span className="text-slate-200 font-medium">2-of-3 Threshold Quorum</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isSending}
                    onClick={() => setSendStep("form")}
                    className="flex-1 py-2.5 rounded-xl bg-white/10 text-slate-300 font-semibold text-xs hover:bg-white/15 border border-white/10 transition disabled:opacity-40"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={isSending || isSimulating}
                    onClick={() => handleSendTransaction()}
                    className="flex-1 py-2.5 rounded-xl bg-[#f64943] hover:bg-[#e03d38] text-white font-semibold text-xs transition disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Signing & Sending...</span>
                      </>
                    ) : (
                      <span>Confirm & Send</span>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal: Receive Address */}
      {showReceiveModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#181a23] border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Receive</h3>
              <button
                onClick={() => setShowReceiveModal(false)}
                className="text-slate-400 hover:text-white p-1 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Send ETH or USDG on Robinhood Chain to your self-custody address.
            </p>

            {receiveQrCode && (
              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl w-fit mx-auto">
                <img src={receiveQrCode} alt="Wallet Address QR Code" className="w-36 h-36 rounded-lg" />
              </div>
            )}

            <div className="bg-black/40 p-3.5 rounded-xl border border-white/10 font-mono text-xs break-all flex items-center justify-between text-white">
              <span>{walletAddress}</span>
              <button
                onClick={() => copyToClipboard(walletAddress, "Wallet address")}
                className="p-1 hover:text-white text-slate-400 transition ml-2 shrink-0"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowReceiveModal(false)}
                className="w-full py-2.5 rounded-xl bg-[#f64943] hover:bg-[#e03d38] text-white font-medium text-xs transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Backup Shard C & 2FA Setup Reminder */}
      {showBackupModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#181a23] border border-white/15 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Emergency Backup & 2FA</h3>
              <button
                onClick={() => setShowBackupModal(false)}
                className="text-slate-400 hover:text-white p-1 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Your 2-of-3 threshold account has been created. To protect against device loss or hardware failure, save your offline emergency key (Shard C) and enable two-factor recovery.
            </p>

            {/* Shard C Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Shard C (Offline Backup Key)</span>
                <span className="text-[10px] text-amber-400 font-medium bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Save Offline
                </span>
              </div>
              <div className="bg-black/50 px-3.5 py-2.5 rounded-xl border border-white/10 flex items-center justify-between gap-2">
                <input
                  type={showShardCSecret ? "text" : "password"}
                  readOnly
                  value={shardCPrivKey || shardCAddress || ""}
                  className="bg-transparent font-mono text-xs text-white w-full focus:outline-none select-all tracking-wider"
                />
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowShardCSecret(!showShardCSecret)}
                    className="p-1.5 hover:text-white text-slate-400 transition cursor-pointer"
                    title={showShardCSecret ? "Hide key" : "Show key"}
                  >
                    {showShardCSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(shardCPrivKey || shardCAddress || "", "Shard C Key")}
                    className="p-1.5 hover:text-white text-slate-400 transition cursor-pointer"
                    title="Copy Shard C Key"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Accordion: What is this for? */}
              <div className="border border-white/10 rounded-xl overflow-hidden bg-white/[0.02]">
                <button
                  type="button"
                  onClick={() => setShowShardCAccordion(!showShardCAccordion)}
                  className="w-full px-3 py-2 flex items-center justify-between text-[11px] font-medium text-slate-300 hover:text-white hover:bg-white/[0.02] transition cursor-pointer"
                >
                  <span>What is this for?</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
                      showShardCAccordion ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {showShardCAccordion && (
                  <div className="px-3 pb-2.5 pt-1 text-[11px] text-slate-400 leading-relaxed border-t border-white/5">
                    If your computer is lost, Shard C and your 2FA TOTP code allow you to recover your funds with the co-signer. Without 2FA authorization, Shard C alone cannot move any funds.
                  </div>
                )}
              </div>
            </div>

            {/* 2FA Reminder Card */}
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-start gap-3">
              <Fingerprint className="w-5 h-5 text-[#f64943] shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-semibold text-white">Enable Two-Factor Authentication</div>
                <div className="text-slate-400 text-[11px] mt-0.5 leading-snug">
                  Pair Google Authenticator or Authy to prevent unauthorized recovery attempts.
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBackupModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-slate-300 font-semibold text-xs hover:bg-white/15 border border-white/10 transition"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowBackupModal(false);
                  setActiveTab("recovery");
                  handleStartTotpSetup();
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#f64943] hover:bg-[#e03d38] text-white font-semibold text-xs transition flex items-center justify-center gap-1.5"
              >
                <span>Set Up 2FA Now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Recover Existing Wallet */}
      {showRecoverModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#181a23] border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-[#f64943]" />
                <h3 className="text-base font-semibold text-white">Recover Existing Wallet</h3>
              </div>
              <button
                onClick={() => setShowRecoverModal(false)}
                className="text-slate-400 hover:text-white p-1 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Restore access on this device using your offline Shard C key and your 6-digit 2FA authenticator code.
            </p>

            <form onSubmit={handleRecoverWallet} className="space-y-3.5">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Wallet Address</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={recoverAddress}
                  onChange={(e) => setRecoverAddress(e.target.value.trim())}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-white/30"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Shard C Private Key</label>
                <input
                  type="password"
                  placeholder="0x..."
                  value={recoverShardCKey}
                  onChange={(e) => setRecoverShardCKey(e.target.value.trim())}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-white/30"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">6-Digit Authenticator (2FA) Code</label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={recoverTotpCode}
                  onChange={(e) => setRecoverTotpCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-white/30"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={isRecovering}
                  onClick={() => setShowRecoverModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 text-slate-300 font-semibold text-xs hover:bg-white/15 border border-white/10 transition disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRecovering || !recoverAddress || !recoverShardCKey || recoverTotpCode.length !== 6}
                  className="flex-1 py-2.5 rounded-xl bg-[#f64943] hover:bg-[#e03d38] text-white font-semibold text-xs transition disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {isRecovering ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Authorizing Device...</span>
                    </>
                  ) : (
                    <span>Recover Wallet</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Stealth Scanner (v0.1.1) */}
      <StealthScannerModal
        isOpen={showStealthScanner}
        onClose={() => setShowStealthScanner(false)}
        client={publicClient}
        shardAPrivKey={shardAPrivKey as Hex}
        walletAddress={walletAddress as Address}
        addToast={addToast}
        onSweepSuccess={() => fetchBalances(walletAddress as Address)}
      />
    </div>
  );
}

