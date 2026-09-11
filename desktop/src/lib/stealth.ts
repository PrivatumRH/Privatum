import { secp256k1 } from "@noble/curves/secp256k1.js";
import {
  keccak256,
  bytesToHex,
  hexToBytes,
  encodeFunctionData,
  parseAbi,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { publicKeyToAddress, privateKeyToAccount } from "viem/accounts";
import { robinhoodChain } from "@privatumrh/robinhood-chain-sdk";

export const ERC5564_ANNOUNCER = "0x55649E01B5Df198D18D95b5cc5051630cfD45564" as const;

export const ANNOUNCER_ABI = parseAbi([
  "function announce(uint256 schemeId, address stealthAddress, bytes ephemeralPubKey, bytes metadata) external",
  "event Announcement(uint256 indexed schemeId, address indexed stealthAddress, address indexed caller, bytes ephemeralPubKey, bytes metadata)",
]);

const ERC20_ABI = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
]);

export interface StealthMetaAddress {
  spendPub: Hex;
  viewPub: Hex;
}

export interface StealthResult {
  stealthAddress: Address;
  ephemeralPubKey: Hex;
  viewTag: number;
}

export interface AnnouncementRecord {
  stealthAddress: Address;
  ephemeralPubKey: Hex;
  viewTag: number;
  blockNumber?: bigint;
  txHash?: Hex;
  discoveredBalanceEth?: string;
  discoveredBalanceUsdg?: string;
}

function numberToBytes32(n: bigint): Uint8Array {
  return hexToBytes(`0x${n.toString(16).padStart(64, "0")}`);
}

export function parseMetaAddress(raw: string): StealthMetaAddress {
  const hex = raw.trim().replace(/^0x/, "");
  if (hex.length !== 132) {
    throw new Error("Stealth meta-address must be 66 bytes / 132 hex characters (spendPub || viewPub)");
  }
  return {
    spendPub: `0x${hex.slice(0, 66)}` as Hex,
    viewPub: `0x${hex.slice(66)}` as Hex,
  };
}

export function encodeMetaAddress(spendPub: Hex, viewPub: Hex): Hex {
  return `0x${spendPub.replace(/^0x/, "")}${viewPub.replace(/^0x/, "")}` as Hex;
}

export function generateStealthMetaAddressFromSeed(privateKeyHex: Hex): {
  metaAddress: Hex;
  spendPub: Hex;
  viewPub: Hex;
  viewPriv: Hex;
} {
  const curveN = secp256k1.Point.CURVE().n;
  const spendPriv = BigInt(privateKeyHex) % curveN;
  const spendPoint = secp256k1.Point.BASE.multiply(spendPriv);
  const spendPub = `0x${spendPoint.toHex(true)}` as Hex;

  // Deterministically derive viewing private key by hashing spend private key with domain tag
  const viewPrivHash = keccak256(new TextEncoder().encode(`privatum:viewing-key:${privateKeyHex}`));
  const viewPriv = BigInt(viewPrivHash) % curveN;
  const viewPoint = secp256k1.Point.BASE.multiply(viewPriv);
  const viewPub = `0x${viewPoint.toHex(true)}` as Hex;

  const metaAddress = encodeMetaAddress(spendPub, viewPub);

  return {
    metaAddress,
    spendPub,
    viewPub,
    viewPriv: `0x${viewPriv.toString(16).padStart(64, "0")}` as Hex,
  };
}

export function computeStealthAddress(meta: StealthMetaAddress): StealthResult {
  const curveN = secp256k1.Point.CURVE().n;
  const r = secp256k1.utils.randomSecretKey();
  const rBig = BigInt(bytesToHex(r));

  const R = secp256k1.Point.BASE.multiply(rBig);

  const V = secp256k1.Point.fromHex(meta.viewPub.replace(/^0x/, ""));
  const S = V.multiply(rBig);

  const Sx = S.x;
  const SxBytes = numberToBytes32(Sx);

  const h = keccak256(bytesToHex(SxBytes));
  const hBig = BigInt(h) % curveN;

  const P = secp256k1.Point.fromHex(meta.spendPub.replace(/^0x/, ""));
  const hG = secp256k1.Point.BASE.multiply(hBig);
  const Pstealth = P.add(hG);

  const stealthAddress = publicKeyToAddress(`0x${Pstealth.toHex(false)}`) as Address;
  const ephemeralPubKey = `0x${R.toHex(true)}` as Hex;
  const viewTag = parseInt(h.slice(2, 4), 16);

  return { stealthAddress, ephemeralPubKey, viewTag };
}

export function checkAnnouncement(
  ann: { ephemeralPubKey: Hex; stealthAddress: Address; viewTag: number },
  viewPrivKey: Hex,
  spendPub: Hex
): boolean {
  try {
    const curveN = secp256k1.Point.CURVE().n;
    const R = secp256k1.Point.fromHex(ann.ephemeralPubKey.replace(/^0x/, ""));
    const S = R.multiply(BigInt(viewPrivKey));
    const SxBytes = numberToBytes32(S.x);
    const h = keccak256(bytesToHex(SxBytes));

    if (parseInt(h.slice(2, 4), 16) !== ann.viewTag) return false;

    const hBig = BigInt(h) % curveN;
    const P = secp256k1.Point.fromHex(spendPub.replace(/^0x/, ""));
    const stealthPub = P.add(secp256k1.Point.BASE.multiply(hBig));
    const derived = publicKeyToAddress(`0x${stealthPub.toHex(false)}`);

    return derived.toLowerCase() === ann.stealthAddress.toLowerCase();
  } catch {
    return false;
  }
}

export function buildStealthSendBatch(params: {
  recipientMetaAddress: string;
  amount: bigint;
  tokenAddress?: Address;
  isEth: boolean;
}): {
  targets: Address[];
  values: bigint[];
  datas: Hex[];
  stealthAddress: Address;
  ephemeralPubKey: Hex;
  viewTag: number;
} {
  const meta = parseMetaAddress(params.recipientMetaAddress);
  const { stealthAddress, ephemeralPubKey, viewTag } = computeStealthAddress(meta);

  const transferTarget = params.isEth ? stealthAddress : params.tokenAddress!;
  const transferValue = params.isEth ? params.amount : 0n;
  const transferCalldata = params.isEth
    ? ("0x" as Hex)
    : encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [stealthAddress, params.amount],
      });

  const viewTagHex = `0x${viewTag.toString(16).padStart(2, "0")}` as Hex;
  const announceCalldata = encodeFunctionData({
    abi: ANNOUNCER_ABI,
    functionName: "announce",
    args: [0n, stealthAddress, ephemeralPubKey, viewTagHex],
  });

  return {
    targets: [transferTarget, ERC5564_ANNOUNCER],
    values: [transferValue, 0n],
    datas: [transferCalldata, announceCalldata],
    stealthAddress,
    ephemeralPubKey,
    viewTag,
  };
}

export function computeStealthPrivateKey(
  ephemeralPubKey: Hex,
  viewPrivKey: Hex,
  spendPrivKeyHex: Hex
): Hex {
  const curveN = secp256k1.Point.CURVE().n;
  const R = secp256k1.Point.fromHex(ephemeralPubKey.replace(/^0x/, ""));
  const S = R.multiply(BigInt(viewPrivKey));
  const SxBytes = numberToBytes32(S.x);
  const h = keccak256(bytesToHex(SxBytes));
  const hBig = BigInt(h) % curveN;
  const spendPriv = BigInt(spendPrivKeyHex) % curveN;
  const stealthPrivBig = (spendPriv + hBig) % curveN;
  return `0x${stealthPrivBig.toString(16).padStart(64, "0")}` as Hex;
}

export async function sweepStealthFunds(params: {
  stealthAddress: Address;
  ephemeralPubKey: Hex;
  viewPrivKey: Hex;
  spendPrivKeyHex: Hex;
  destinationAddress: Address;
  client: PublicClient;
  tokenAddress?: Address;
}): Promise<{ txHash: Hex; asset: "ETH" | "USDG"; amount: string }> {
  const {
    stealthAddress,
    ephemeralPubKey,
    viewPrivKey,
    spendPrivKeyHex,
    destinationAddress,
    client,
    tokenAddress,
  } = params;

  const stealthPrivKey = computeStealthPrivateKey(
    ephemeralPubKey,
    viewPrivKey,
    spendPrivKeyHex
  );
  const stealthAccount = privateKeyToAccount(stealthPrivKey);

  const walletClient = createWalletClient({
    account: stealthAccount,
    chain: robinhoodChain,
    transport: http(),
  });

  const ethBalance = await client.getBalance({ address: stealthAddress });

  let tokenBalance = 0n;
  if (tokenAddress) {
    try {
      tokenBalance = await client.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [stealthAddress],
      });
    } catch {
      tokenBalance = 0n;
    }
  }

  // Sweep USDG if available and enough ETH for gas
  if (tokenAddress && tokenBalance > 0n && ethBalance >= 45000n * 1500000000n) {
    const txHash = await walletClient.writeContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [destinationAddress, tokenBalance],
    });
    return {
      txHash,
      asset: "USDG",
      amount: (Number(tokenBalance) / 1e6).toFixed(2),
    };
  }

  // Sweep native ETH
  const gasPrice = await client.getGasPrice().catch(() => 1500000000n);
  const gasCost = 21000n * gasPrice;
  if (ethBalance <= gasCost) {
    throw new Error(
      `Stealth address balance (${(Number(ethBalance) / 1e18).toFixed(6)} ETH) is insufficient to cover the network fee.`
    );
  }

  const sendValue = ethBalance - gasCost;
  const txHash = await walletClient.sendTransaction({
    to: destinationAddress,
    value: sendValue,
  });

  return {
    txHash,
    asset: "ETH",
    amount: (Number(sendValue) / 1e18).toFixed(4),
  };
}
