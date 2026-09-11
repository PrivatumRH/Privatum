import React, { useState, useEffect } from "react";
import {
  Shield,
  Eye,
  Scan,
  Copy,
  Check,
  X,
  ExternalLink,
  Loader2,
  Lock,
  Sparkles,
} from "lucide-react";
import QRCode from "qrcode";
import { formatEther, formatUnits, type Hex, type Address, type PublicClient } from "viem";
import { USDG_ADDRESS, erc20Abi, robinhoodChain } from "@privatumrh/robinhood-chain-sdk";
import {
  generateStealthMetaAddressFromSeed,
  checkAnnouncement,
  ERC5564_ANNOUNCER,
  ANNOUNCER_ABI,
  type AnnouncementRecord,
} from "../lib/stealth";

interface StealthScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  shardAPrivKey: Hex;
  client: PublicClient;
  walletAddress: Address;
  addToast: (type: "success" | "error" | "info", title: string, message?: string) => void;
}

export function StealthScannerModal({
  isOpen,
  onClose,
  shardAPrivKey,
  client,
  walletAddress,
  addToast,
}: StealthScannerModalProps) {
  const [copied, setCopied] = useState<boolean>(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [discoveredTransfers, setDiscoveredTransfers] = useState<AnnouncementRecord[]>([]);

  // Derive stealth meta-address from user's local Shard A key
  const stealthInfo = React.useMemo(() => {
    if (!shardAPrivKey) return null;
    try {
      return generateStealthMetaAddressFromSeed(shardAPrivKey);
    } catch {
      return null;
    }
  }, [shardAPrivKey]);

  useEffect(() => {
    if (stealthInfo?.metaAddress) {
      QRCode.toDataURL(stealthInfo.metaAddress, {
        margin: 1,
        width: 180,
        color: { dark: "#000000", light: "#ffffff" },
      }).then(setQrCodeUrl).catch(() => {});
    }
  }, [stealthInfo]);

  function copyMetaAddress() {
    if (!stealthInfo) return;
    navigator.clipboard.writeText(stealthInfo.metaAddress);
    setCopied(true);
    addToast("success", "Stealth Meta-Address Copied", "Share this address for untraceable incoming payments.");
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleScan() {
    if (!stealthInfo) return;
    setIsScanning(true);

    try {
      // Query recent ERC-5564 announcement logs on Robinhood Chain
      const currentBlock = await client.getBlockNumber();
      const fromBlock = currentBlock > 2000n ? currentBlock - 2000n : 0n;

      const logs = await client.getLogs({
        address: ERC5564_ANNOUNCER,
        event: ANNOUNCER_ABI[1],
        fromBlock,
        toBlock: currentBlock,
      }).catch(() => []);

      const found: AnnouncementRecord[] = [];
      for (const log of logs) {
        const stealthAddress = (log.args as any)?.stealthAddress;
        const ephemeralPubKey = (log.args as any)?.ephemeralPubKey;
        const metadata = (log.args as any)?.metadata || "0x00";
        const viewTag = parseInt(metadata.slice(2, 4) || "00", 16);

        if (stealthAddress && ephemeralPubKey) {
          const isMine = checkAnnouncement(
            { ephemeralPubKey, stealthAddress, viewTag },
            stealthInfo.viewPriv,
            stealthInfo.spendPub
          );

          if (isMine) {
            let balEth = "0.0000";
            let balUsdg = "0.00";
            try {
              const bEth = await client.getBalance({ address: stealthAddress });
              balEth = formatEther(bEth);
              const bUsdg = await client.readContract({
                address: USDG_ADDRESS,
                abi: erc20Abi,
                functionName: "balanceOf",
                args: [stealthAddress],
              });
              balUsdg = formatUnits(bUsdg, 6);
            } catch {}

            found.push({
              stealthAddress,
              ephemeralPubKey,
              viewTag,
              blockNumber: log.blockNumber,
              txHash: log.transactionHash,
              discoveredBalanceEth: balEth,
              discoveredBalanceUsdg: balUsdg,
            });
          }
        }
      }

      setDiscoveredTransfers(found);
      addToast(
        "info",
        "Scan Complete",
        found.length > 0
          ? `Found ${found.length} private incoming transfer(s)!`
          : "No new stealth announcements detected in the scanned block window."
      );
    } catch (err: any) {
      addToast("error", "Scan Failed", "Could not query on-chain announcement logs.");
    } finally {
      setIsScanning(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="w-full max-w-lg bg-neutral-900 border border-white/15 rounded-3xl p-6 flex flex-col gap-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-base">ERC-5564 Stealth Inbox</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shareable Stealth Meta-Address Card */}
        <div className="p-4 rounded-2xl bg-black/40 border border-white/10 flex flex-col items-center gap-3 text-center">
          {qrCodeUrl ? (
            <div className="p-2 rounded-xl bg-white shadow-md">
              <img src={qrCodeUrl} alt="Stealth Meta-Address QR" className="w-36 h-36 rounded-lg" />
            </div>
          ) : (
            <div className="w-36 h-36 rounded-xl bg-white/5 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
            </div>
          )}

          <div className="flex flex-col gap-1 w-full">
            <span className="text-xs text-neutral-400 font-semibold">Your Stealth Meta-Address</span>
            <div className="p-2.5 rounded-xl bg-neutral-950/80 border border-white/5 font-mono text-[11px] text-neutral-300 break-all select-all">
              {stealthInfo?.metaAddress || "Generating..."}
            </div>
          </div>

          <button
            onClick={copyMetaAddress}
            className="flex items-center gap-1.5 py-2 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied" : "Copy Meta-Address"}</span>
          </button>
        </div>

        {/* Scan Section */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Scan className="w-4 h-4 text-neutral-400" /> Discovered Stealth Payments
            </span>
            <button
              disabled={isScanning}
              onClick={handleScan}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-semibold disabled:opacity-50"
            >
              {isScanning && <Loader2 className="w-3 h-3 animate-spin" />}
              <span>Scan On-Chain</span>
            </button>
          </div>

          <div className="max-h-36 overflow-y-auto flex flex-col gap-1.5">
            {discoveredTransfers.length === 0 ? (
              <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center text-xs text-neutral-400">
                No active stealth announcements found. Click "Scan On-Chain" to scan recent blocks.
              </div>
            ) : (
              discoveredTransfers.map((t, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs"
                >
                  <div className="flex flex-col font-mono text-[11px]">
                    <span className="text-emerald-400 font-semibold">Stealth: {t.stealthAddress.slice(0, 8)}...</span>
                    <span className="text-neutral-500">
                      Block #{t.blockNumber?.toString() || "latest"}
                      {t.discoveredBalanceEth && parseFloat(t.discoveredBalanceEth) > 0 && ` • ${parseFloat(t.discoveredBalanceEth).toFixed(4)} ETH`}
                      {t.discoveredBalanceUsdg && parseFloat(t.discoveredBalanceUsdg) > 0 && ` • ${parseFloat(t.discoveredBalanceUsdg).toFixed(2)} USDG`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                      Discovered
                    </span>
                    {t.txHash && (
                      <a
                        href={`${robinhoodChain.blockExplorers.default.url}/tx/${t.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition"
                        title="View on Explorer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
