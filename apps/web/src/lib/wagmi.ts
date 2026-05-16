import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";
import { useReadContract } from "wagmi";
import {
  PACT_ADDRESSES,
  PACT_CHAIN_ID,
  PACT_CHAIN_NAME,
  PACT_EXPLORER_URL,
  PACT_RPC_URL_PRIMARY,
  PactEscrowAbi,
  PactRegistryAbi,
  ReputationVaultAbi,
  SlashingArbiterAbi,
} from "@pact/shared";

/// 0G mainnet chain definition. Native currency symbol is "0G" — the chain
/// reports "PathUSD" via some RPC introspection paths but $0G is the canonical
/// public name (per PRD §11).
export const ogMainnet = defineChain({
  id: PACT_CHAIN_ID,
  name: PACT_CHAIN_NAME,
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: {
    default: { http: [PACT_RPC_URL_PRIMARY] },
  },
  blockExplorers: {
    default: { name: "0G ChainScan", url: PACT_EXPLORER_URL },
  },
});

export const wagmiConfig = getDefaultConfig({
  appName: "PACT",
  // RainbowKit 2.2+ HARD-fails on missing projectId (used to just warn).
  // Use `||` not `??` so an empty string from .env.local also falls
  // back. The fallback below is the WalletConnect demo projectId that
  // ships in their official examples — fine for local dev and the
  // hackathon demo recording. Provision a real one for production.
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
    "3a8170812b534d0ff9d794f19a901d64",
  chains: [ogMainnet],
  ssr: true,
});

/**
 * Typed contract objects — wagmi's useReadContract / useWriteContract spread
 * these into the call args, e.g.
 *   useReadContract({ ...pactEscrowContract, functionName: "getJob",
 *                     args: [jobId] })
 * The `as const` ABI exports keep function signatures and event topics
 * statically typed end-to-end.
 */
export const pactEscrowContract = {
  address: PACT_ADDRESSES.PactEscrow,
  abi: PactEscrowAbi,
} as const;

export const pactRegistryContract = {
  address: PACT_ADDRESSES.PactRegistry,
  abi: PactRegistryAbi,
} as const;

export const reputationVaultContract = {
  address: PACT_ADDRESSES.ReputationVault,
  abi: ReputationVaultAbi,
} as const;

export const slashingArbiterContract = {
  address: PACT_ADDRESSES.SlashingArbiter,
  abi: SlashingArbiterAbi,
} as const;

/**
 * Job state enum — must stay in lockstep with IPactEscrow.JobState.
 * The contract stores state as uint8; reads come back as a JS number.
 */
export const JobState = {
  Pending: 0,
  Sealed: 1,
  Attested: 2,
  Settled: 3,
  Expired: 4,
  Disputed: 5,
  Slashed: 6,
} as const;
export type JobStateValue = (typeof JobState)[keyof typeof JobState];

export const JobStateLabel: Record<JobStateValue, string> = {
  [JobState.Pending]: "Pending",
  [JobState.Sealed]: "Sealed",
  [JobState.Attested]: "Attested",
  [JobState.Settled]: "Settled",
  [JobState.Expired]: "Expired",
  [JobState.Disputed]: "Disputed",
  [JobState.Slashed]: "Slashed",
};

/**
 * Read a single job. Polls every 3s — WebSocket subscription is v0.2.
 * Returns wagmi's full `useReadContract` result (data, isLoading, isError,
 * error, refetch). `enabled` short-circuits the query when jobId is 0n
 * so we don't waste an RPC call on an unmounted/loading state.
 */
export function useJob(jobId: bigint) {
  return useReadContract({
    ...pactEscrowContract,
    functionName: "getJob",
    args: [jobId],
    query: {
      enabled: jobId > 0n,
      refetchInterval: 3000,
    },
  });
}

/**
 * Read a single service. Polls every 30s — service metadata is mostly
 * static (only changes on rotateSigningKey or pause).
 */
export function useService(serviceId: bigint) {
  return useReadContract({
    ...pactRegistryContract,
    functionName: "getService",
    args: [serviceId],
    query: {
      enabled: serviceId > 0n,
      refetchInterval: 30_000,
    },
  });
}

/**
 * Read a service's reputation (totalJobs, totalVolume, weightedScore,
 * firstJobAt, lastJobAt). Polls every 15s — reputation only changes on
 * settled jobs.
 */
export function useReputation(serviceId: bigint) {
  return useReadContract({
    ...reputationVaultContract,
    functionName: "getReputation",
    args: [serviceId],
    query: {
      enabled: serviceId > 0n,
      refetchInterval: 15_000,
    },
  });
}

/**
 * Read a service's bond balance from SlashingArbiter. Polls every 30s.
 */
export function useBond(serviceId: bigint) {
  return useReadContract({
    ...slashingArbiterContract,
    functionName: "getBond",
    args: [serviceId],
    query: {
      enabled: serviceId > 0n,
      refetchInterval: 30_000,
    },
  });
}
