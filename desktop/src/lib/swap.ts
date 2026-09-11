import {
  encodeFunctionData,
  parseAbi,
  parseUnits,
  formatUnits,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { type TokenInfo, WETH_ADDRESS, USDG_ADDRESS } from "./tokens";

export const V3_QUOTER_ADDRESS: Address = "0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7";
export const V3_SWAP_ROUTER_ADDRESS: Address = "0xcaf681a66d020601342297493863e78c959e5cb2";
export const V4_QUOTER_ADDRESS: Address = "0x8dc178efb8111bb0973dd9d722ebeff267c98f94";
export const V4_UNIVERSAL_ROUTER: Address = "0x8876789976decbfcbbbe364623c63652db8c0904";

const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

const V3_QUOTER_ABI = parseAbi([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

const V3_SWAP_ROUTER_ABI = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)",
]);

export interface SwapQuoteResult {
  amountOut: string;
  amountOutRaw: bigint;
  feeTier: number;
  protocol: "v4" | "v3";
  estimatedGas: bigint;
  rate: number;
}

const FEE_TIERS = [500, 3000, 10000, 100]; // 0.05%, 0.3%, 1.0%, 0.01%

export async function getBestSwapQuote(
  client: PublicClient,
  tokenIn: TokenInfo,
  tokenOut: TokenInfo,
  amountInFormatted: string
): Promise<SwapQuoteResult | null> {
  if (
    !amountInFormatted ||
    parseFloat(amountInFormatted) <= 0 ||
    tokenIn.address === tokenOut.address
  ) {
    return null;
  }

  const amountInWei = parseUnits(amountInFormatted, tokenIn.decimals);
  const actualTokenIn = tokenIn.native ? WETH_ADDRESS : tokenIn.address;
  const actualTokenOut = tokenOut.native ? WETH_ADDRESS : tokenOut.address;

  let bestQuote: SwapQuoteResult | null = null;

  // Query Uniswap pool across fee tiers
  for (const fee of FEE_TIERS) {
    try {
      const result = await client.simulateContract({
        address: V3_QUOTER_ADDRESS,
        abi: V3_QUOTER_ABI,
        functionName: "quoteExactInputSingle",
        args: [
          {
            tokenIn: actualTokenIn,
            tokenOut: actualTokenOut,
            amountIn: amountInWei,
            fee,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });

      const amountOutRaw = result.result[0];
      if (!bestQuote || amountOutRaw > bestQuote.amountOutRaw) {
        const outFormatted = formatUnits(amountOutRaw, tokenOut.decimals);
        const rate = parseFloat(outFormatted) / parseFloat(amountInFormatted);

        bestQuote = {
          amountOut: outFormatted,
          amountOutRaw,
          feeTier: fee,
          protocol: fee === 100 || fee === 500 ? "v4" : "v3",
          estimatedGas: result.result[3] || 150000n,
          rate,
        };
      }
    } catch {
      // Continue searching other fee tiers
    }
  }

  return bestQuote;
}

export function buildSwapBatchCalls(params: {
  accountAddress: Address;
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  amountIn: bigint;
  minAmountOut: bigint;
  feeTier: number;
}): {
  targets: Address[];
  values: bigint[];
  datas: Hex[];
} {
  const actualTokenIn = params.tokenIn.native ? WETH_ADDRESS : params.tokenIn.address;
  const actualTokenOut = params.tokenOut.native ? WETH_ADDRESS : params.tokenOut.address;

  const targets: Address[] = [];
  const values: bigint[] = [];
  const datas: Hex[] = [];

  // Step 1: Approve router if tokenIn is ERC20
  if (!params.tokenIn.native) {
    targets.push(actualTokenIn);
    values.push(0n);
    datas.push(
      encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "approve",
        args: [V3_SWAP_ROUTER_ADDRESS, params.amountIn],
      })
    );
  }

  // Step 2: Exact Input Single on SwapRouter02
  targets.push(V3_SWAP_ROUTER_ADDRESS);
  values.push(params.tokenIn.native ? params.amountIn : 0n);
  datas.push(
    encodeFunctionData({
      abi: V3_SWAP_ROUTER_ABI,
      functionName: "exactInputSingle",
      args: [
        {
          tokenIn: actualTokenIn,
          tokenOut: actualTokenOut,
          fee: params.feeTier,
          recipient: params.accountAddress,
          amountIn: params.amountIn,
          amountOutMinimum: params.minAmountOut,
          sqrtPriceLimitX96: 0n,
        },
      ],
    })
  );

  return { targets, values, datas };
}
