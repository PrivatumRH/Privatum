import React, { useEffect, useState } from "react";
import {
  KeyRound,
  Server,
  Fingerprint,
  Send,
  Download,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  PlusCircle,
} from "lucide-react";
import { createPublicClient, formatEther, formatUnits, http, isAddress, parseEther, parseUnits, type Address, type Hex } from "viem";
import {
  PrivatumWallet,
  LocalShard,
  RemoteCosigner,
  robinhoodChain,
  USDG_ADDRESS,
  erc20Abi,
  DEFAULT_API_URL,
} from "@privatumrh/robinhood-chain-sdk";
import { invoke, isTauri } from "@tauri-apps/api/core";

const publicClient = createPublicClient({
  chain: robinhoodChain,
  transport: http(),
});

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
  const [activeTab, setActiveTab] = useState<"assets" | "shards" | "recovery">("assets");
  const [wallet, setWallet] = useState<PrivatumWallet | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [shardAPrivKey, setShardAPrivKey] = useState<string>("");
  const [shardCAddress, setShardCAddress] = useState<string>("");
  const [shardCPrivKey, setShardCPrivKey] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");

  const [ethBalance, setEthBalance] = useState<string>("0.0000");
  const [usdgBalance, setUsdgBalance] = useState<string>("0.00");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Modals
  const [showSendModal, setShowSendModal] = useState<boolean>(false);
  const [showReceiveModal, setShowReceiveModal] = useState<boolean>(false);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);

  // Send Form
  const [sendAssetType, setSendAssetType] = useState<"ETH" | "USDG">("USDG");
  const [sendRecipient, setSendRecipient] = useState<string>("");
  const [sendAmount, setSendAmount] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [txSuccessHash, setTxSuccessHash] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // Recovery / TOTP state
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState<string>("");
  const [totpVerified, setTotpVerified] = useState<boolean>(false);
  const [totpMessage, setTotpMessage] = useState<string | null>(null);

  const [copied, setCopied] = useState<string | null>(null);

  // Copy helper
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  // Load wallet on mount and warm up co-signer service
  useEffect(() => {
    // Ping co-signer health endpoint in background to wake up cold-start instances
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
    } catch (err) {
      console.warn("Balance fetch error (counterfactual wallet or network):", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateWallet = async () => {
    setIsSending(true);
    setSendError(null);

    let lastError: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (attempt > 1) {
          setSendError(`Connecting to co-signer service (waking up server instance, attempt ${attempt} of 3)...`);
        }

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

        setSendError(null);
        setShowCreateModal(false);
        fetchBalances(newWallet.address as Address);
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

    const rawMessage = lastError?.message || "Failed to create wallet";
    if (rawMessage.includes("Load failed") || rawMessage.includes("Failed to fetch")) {
      setSendError("Co-signer service at api.privatumrh.com is waking up from sleep. Please wait a few seconds and try again.");
    } else {
      setSendError(rawMessage);
    }
    setIsSending(false);
  };

  const handleSendTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) return;

    if (!isAddress(sendRecipient)) {
      setSendError("Recipient must be a valid 0x-prefixed address");
      return;
    }

    const numAmount = parseFloat(sendAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setSendError("Please specify a positive transfer amount");
      return;
    }

    setIsSending(true);
    setSendError(null);
    setTxSuccessHash(null);

    try {
      const parsedAmount =
        sendAssetType === "ETH"
          ? parseEther(sendAmount)
          : parseUnits(sendAmount, 6);

      const receipt = await wallet.sendAsset({
        to: sendRecipient as Address,
        amount: parsedAmount,
        asset: sendAssetType,
      });

      setTxSuccessHash(receipt.userOpHash);
      fetchBalances(wallet.address);
      setSendAmount("");
      setSendRecipient("");
    } catch (err: any) {
      const rawMsg = err.message || "Transaction submission failed";
      if (rawMsg.includes("Load failed") || rawMsg.includes("Failed to fetch")) {
        setSendError("Co-signer service at api.privatumrh.com is currently waking up or temporarily unreachable. Please retry.");
      } else {
        setSendError(rawMsg);
      }
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
      setTotpMessage(null);
    } catch (err: any) {
      setTotpMessage(err.message || "Failed to start TOTP setup");
    }
  };

  const handleConfirmTotp = async () => {
    if (!wallet || !totpCode || totpCode.length !== 6) return;
    try {
      const success = await wallet.confirmTotpRecovery(totpCode);
      if (success) {
        setTotpVerified(true);
        setTotpMessage("TOTP 2FA emergency recovery successfully enabled.");
      }
    } catch (err: any) {
      setTotpMessage(err.message || "Invalid 6-digit TOTP code");
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-100 font-sans p-6 selection:bg-white/20">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 pb-5 mb-6">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="PRIVATUM"
            className="w-9 h-9 rounded-xl object-contain bg-white/10 p-1 border border-white/15 shadow-sm"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white tracking-tight text-base">Privatum</span>
              <span className="text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10">
                Desktop
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Robinhood Chain (Chain ID 4663)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {wallet ? (
            <div className="flex items-center gap-2 mr-2">
              <span className="text-xs font-mono text-slate-300 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </span>
              <button
                onClick={() => fetchBalances(wallet.address as Address)}
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition"
                title="Refresh Balances"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-white" : ""}`} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white text-slate-950 hover:bg-slate-200 transition flex items-center gap-1.5 mr-2 shadow-sm"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create Account</span>
            </button>
          )}

          <div className="flex items-center p-1 rounded-full bg-white/5 border border-white/10">
            <button
              onClick={() => setActiveTab("assets")}
              className={`px-3.5 py-1 rounded-full text-xs font-medium transition ${
                activeTab === "assets"
                  ? "bg-white text-slate-950 font-semibold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Balances
            </button>
            <button
              onClick={() => setActiveTab("shards")}
              className={`px-3.5 py-1 rounded-full text-xs font-medium transition ${
                activeTab === "shards"
                  ? "bg-white text-slate-950 font-semibold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Shard Health
            </button>
            <button
              onClick={() => setActiveTab("recovery")}
              className={`px-3.5 py-1 rounded-full text-xs font-medium transition ${
                activeTab === "recovery"
                  ? "bg-white text-slate-950 font-semibold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              2FA Recovery
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      {activeTab === "assets" && (
        <div className="space-y-6">
          {/* Total Value Card */}
          <div className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 shadow-xl backdrop-blur-sm">
            <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Estimated Account Value
              </span>
              <div className="text-3xl font-bold tracking-tight text-white mt-1">
                ${parseFloat(usdgBalance).toLocaleString("en-US", { minimumFractionDigits: 2 })} USDG
              </div>
              <div className="text-xs text-slate-400 mt-1.5 flex items-center gap-2">
                <span>Robinhood Chain Gas:</span>
                <span className="font-mono text-slate-300">{ethBalance} ETH</span>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  disabled={!wallet}
                  onClick={() => {
                    setSendError(null);
                    setTxSuccessHash(null);
                    setShowSendModal(true);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-white text-slate-950 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-slate-200 transition shadow-sm disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send (2-of-3 Quorum)</span>
                </button>
                <button
                  disabled={!wallet}
                  onClick={() => setShowReceiveModal(true)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 text-white font-semibold text-xs flex items-center justify-center gap-2 hover:bg-white/15 border border-white/10 transition shadow-sm disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Receive Address</span>
                </button>
              </div>
            </div>
          </div>

          {/* Frontier Assets List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Frontier Assets (Robinhood Chain)
              </h2>
              <span className="text-[11px] text-slate-500 font-mono">2 Active Currencies</span>
            </div>

            {/* USDG */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-white/20 hover:bg-white/[0.05] flex items-center justify-between transition">
              <div className="flex items-center gap-3.5">
                <TokenAvatar
                  symbol="USDG"
                  name="USDG Global Dollar"
                  iconUrl="/usdg_logo.png"
                  size="md"
                />
                <div>
                  <div className="text-sm font-semibold text-white flex items-center gap-2">
                    <span>USDG</span>
                    <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Stablecoin
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">Robinhood Global Dollar</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-white font-mono">{usdgBalance} USDG</div>
                <div className="text-xs text-slate-400 mt-0.5">${usdgBalance}</div>
              </div>
            </div>

            {/* ETH */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-white/20 hover:bg-white/[0.05] flex items-center justify-between transition">
              <div className="flex items-center gap-3.5">
                <TokenAvatar
                  symbol="ETH"
                  name="Ethereum"
                  iconUrl="/eth.jpeg"
                  size="md"
                />
                <div>
                  <div className="text-sm font-semibold text-white flex items-center gap-2">
                    <span>ETH</span>
                    <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10">
                      Gas Token
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">Robinhood Chain Native Gas</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-white font-mono">{ethBalance} ETH</div>
                <div className="text-xs text-slate-400 mt-0.5">Native Settlement</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "shards" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              2-of-3 Threshold Architecture
            </h2>
            <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>Quorum Armed</span>
            </span>
          </div>

          {/* Shard A */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white">
                <KeyRound className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">Shard A: Client Keystore</div>
                <div className="text-xs text-slate-400 mt-0.5 font-mono">
                  {wallet ? `Local key: ${wallet.shardA.address.slice(0, 10)}...` : "Not initialized"}
                </div>
              </div>
            </div>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>{wallet ? "Ready" : "Inactive"}</span>
            </span>
          </div>

          {/* Shard B */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white">
                <Server className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">Shard B: Server Co-Signer</div>
                <div className="text-xs text-slate-400 mt-0.5 font-mono">
                  {wallet ? `Co-signer: ${wallet.shardB.address.slice(0, 10)}... (api.privatumrh.com)` : "api.privatumrh.com"}
                </div>
              </div>
            </div>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>Online</span>
            </span>
          </div>

          {/* Shard C */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white">
                <Fingerprint className="w-4 h-4 text-slate-300" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">Shard C: Emergency Recovery Key</div>
                <div className="text-xs text-slate-400 mt-0.5 font-mono">
                  {shardCAddress ? `Recovery: ${shardCAddress.slice(0, 10)}...` : "Secp256k1 key + RFC 6238 TOTP"}
                </div>
              </div>
            </div>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/10 text-slate-300 border border-white/10 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
              <span>{shardCAddress ? "Enrolled" : "Standby"}</span>
            </span>
          </div>

          {shardCPrivKey && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs">
              <div className="font-semibold flex items-center gap-1.5 mb-1 text-amber-300">
                <AlertCircle className="w-4 h-4" />
                <span>Backup Shard C Private Key Now</span>
              </div>
              <p className="text-xs text-amber-200/80 mb-2">
                This key is only displayed once upon account creation. Store it in a secure offline location.
              </p>
              <div className="flex items-center justify-between font-mono bg-black/50 p-2.5 rounded-lg border border-amber-500/20 break-all text-xs text-amber-100">
                <span>{shardCPrivKey}</span>
                <button
                  onClick={() => copyToClipboard(shardCPrivKey, "shard_c_key")}
                  className="p-1 text-amber-300 hover:text-white transition ml-2"
                >
                  {copied === "shard_c_key" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "recovery" && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm">
            <h2 className="text-sm font-semibold text-white mb-2">RFC 6238 TOTP Two-Factor Recovery</h2>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed max-w-xl">
              Pair your wallet with Google Authenticator or Authy. If your local device key (Shard A) is ever lost or corrupted,
              you can recover your wallet and rotate to a new device key using Shard C and your 6-digit TOTP code.
            </p>

            {!totpSecret ? (
              <button
                disabled={!wallet}
                onClick={handleStartTotpSetup}
                className="px-4 py-2 rounded-xl bg-white text-slate-950 font-semibold text-xs hover:bg-slate-200 transition shadow-sm disabled:opacity-40"
              >
                Start Authenticator Pairing
              </button>
            ) : (
              <div className="space-y-4 pt-3 border-t border-white/10">
                <div className="bg-black/40 p-3.5 rounded-xl border border-white/10 text-xs font-mono">
                  <div className="text-slate-400 text-[11px] mb-1">Base32 Secret:</div>
                  <div className="text-white flex items-center justify-between">
                    <span>{totpSecret}</span>
                    <button
                      onClick={() => copyToClipboard(totpSecret, "totp_secret")}
                      className="p-1 hover:text-white text-slate-400 transition"
                    >
                      {copied === "totp_secret" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
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
                    disabled={totpCode.length !== 6}
                    className="px-4 py-2 rounded-xl bg-white text-slate-950 font-semibold text-xs hover:bg-slate-200 transition shadow-sm disabled:opacity-40"
                  >
                    Confirm Code
                  </button>
                </div>
              </div>
            )}

            {totpMessage && (
              <div className="mt-4 text-xs text-white bg-white/10 p-3 rounded-xl border border-white/15">
                {totpMessage}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Create Account */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#10141f] border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-semibold text-white">Create 2-of-3 Self-Custody Account</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              This generates an orthogonal secp256k1 keypair on this client machine (Shard A) and registers a 2-of-3 threshold
              quorum with the PRIVATUM co-signer (Shard B).
            </p>

            {sendError && (
              <div className="text-xs text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
                {sendError}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-slate-300 font-semibold text-xs hover:bg-white/15 border border-white/10 transition"
              >
                Cancel
              </button>
              <button
                disabled={isSending}
                onClick={handleCreateWallet}
                className="flex-1 py-2.5 rounded-xl bg-white text-slate-950 font-semibold text-xs hover:bg-slate-200 transition shadow-sm disabled:opacity-40"
              >
                {isSending ? "Creating..." : "Initialize Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Send Transaction */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#10141f] border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-semibold text-white">Send Frontier Asset</h3>

            <form onSubmit={handleSendTransaction} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 font-mono block mb-1.5">Select Asset</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSendAssetType("USDG")}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition flex items-center justify-center gap-2 ${
                      sendAssetType === "USDG"
                        ? "bg-white text-slate-950 border-white shadow-sm"
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
                        ? "bg-white text-slate-950 border-white shadow-sm"
                        : "bg-white/[0.03] text-slate-400 border-white/10 hover:text-white"
                    }`}
                  >
                    <TokenAvatar symbol="ETH" name="ETH" iconUrl="/eth.jpeg" size="sm" />
                    <span>ETH</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-mono block mb-1">Recipient Address</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={sendRecipient}
                  onChange={(e) => setSendRecipient(e.target.value.trim())}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-white/30"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-mono block mb-1">Amount</label>
                <input
                  type="text"
                  placeholder="0.0"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value.trim())}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-white/30"
                />
              </div>

              {sendError && (
                <div className="text-xs text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20 break-words">
                  {sendError}
                </div>
              )}

              {txSuccessHash && (
                <div className="text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 break-words font-mono">
                  UserOp broadcasted: {txSuccessHash.slice(0, 16)}...
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSendModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 text-slate-300 font-semibold text-xs hover:bg-white/15 border border-white/10 transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSending}
                  className="flex-1 py-2.5 rounded-xl bg-white text-slate-950 font-semibold text-xs hover:bg-slate-200 transition shadow-sm disabled:opacity-40"
                >
                  {isSending ? "Signing & Relaying..." : "Sign & Send"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Receive Address */}
      {showReceiveModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#10141f] border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-semibold text-white">Receive Frontier Assets</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Send ETH or USDG on Robinhood Chain (Chain ID 4663) directly to your self-custodial account address.
            </p>

            <div className="bg-black/40 p-3.5 rounded-xl border border-white/10 font-mono text-xs break-all flex items-center justify-between text-white">
              <span>{walletAddress}</span>
              <button
                onClick={() => copyToClipboard(walletAddress, "wallet_address_recv")}
                className="p-1 hover:text-white text-slate-400 transition ml-2"
              >
                {copied === "wallet_address_recv" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowReceiveModal(false)}
                className="w-full py-2.5 rounded-xl bg-white text-slate-950 font-semibold text-xs hover:bg-slate-200 transition shadow-sm"
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

