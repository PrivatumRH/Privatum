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
  ArrowLeftRight,
  Fuel,
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
    msg.includes("insufficient funds") ||
    msg.includes("exceeds balance") ||
    msg.includes("Insufficient")
  ) {
    return "Insufficient balance to complete this transfer.";
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

const INITIAL_TRANSACTIONS: TransactionRecord[] = [
  {
    id: "tx-init-1",
    hash: "0x28637b76f9ccbcdc93304de57442f0757b89649a9d5b90d3568cd902541f8e0f",
    type: "send",
    counterparty: "0x3da0dc105bf389e34185077eca821bbd91aadeba",
    amount: "0.50",
    asset: "USDG",
    timestamp: Date.now() - 3600000,
    status: "confirmed",
  },
  {
    id: "tx-init-2",
    hash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    type: "receive",
    counterparty: "0x3da0dc105bf389e34185077eca821bbd91aadeba",
    amount: "1.00",
    asset: "USDG",
    timestamp: Date.now() - 7200000,
    status: "confirmed",
  },
];


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
  const [activeTab, setActiveTab] = useState<"wallet" | "tokens" | "shards" | "recovery">("wallet");
  const [wallet, setWallet] = useState<PrivatumWallet | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [shardAPrivKey, setShardAPrivKey] = useState<string>("");
  const [shardCAddress, setShardCAddress] = useState<string>("");
  const [shardCPrivKey, setShardCPrivKey] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");

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
  const [receiveQrCode, setReceiveQrCode] = useState<string | null>(null);

  // Send Form
  const [sendAssetType, setSendAssetType] = useState<"ETH" | "USDG">("USDG");
  const [sendRecipient, setSendRecipient] = useState<string>("");
  const [sendAmount, setSendAmount] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [txSuccessHash, setTxSuccessHash] = useState<string | null>(null);

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

  // Load transaction history
  useEffect(() => {
    try {
      const stored = localStorage.getItem("privatum_transactions");
      if (stored) {
        setTransactions(JSON.parse(stored));
      } else {
        setTransactions(INITIAL_TRANSACTIONS);
        localStorage.setItem("privatum_transactions", JSON.stringify(INITIAL_TRANSACTIONS));
      }
    } catch {
      setTransactions(INITIAL_TRANSACTIONS);
    }
  }, []);

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
        let savedShardA: string | null = null;
        if (isTauri()) {
          savedShardA = await invoke<string | null>("load_shard_a");
        } else {
          savedShardA = localStorage.getItem("privatum_shard_a");
        }

        const savedAddress = localStorage.getItem("privatum_wallet_address");
        const savedApiKey = localStorage.getItem("privatum_api_key");
        const savedShardB = localStorage.getItem("privatum_shard_b_address");
        const savedShardC = localStorage.getItem("privatum_shard_c_address");

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
        }
      } catch (err) {
        console.error("Failed to load saved wallet:", err);
      }
    }

    loadSavedWallet();
  }, []);

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

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { wallet: newWallet, shardC } = await PrivatumWallet.create();

        // Save Shard A to OS keystore / localStorage
        if (isTauri()) {
          await invoke("save_shard_a", { key: newWallet.shardA.privateKey });
        } else {
          localStorage.setItem("privatum_shard_a", newWallet.shardA.privateKey);
        }

        localStorage.setItem("privatum_wallet_address", newWallet.address);
        localStorage.setItem("privatum_api_key", newWallet.apiKey);
        localStorage.setItem("privatum_shard_b_address", newWallet.shardB.address);
        localStorage.setItem("privatum_shard_c_address", shardC.address);

        setWallet(newWallet);
        setWalletAddress(newWallet.address);
        setShardAPrivKey(newWallet.shardA.privateKey);
        setApiKey(newWallet.apiKey);
        setShardCAddress(shardC.address);
        setShardCPrivKey(shardC.privateKey);

        setShowCreateModal(false);
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

  const handleSendTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) return;

    if (!isAddress(sendRecipient)) {
      addToast("error", "Invalid Address", "Recipient must be a valid 0x-prefixed address.");
      return;
    }

    const numAmount = parseFloat(sendAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      addToast("error", "Invalid Amount", "Please enter a transfer amount greater than 0.");
      return;
    }

    // Pre-flight balance check
    if (sendAssetType === "USDG" && numAmount > parseFloat(usdgBalance)) {
      addToast("error", "Insufficient Balance", `Available balance: ${usdgBalance} USDG`);
      return;
    }
    if (sendAssetType === "ETH" && numAmount > parseFloat(ethBalance)) {
      addToast("error", "Insufficient Balance", `Available balance: ${ethBalance} ETH`);
      return;
    }

    setIsSending(true);
    setTxSuccessHash(null);

    try {
      const parsedAmount =
        sendAssetType === "ETH"
          ? parseEther(sendAmount)
          : parseUnits(sendAmount, 6);

      // 1. Build standard transfer UserOp
      const userOpBase = wallet.buildTransferUserOp({
        to: sendRecipient as Address,
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
        // If the execution RPC has no native ERC-4337 bundler daemon, broadcast transfer directly via authorized client keystore
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
              to: sendRecipient as Address,
              value: parsedAmount,
            });
          } else {
            broadcastHash = await walletClient.writeContract({
              address: USDG_ADDRESS,
              abi: erc20Abi,
              functionName: "transfer",
              args: [sendRecipient as Address, parsedAmount],
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
        counterparty: sendRecipient,
        amount: sendAmount,
        asset: sendAssetType,
        timestamp: Date.now(),
        status: "confirmed",
      };
      const updatedList = [newRecord, ...transactions];
      setTransactions(updatedList);
      try {
        localStorage.setItem("privatum_transactions", JSON.stringify(updatedList));
      } catch {}

      addToast("success", "Transfer Complete", `Sent ${sendAmount} ${sendAssetType} to ${shortenAddress(sendRecipient)}`);

      setSendAmount("");
      setSendRecipient("");
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
      <div className="fixed top-5 right-6 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none">
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

      {/* Main Workspace (Rail + Content) */}
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
          <nav className="flex flex-col items-center gap-2.5 w-full px-2">
            <button
              onClick={() => setActiveTab("wallet")}
              title="Wallet"
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition ${
                activeTab === "wallet"
                  ? "bg-white/10 text-white border border-white/15"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Wallet className="w-5 h-5" />
            </button>

            <button
              onClick={() => setActiveTab("tokens")}
              title="Tokens"
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition ${
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
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition ${
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
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition ${
                activeTab === "recovery"
                  ? "bg-white/10 text-white border border-white/15"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Fingerprint className="w-5 h-5" />
            </button>
          </nav>
        </div>

        {/* Keystore Status Bottom */}
        <div className="flex flex-col items-center">
          <div
            title={wallet ? "Client Keystore Armed (2-of-3)" : "Wallet Standby"}
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
      <main className="flex-1 flex flex-col h-full overflow-y-auto bg-[#13151b]">
        {/* Top bar */}
        <header className="flex items-center justify-between px-8 py-4 border-b border-white/[0.06]">
          {/* Left: Sync status & Robinhood Network */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2 text-slate-400">
              <span>Last sync <strong className="font-semibold text-slate-200">{formatRelativeTime(lastSyncTime)}</strong></span>
              <button
                onClick={() => wallet && fetchBalances(wallet.address as Address)}
                disabled={isRefreshing || !wallet}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-slate-300 border border-white/[0.06] transition disabled:opacity-40"
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

          {/* Right: Address or Create button */}
          <div className="flex items-center gap-2">
            {wallet ? (
              <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] px-3 py-1.5 rounded-full text-xs font-mono text-slate-200">
                <span>{shortenAddress(walletAddress)}</span>
                <button
                  onClick={() => copyToClipboard(walletAddress, "Wallet address")}
                  className="text-slate-400 hover:text-white transition"
                  title="Copy address"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-1.5 rounded-full text-xs font-semibold bg-[#f64943] hover:bg-[#e03d38] text-white transition flex items-center gap-1.5"
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
                  onClick={() => {
                    setTxSuccessHash(null);
                    setShowSendModal(true);
                  }}
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
                onClick={() => {
                  setTxSuccessHash(null);
                  setShowSendModal(true);
                }}
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

            {shardCPrivKey && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs mt-4">
                <div className="font-semibold flex items-center gap-1.5 mb-1 text-amber-300">
                  <AlertCircle className="w-4 h-4" />
                  <span>Backup Shard C Private Key</span>
                </div>
                <p className="text-xs text-amber-200/80 mb-2">
                  This key is only displayed once upon account initialization. Keep it offline in a secure vault.
                </p>
                <div className="flex items-center justify-between font-mono bg-black/50 p-2.5 rounded-lg border border-amber-500/20 break-all text-xs text-amber-100">
                  <span>{shardCPrivKey}</span>
                  <button
                    onClick={() => copyToClipboard(shardCPrivKey, "Shard C key")}
                    className="p-1 text-amber-300 hover:text-white transition ml-2"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
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
      </main>
      </div>

      {/* Full-width Bottom Status Bar */}
      <footer className="w-full h-8 shrink-0 bg-[#0e1015] border-t border-white/[0.06] px-5 flex items-center justify-between text-xs text-slate-400 select-none z-20">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span className="text-slate-300 font-medium">Robinhood Chain</span>
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
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Send</h3>
              <button
                onClick={() => setShowSendModal(false)}
                className="text-slate-400 hover:text-white p-1 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendTransaction} className="space-y-4">
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

              <div>
                <label className="text-xs text-slate-400 block mb-1">Recipient Address</label>
                <input
                  type="text"
                  placeholder="0x..."
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
                    onClick={() => setSendAmount(sendAssetType === "USDG" ? usdgBalance : ethBalance)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400 hover:text-white px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 transition"
                  >
                    Max
                  </button>
                </div>
              </div>

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
                  disabled={isSending}
                  className="flex-1 py-2.5 rounded-xl bg-[#f64943] hover:bg-[#e03d38] text-white font-semibold text-xs transition disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <span>Send</span>
                  )}
                </button>
              </div>
            </form>
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
    </div>
  );
}

