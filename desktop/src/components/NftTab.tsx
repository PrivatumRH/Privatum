import React, { useState } from "react";
import {
  Sparkles,
  Send,
  ExternalLink,
  Loader2,
  X,
  CheckCircle2,
  Image as ImageIcon,
} from "lucide-react";
import { isAddress, type Address, type PublicClient } from "viem";
import { NftItem, buildNftTransferCall } from "../lib/nft";
import { executeAccountCall } from "../lib/execute";
import { PrivatumWallet, robinhoodChain } from "@privatumrh/robinhood-chain-sdk";

interface NftTabProps {
  client: PublicClient;
  wallet: PrivatumWallet | null;
  walletAddress: Address;
  shardAPrivKey?: string;
  addToast: (type: "success" | "error" | "info", title: string, message?: string) => void;
  onExecute?: (target: Address, value: bigint, data: `0x${string}`) => Promise<`0x${string}`>;
}

const SAMPLE_NFTS: NftItem[] = [
  {
    id: "rh-founder-pass",
    contractAddress: "0x389f417578D0B3D503C363d6439Ea4Ec918cfb70" as Address,
    collectionName: "Robinhood Frontier Collectibles",
    tokenId: "101",
    title: "Frontier Founder Badge",
    description: "Verified institutional Genesis self-custody pass on Robinhood Chain.",
    imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
    attributes: [
      { trait_type: "Tier", value: "Genesis" },
      { trait_type: "Network", value: "Robinhood Chain" },
    ],
  },
  {
    id: "rh-private-asset",
    contractAddress: "0x892e21b8fA5Dbca091807d8D88e0aF4C1B101a21" as Address,
    collectionName: "Privatum Vault Keys",
    tokenId: "4663",
    title: "Threshold Guardian Shard #4663",
    description: "Cryptographic custody commemoration badge for 2-of-3 threshold protection.",
    imageUrl: "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=600&auto=format&fit=crop&q=80",
    attributes: [
      { trait_type: "Threshold", value: "2-of-3 MPC" },
      { trait_type: "Security", value: "Institutional" },
    ],
  },
];

export function NftTab({
  client,
  wallet,
  walletAddress,
  shardAPrivKey,
  addToast,
  onExecute,
}: NftTabProps) {
  const [nfts] = useState<NftItem[]>(SAMPLE_NFTS);
  const [selectedNft, setSelectedNft] = useState<NftItem | null>(null);
  const [showSendModal, setShowSendModal] = useState<boolean>(false);
  const [recipient, setRecipient] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  async function handleSendNft() {
    if (!wallet || !selectedNft || !recipient) return;
    if (!isAddress(recipient.trim())) {
      addToast("error", "Invalid Recipient", "Please provide a valid Ethereum / Robinhood address.");
      return;
    }

    setIsSending(true);
    setTxHash(null);

    try {
      const { target, value, data } = buildNftTransferCall({
        contractAddress: selectedNft.contractAddress,
        from: walletAddress,
        to: recipient.trim() as Address,
        tokenId: BigInt(selectedNft.tokenId),
      });

      // Submit safeTransferFrom call via smart account execute
      const resHash = onExecute
        ? await onExecute(target, value, data)
        : await executeAccountCall({
            wallet,
            shardAPrivKey,
            client,
            target,
            value,
            data,
          });
      setTxHash(resHash);
      addToast("success", "NFT Sent Successfully", `Transferred ${selectedNft.title} to ${recipient.slice(0, 8)}...`);
      setShowSendModal(false);
      setRecipient("");
    } catch (err: any) {
      const msg = err?.message || String(err);
      addToast("error", "Transfer Failed", msg.length > 70 ? `${msg.slice(0, 70)}...` : msg);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span>Digital Collectibles & NFTs</span>
          </h2>
          <p className="text-xs text-neutral-400">
            Frontier ERC-721 assets held in your 2-of-3 threshold smart account on Robinhood Chain
          </p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/5 border border-white/10 text-neutral-300">
          {nfts.length} Collectibles
        </span>
      </div>

      {/* NFT Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {nfts.map((nft) => (
          <div
            key={nft.id}
            className="group rounded-3xl bg-neutral-900/70 border border-white/10 overflow-hidden backdrop-blur-xl hover:border-white/20 transition-all flex flex-col shadow-xl"
          >
            <div className="relative aspect-square overflow-hidden bg-black/40">
              <img
                src={nft.imageUrl}
                alt={nft.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold bg-black/60 backdrop-blur-md text-white border border-white/10">
                #{nft.tokenId}
              </span>
            </div>

            <div className="p-4 flex flex-col flex-1 justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  {nft.collectionName}
                </span>
                <h3 className="font-bold text-white text-base leading-tight mt-0.5">{nft.title}</h3>
                <p className="text-xs text-neutral-400 mt-1 line-clamp-2">{nft.description}</p>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                <button
                  onClick={() => {
                    setSelectedNft(nft);
                    setShowSendModal(true);
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
                <a
                  href={`${robinhoodChain.blockExplorers.default.url}/token/${nft.contractAddress}?a=${nft.tokenId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                  title="View Contract"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Send NFT Modal */}
      {showSendModal && selectedNft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-white/15 rounded-3xl p-6 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-base">Send NFT Collectible</span>
              <button
                onClick={() => setShowSendModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
              <img
                src={selectedNft.imageUrl}
                alt={selectedNft.title}
                className="w-12 h-12 rounded-xl object-cover"
              />
              <div className="flex flex-col">
                <span className="font-bold text-white text-sm">{selectedNft.title}</span>
                <span className="text-xs text-neutral-400">{selectedNft.collectionName}</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-neutral-400 font-medium">Recipient Address</label>
              <input
                type="text"
                placeholder="0x..."
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="p-3 rounded-xl bg-black/40 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-red-500/50"
              />
            </div>

            <button
              disabled={!recipient || !isAddress(recipient.trim()) || isSending}
              onClick={handleSendNft}
              className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                !recipient || !isAddress(recipient.trim()) || isSending
                  ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                  : "bg-red-600 hover:bg-red-500 text-white"
              }`}
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authorizing 2-of-3 Transfer...</span>
                </>
              ) : (
                <span>Confirm Transfer</span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
