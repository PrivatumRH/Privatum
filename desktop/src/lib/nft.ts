import {
  encodeFunctionData,
  parseAbi,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";

export const ERC721_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function safeTransferFrom(address from, address to, uint256 tokenId) external",
]);

export interface NftItem {
  id: string;
  contractAddress: Address;
  collectionName: string;
  tokenId: string;
  title: string;
  description: string;
  imageUrl: string;
  attributes?: { trait_type: string; value: string }[];
}

export function resolveIpfsUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("ipfs://")) {
    return url.replace("ipfs://", "https://ipfs.io/ipfs/");
  }
  return url;
}

export async function fetchNftMetadata(
  client: PublicClient,
  contractAddress: Address,
  tokenId: bigint
): Promise<NftItem | null> {
  try {
    const [name, tokenUri] = await Promise.all([
      client.readContract({
        address: contractAddress,
        abi: ERC721_ABI,
        functionName: "name",
      }).catch(() => "Robinhood Collectible"),
      client.readContract({
        address: contractAddress,
        abi: ERC721_ABI,
        functionName: "tokenURI",
        args: [tokenId],
      }),
    ]);

    const resolvedUri = resolveIpfsUrl(tokenUri);
    let title = `${name} #${tokenId}`;
    let description = "Robinhood Chain Digital Asset";
    let imageUrl = "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=600&auto=format&fit=crop&q=80";

    if (resolvedUri.startsWith("http")) {
      try {
        const res = await fetch(resolvedUri);
        if (res.ok) {
          const meta = await res.json();
          if (meta.name) title = meta.name;
          if (meta.description) description = meta.description;
          if (meta.image) imageUrl = resolveIpfsUrl(meta.image);
        }
      } catch {}
    }

    return {
      id: `${contractAddress}-${tokenId}`,
      contractAddress,
      collectionName: name,
      tokenId: tokenId.toString(),
      title,
      description,
      imageUrl,
    };
  } catch (err) {
    return null;
  }
}

export function buildNftTransferCall(params: {
  contractAddress: Address;
  from: Address;
  to: Address;
  tokenId: bigint;
}): { target: Address; value: bigint; data: Hex } {
  const data = encodeFunctionData({
    abi: ERC721_ABI,
    functionName: "safeTransferFrom",
    args: [params.from, params.to, params.tokenId],
  });

  return {
    target: params.contractAddress,
    value: 0n,
    data,
  };
}
