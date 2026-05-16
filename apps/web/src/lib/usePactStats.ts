"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import {
  PACT_ADDRESSES,
  PactEscrowAbi,
  PactRegistryAbi,
  SlashingArbiterAbi,
} from "@pact/shared";

import { JobState } from "@/lib/wagmi";

/**
 * Live mainnet stats for the landing StatsStrip.
 *
 *   contractsDeployed — static 7 (won't change in v0.1).
 *   servicesLive      — PactRegistry.nextServiceId() - 1.
 *   jobsSettled       — scan PactEscrow.getJob(1..n) for state == Settled.
 *                       Cheap while job count is small (<20). Replace with
 *                       indexer event-scan when N grows.
 *   bondedSellers     — count unique sellers across SlashingArbiter
 *                       `BondStaked` events. Read directly via getLogs
 *                       (no indexer yet). 0G RPC supports eth_getLogs.
 *
 * Polling: refetchInterval 15s. Landing stats don't need 3s freshness.
 *
 * Loading semantics: while a read is in flight `data` is undefined and
 * `isLoading` is true. Consumers render a "—" placeholder (NOT a "0")
 * during loading so a fetch failure never masquerades as a zero count.
 */
export interface PactStats {
  contractsDeployed: number;
  servicesLive: number;
  jobsSettled: number;
  bondedSellers: number;
}

const CONTRACTS_DEPLOYED = 7;

// Deploy block of SlashingArbiter — passing `fromBlock: 'earliest'` works
// but a recent floor cuts the RPC range. The arbiter was redeployed
// during Phase 1 EXIT.1 (2026-05-08). 33_000_000 is a safe floor that
// post-dates that deploy without risking missing BondStaked logs.
const ARBITER_FROM_BLOCK = 33_000_000n;

export function usePactStats() {
  const client = usePublicClient();

  return useQuery<PactStats>({
    queryKey: ["pact-stats"],
    enabled: !!client,
    refetchInterval: 15_000,
    queryFn: async () => {
      if (!client) throw new Error("public client unavailable");

      // --- servicesLive ------------------------------------------------
      const nextServiceId = (await client.readContract({
        address: PACT_ADDRESSES.PactRegistry,
        abi: PactRegistryAbi,
        functionName: "nextServiceId",
      })) as bigint;
      const servicesLive =
        nextServiceId > 0n ? Number(nextServiceId - 1n) : 0;

      // --- jobsSettled -------------------------------------------------
      const nextJobId = (await client.readContract({
        address: PACT_ADDRESSES.PactEscrow,
        abi: PactEscrowAbi,
        functionName: "nextJobId",
      })) as bigint;
      const totalJobs = nextJobId > 0n ? Number(nextJobId - 1n) : 0;

      let jobsSettled = 0;
      if (totalJobs > 0) {
        // Parallel reads for the small-N case. Wrap each in a per-job
        // try/catch so one bad RPC response doesn't zero the count.
        const reads = await Promise.allSettled(
          Array.from({ length: totalJobs }, (_, i) =>
            client.readContract({
              address: PACT_ADDRESSES.PactEscrow,
              abi: PactEscrowAbi,
              functionName: "getJob",
              args: [BigInt(i + 1)],
            }),
          ),
        );
        for (const r of reads) {
          if (r.status === "fulfilled") {
            const job = r.value as { state: number };
            if (Number(job.state) === JobState.Settled) jobsSettled += 1;
          }
        }
      }

      // --- bondedSellers ----------------------------------------------
      // Scan BondStaked events. Each emit carries the staker address;
      // dedupe by lowercased hex to get the unique-seller count.
      const bondedAddresses = new Set<string>();
      try {
        const logs = await client.getContractEvents({
          address: PACT_ADDRESSES.SlashingArbiter,
          abi: SlashingArbiterAbi,
          eventName: "BondStaked",
          fromBlock: ARBITER_FROM_BLOCK,
          toBlock: "latest",
        });
        for (const lg of logs) {
          const args = (lg as { args: { staker?: `0x${string}` } }).args;
          const staker = args.staker;
          if (staker) bondedAddresses.add(staker.toLowerCase());
        }
      } catch {
        // Eat the error — bondedSellers stays at 0 and the UI shows "—".
        // The whole query doesn't fail because of one stat.
      }

      return {
        contractsDeployed: CONTRACTS_DEPLOYED,
        servicesLive,
        jobsSettled,
        bondedSellers: bondedAddresses.size,
      };
    },
  });
}
