import React, { useEffect, useState } from "react";
import {
  Shield,
  KeyRound,
  Server,
  Fingerprint,
  Send,
  Download,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
  PlusCircle,
  QrCode,
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
} from "@privatum/robinhood-chain-sdk";
import { invoke, isTauri } from "@tauri-apps/api/core";

const publicClient = createPublicClient({
  chain: robinhoodChain,
  transport: http(),
});

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

  // Load wallet on mount
  useEffect(() => {
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
      fetchBalances(newWallet.address);
    } catch (err: any) {
      setSendError(err.message || "Failed to create wallet");
    } finally {
      setIsSending(false);
    }
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
      setSendError(err.message || "Transaction submission failed");
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
    <div className="min-h-screen bg-[#080d14] text-slate-100 font-sans p-6">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-900 border border-[#38B6FF]/40 flex items-center justify-center text-[#38B6FF]">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-semibold text-white tracking-wider text-base">PRIVATUM DESKTOP</h1>
            <span className="text-[11px] font-mono text-[#38B6FF]">Robinhood Chain - Chain ID 4663</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {wallet ? (
            <div className="flex items-center gap-2 mr-2">
              <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </span>
              <button
                onClick={() => fetchBalances(wallet.address)}
                className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white border border-slate-800 transition"
                title="Refresh Balances"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-[#38B6FF]" : ""}`} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#38B6FF] text-slate-950 hover:bg-[#38B6FF]/90 transition flex items-center gap-1.5 mr-2"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create Account</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab("assets")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === "assets"
                ? "bg-[#38B6FF] text-slate-950 font-semibold"
                : "bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            Balances
          </button>
          <button
            onClick={() => setActiveTab("shards")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === "shards"
                ? "bg-[#38B6FF] text-slate-950 font-semibold"
                : "bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            Shard Health
          </button>
          <button
            onClick={() => setActiveTab("recovery")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === "recovery"
                ? "bg-[#38B6FF] text-slate-950 font-semibold"
                : "bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            2FA Recovery
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      {activeTab === "assets" && (
        <div className="space-y-6">
          {/* Total Value Card */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-xl">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Estimated Account Value</span>
            <div className="text-3xl font-bold text-white mt-1">
              ${parseFloat(usdgBalance).toLocaleString("en-US", { minimumFractionDigits: 2 })} USDG
            </div>
            <div className="text-xs text-slate-500 mt-1">
              + {ethBalance} ETH for Robinhood Chain network gas
            </div>

            <div className="flex gap-3 mt-6">
              <button
                disabled={!wallet}
                onClick={() => {
                  setSendError(null);
                  setTxSuccessHash(null);
                  setShowSendModal(true);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#38B6FF] text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-[#38B6FF]/90 transition disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send (2-of-3 Quorum)</span>
              </button>
              <button
                disabled={!wallet}
                onClick={() => setShowReceiveModal(true)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-slate-700 transition disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Receive Address</span>
              </button>
            </div>
          </div>

          {/* Frontier Assets List */}
          <div className="space-y-3">
            <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400">Frontier Assets (Robinhood Chain)</h2>

            {/* USDG */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold text-xs">
                  $
                </div>
                <div>
                  <div className="text-sm font-medium text-white">USDG</div>
                  <div className="text-[11px] text-slate-500">Robinhood Global Dollar Stablecoin</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-white">{usdgBalance} USDG</div>
                <div className="text-[11px] text-slate-500">${usdgBalance}</div>
              </div>
            </div>

            {/* ETH */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#38B6FF]/10 text-[#38B6FF] border border-[#38B6FF]/20 flex items-center justify-center font-bold text-xs">
                  Ξ
                </div>
                <div>
                  <div className="text-sm font-medium text-white">ETH</div>
                  <div className="text-[11px] text-slate-500">Robinhood Chain Native Gas</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-white">{ethBalance} ETH</div>
                <div className="text-[11px] text-slate-500">Native Settlement</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "shards" && (
        <div className="space-y-4">
          <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400">2-of-3 Threshold Architecture</h2>

          {/* Shard A */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-emerald-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <KeyRound className="w-5 h-5 text-emerald-400" />
              <div>
                <div className="text-sm font-medium text-white">Shard A: Client Keystore</div>
                <div className="text-[11px] text-slate-500">
                  {wallet ? `Stored locally: ${wallet.shardA.address.slice(0, 10)}...` : "Not initialized"}
                </div>
              </div>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {wallet ? "Ready" : "Inactive"}
            </span>
          </div>

          {/* Shard B */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-emerald-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-emerald-400" />
              <div>
                <div className="text-sm font-medium text-white">Shard B: Server Co-Signer</div>
                <div className="text-[11px] text-slate-500">
                  {wallet ? `Co-signer: ${wallet.shardB.address.slice(0, 10)}... (api.privatumrh.com)` : "api.privatumrh.com"}
                </div>
              </div>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Online
            </span>
          </div>

          {/* Shard C */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Fingerprint className="w-5 h-5 text-[#38B6FF]" />
              <div>
                <div className="text-sm font-medium text-white">Shard C: Emergency Recovery Key</div>
                <div className="text-[11px] text-slate-500">
                  {shardCAddress ? `Recovery address: ${shardCAddress.slice(0, 10)}...` : "Secp256k1 key + RFC 6238 TOTP"}
                </div>
              </div>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#38B6FF]/10 text-[#38B6FF] border border-[#38B6FF]/20">
              {shardCAddress ? "Enrolled" : "Standby"}
            </span>
          </div>

          {shardCPrivKey && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
              <div className="font-semibold flex items-center gap-1.5 mb-1">
                <AlertCircle className="w-4 h-4" />
                <span>Backup Shard C Private Key Now</span>
              </div>
              <p className="text-[11px] text-amber-300/80 mb-2">
                This key is only displayed once upon account creation. Store it in a secure offline location.
              </p>
              <div className="flex items-center gap-2 font-mono bg-slate-950 p-2 rounded border border-amber-500/20 break-all text-[11px]">
                <span>{shardCPrivKey}</span>
                <button
                  onClick={() => copyToClipboard(shardCPrivKey, "shard_c_key")}
                  className="p-1 hover:text-white"
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
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
            <h2 className="text-sm font-semibold text-white mb-2">RFC 6238 TOTP Two-Factor Recovery</h2>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Pair your wallet with Google Authenticator or Authy. If your local device key (Shard A) is ever lost or corrupted,
              you can recover your wallet and rotate to a new device key using Shard C and your 6-digit TOTP code.
            </p>

            {!totpSecret ? (
              <button
                disabled={!wallet}
                onClick={handleStartTotpSetup}
                className="px-4 py-2 rounded-xl bg-[#38B6FF] text-slate-950 font-semibold text-xs hover:bg-[#38B6FF]/90 transition disabled:opacity-50"
              >
                Start Authenticator Pairing
              </button>
            ) : (
              <div className="space-y-4 pt-2 border-t border-slate-800">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono">
                  <div className="text-slate-500 text-[11px] mb-1">Base32 Secret:</div>
                  <div className="text-[#38B6FF] flex items-center justify-between">
                    <span>{totpSecret}</span>
                    <button
                      onClick={() => copyToClipboard(totpSecret, "totp_secret")}
                      className="p-1 hover:text-white"
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
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#38B6FF]"
                  />
                  <button
                    onClick={handleConfirmTotp}
                    disabled={totpCode.length !== 6}
                    className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-semibold text-xs hover:bg-emerald-400 transition disabled:opacity-50"
                  >
                    Confirm Code
                  </button>
                </div>
              </div>
            )}

            {totpMessage && (
              <div className="mt-4 text-xs text-[#38B6FF] bg-[#38B6FF]/10 p-3 rounded-xl border border-[#38B6FF]/20">
                {totpMessage}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Create Account */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
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
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                disabled={isSending}
                onClick={handleCreateWallet}
                className="flex-1 py-2.5 rounded-xl bg-[#38B6FF] text-slate-950 font-semibold text-xs hover:bg-[#38B6FF]/90 transition disabled:opacity-50"
              >
                {isSending ? "Creating..." : "Initialize Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Send Transaction */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-semibold text-white">Send Frontier Asset</h3>

            <form onSubmit={handleSendTransaction} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 font-mono block mb-1">Select Asset</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSendAssetType("USDG")}
                    className={`py-2 rounded-xl text-xs font-semibold border transition ${
                      sendAssetType === "USDG"
                        ? "bg-[#38B6FF] text-slate-950 border-[#38B6FF]"
                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    USDG (Stablecoin)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSendAssetType("ETH")}
                    className={`py-2 rounded-xl text-xs font-semibold border transition ${
                      sendAssetType === "ETH"
                        ? "bg-[#38B6FF] text-slate-950 border-[#38B6FF]"
                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    ETH (Native Gas)
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#38B6FF]"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-mono block mb-1">Amount</label>
                <input
                  type="text"
                  placeholder="0.0"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value.trim())}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#38B6FF]"
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
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs hover:bg-slate-700 transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSending}
                  className="flex-1 py-2.5 rounded-xl bg-[#38B6FF] text-slate-950 font-semibold text-xs hover:bg-[#38B6FF]/90 transition disabled:opacity-50"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-semibold text-white">Receive Frontier Assets</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Send ETH or USDG on Robinhood Chain (Chain ID 4663) directly to your self-custodial account address.
            </p>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs break-all flex items-center justify-between text-[#38B6FF]">
              <span>{walletAddress}</span>
              <button
                onClick={() => copyToClipboard(walletAddress, "wallet_address_recv")}
                className="p-1 hover:text-white"
              >
                {copied === "wallet_address_recv" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowReceiveModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs hover:bg-slate-700 transition"
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
