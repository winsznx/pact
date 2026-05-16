import { createPublicClient, http, defineChain } from "viem";

/**
 * Single shared viem PublicClient for the indexer's chain reads.
 * The RPC URL is configurable via env; production points at the same
 * primary RPC the frontend uses.
 */
const rpcUrl = process.env.PACT_RPC_URL ?? "https://evmrpc.0g.ai";

export const ogMainnet = defineChain({
  id: 16661,
  name: "0G Mainnet",
  nativeCurrency: { name: "OG", symbol: "OG", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  blockExplorers: {
    default: { name: "0G ChainScan", url: "https://chainscan.0g.ai" },
  },
});

export const publicClient = createPublicClient({
  chain: ogMainnet,
  transport: http(rpcUrl, { batch: true, retryCount: 2, timeout: 10_000 }),
});
