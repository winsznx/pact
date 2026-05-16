"use client";

import { useQuery } from "@tanstack/react-query";
import { type Hex, formatEther } from "viem";
import { usePublicClient } from "wagmi";
import {
  AgentNFTAbi,
  PACT_ADDRESSES,
  PactEscrowAbi,
  PactRegistryAbi,
  ReputationVaultAbi,
  SlashingArbiterAbi,
} from "@pact/shared";

/**
 * Combined activity feed for /explore. Fetches recent events from all
 * four contracts in parallel, normalises them to a single entry shape,
 * sorts by (blockNumber DESC, logIndex DESC), and returns the top 20
 * with block timestamps resolved via batched getBlock.
 *
 * Refetch interval is configurable via NEXT_PUBLIC_ACTIVITY_REFETCH_MS;
 * defaults to 10s. Production deploys may want 30s to be polite to the
 * RPC.
 *
 * fromBlock = 30_000_000n is the post-deploy floor. The Phase 1 EXIT.1
 * deploys (PactRegistry, PactEscrow proxy, ReputationVault, etc.) all
 * broadcast above block 32.4M (2026-05-08 smoke test) and the Phase 4
 * setup tx is at block 33.28M (2026-05-15). 30M gives margin without
 * blowing past 0G RPC's range tolerance (~5M blocks per request is fine).
 *
 * Block timestamps: viem's getContractEvents return shape doesn't include
 * block timestamps, so we batch getBlock calls on the unique block
 * numbers across the merged event set. Result is cached by react-query.
 */
const DEPLOY_BLOCK = 30_000_000n;
const FEED_LIMIT = 20;

export type ActivityType =
  | "ATTESTATION_VERIFIED"
  | "JOB_CREATED"
  | "BOND_STAKED"
  | "SERVICE_REGISTERED"
  | "INFT_MINTED"
  | "REPUTATION_INCREMENT"
  | "SLASH_EXECUTED"
  | "JOB_RECLAIMED";

export interface ActivityEntry {
  id: string;
  type: ActivityType;
  txHash: Hex;
  blockNumber: bigint;
  logIndex: number;
  timestamp: number; // seconds since epoch
  primaryText: string;
  navHref: string;
  chainscanHref: string;
}

export interface ProtocolActivity {
  entries: ActivityEntry[];
  /** Sum of paidToSeller across all JobSettled events, in wei. */
  totalSettledWei: bigint;
  /** Count of JobAttested events. Equals jobs settled in v0.1 — every
   *  attestation that lands triggers atomic settlement. */
  signaturesRecovered: number;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

function refetchMs(): number {
  const raw = process.env.NEXT_PUBLIC_ACTIVITY_REFETCH_MS;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 10_000;
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function chainscanTx(hash: string): string {
  return `https://chainscan.0g.ai/tx/${hash}`;
}

export function useProtocolActivity() {
  const client = usePublicClient();

  return useQuery<ProtocolActivity>({
    queryKey: ["protocol-activity"],
    enabled: !!client,
    refetchInterval: refetchMs(),
    queryFn: async () => {
      if (!client) throw new Error("public client unavailable");

      const fromBlock = DEPLOY_BLOCK;

      // Fan out: parallel getContractEvents on all relevant sources.
      // Each is wrapped in allSettled so one bad source doesn't void
      // the whole feed.
      const results = await Promise.allSettled([
        client.getContractEvents({
          address: PACT_ADDRESSES.PactRegistry,
          abi: PactRegistryAbi,
          eventName: "ServiceRegistered",
          fromBlock,
        }),
        client.getContractEvents({
          address: PACT_ADDRESSES.PactEscrow,
          abi: PactEscrowAbi,
          eventName: "JobCreated",
          fromBlock,
        }),
        client.getContractEvents({
          address: PACT_ADDRESSES.PactEscrow,
          abi: PactEscrowAbi,
          eventName: "JobAttested",
          fromBlock,
        }),
        client.getContractEvents({
          address: PACT_ADDRESSES.PactEscrow,
          abi: PactEscrowAbi,
          eventName: "JobSettled",
          fromBlock,
        }),
        client.getContractEvents({
          address: PACT_ADDRESSES.PactEscrow,
          abi: PactEscrowAbi,
          eventName: "JobExpired",
          fromBlock,
        }),
        client.getContractEvents({
          address: PACT_ADDRESSES.SlashingArbiter,
          abi: SlashingArbiterAbi,
          eventName: "BondStaked",
          fromBlock,
        }),
        client.getContractEvents({
          address: PACT_ADDRESSES.SlashingArbiter,
          abi: SlashingArbiterAbi,
          eventName: "Slashed",
          fromBlock,
        }),
        client.getContractEvents({
          address: PACT_ADDRESSES.ReputationVault,
          abi: ReputationVaultAbi,
          eventName: "ReputationIncremented",
          fromBlock,
        }),
        client.getContractEvents({
          address: PACT_ADDRESSES.AgentNFT_proxy,
          abi: AgentNFTAbi,
          eventName: "Transfer",
          fromBlock,
          // viem's filter args narrow the indexed-topic match. `from`
          // must be zero address to identify mints.
          args: { from: ZERO_ADDRESS },
        }),
      ]);

      const ok = <T,>(r: PromiseSettledResult<T>, fallback: T): T =>
        r.status === "fulfilled" ? r.value : fallback;

      type RawLog = {
        transactionHash: Hex | null;
        blockNumber: bigint | null;
        logIndex: number | null;
        args: Record<string, unknown>;
      };
      const serviceRegistered = ok(results[0], []) as RawLog[];
      const jobCreated = ok(results[1], []) as RawLog[];
      const jobAttested = ok(results[2], []) as RawLog[];
      const jobSettled = ok(results[3], []) as RawLog[];
      const jobExpired = ok(results[4], []) as RawLog[];
      const bondStaked = ok(results[5], []) as RawLog[];
      const slashed = ok(results[6], []) as RawLog[];
      const reputation = ok(results[7], []) as RawLog[];
      const inftMints = ok(results[8], []) as RawLog[];

      // Build the merged entry list (no timestamps yet).
      const entries: Omit<ActivityEntry, "timestamp">[] = [];

      for (const lg of serviceRegistered) {
        if (!lg.transactionHash || lg.blockNumber === null || lg.logIndex === null) continue;
        const a = lg.args as { serviceId: bigint; seller: `0x${string}`; signingAddress: `0x${string}` };
        entries.push({
          id: `${lg.transactionHash}:${lg.logIndex}`,
          type: "SERVICE_REGISTERED",
          txHash: lg.transactionHash,
          blockNumber: lg.blockNumber,
          logIndex: lg.logIndex,
          primaryText: `Service #${a.serviceId.toString()} registered. Signing key ${shortAddr(a.signingAddress)}. Seller ${shortAddr(a.seller)}.`,
          navHref: `/marketplace/${a.serviceId.toString()}`,
          chainscanHref: chainscanTx(lg.transactionHash),
        });
      }

      for (const lg of jobCreated) {
        if (!lg.transactionHash || lg.blockNumber === null || lg.logIndex === null) continue;
        const a = lg.args as { jobId: bigint; serviceId: bigint; buyer: `0x${string}`; amount: bigint };
        entries.push({
          id: `${lg.transactionHash}:${lg.logIndex}`,
          type: "JOB_CREATED",
          txHash: lg.transactionHash,
          blockNumber: lg.blockNumber,
          logIndex: lg.logIndex,
          primaryText: `Buyer ${shortAddr(a.buyer)} escrowed ${formatEther(a.amount)} $0G to Service #${a.serviceId.toString()} for Job #${a.jobId.toString()}.`,
          navHref: `/jobs/${a.jobId.toString()}`,
          chainscanHref: chainscanTx(lg.transactionHash),
        });
      }

      for (const lg of jobAttested) {
        if (!lg.transactionHash || lg.blockNumber === null || lg.logIndex === null) continue;
        const a = lg.args as { jobId: bigint; recoveredSigner: `0x${string}` };
        entries.push({
          id: `${lg.transactionHash}:${lg.logIndex}`,
          type: "ATTESTATION_VERIFIED",
          txHash: lg.transactionHash,
          blockNumber: lg.blockNumber,
          logIndex: lg.logIndex,
          primaryText: `Attestation for Job #${a.jobId.toString()} verified on-chain. Recovered signer ${shortAddr(a.recoveredSigner)} ✓`,
          navHref: `/jobs/${a.jobId.toString()}`,
          chainscanHref: chainscanTx(lg.transactionHash),
        });
      }

      for (const lg of jobExpired) {
        if (!lg.transactionHash || lg.blockNumber === null || lg.logIndex === null) continue;
        const a = lg.args as { jobId: bigint; buyer: `0x${string}`; amount: bigint };
        entries.push({
          id: `${lg.transactionHash}:${lg.logIndex}`,
          type: "JOB_RECLAIMED",
          txHash: lg.transactionHash,
          blockNumber: lg.blockNumber,
          logIndex: lg.logIndex,
          primaryText: `Job #${a.jobId.toString()} expired. Buyer reclaimed ${formatEther(a.amount)} $0G.`,
          navHref: `/jobs/${a.jobId.toString()}`,
          chainscanHref: chainscanTx(lg.transactionHash),
        });
      }

      for (const lg of bondStaked) {
        if (!lg.transactionHash || lg.blockNumber === null || lg.logIndex === null) continue;
        const a = lg.args as { serviceId: bigint; staker: `0x${string}`; newTotal: bigint };
        entries.push({
          id: `${lg.transactionHash}:${lg.logIndex}`,
          type: "BOND_STAKED",
          txHash: lg.transactionHash,
          blockNumber: lg.blockNumber,
          logIndex: lg.logIndex,
          primaryText: `${shortAddr(a.staker)} staked ${formatEther(a.newTotal)} $0G on Service #${a.serviceId.toString()}. Eligible to serve jobs.`,
          navHref: `/marketplace/${a.serviceId.toString()}`,
          chainscanHref: chainscanTx(lg.transactionHash),
        });
      }

      for (const lg of slashed) {
        if (!lg.transactionHash || lg.blockNumber === null || lg.logIndex === null) continue;
        const a = lg.args as { jobId: bigint; sellerBondSlashed: bigint };
        entries.push({
          id: `${lg.transactionHash}:${lg.logIndex}`,
          type: "SLASH_EXECUTED",
          txHash: lg.transactionHash,
          blockNumber: lg.blockNumber,
          logIndex: lg.logIndex,
          primaryText: `Service slashed for Job #${a.jobId.toString()}. ${formatEther(a.sellerBondSlashed)} $0G bond redistributed. Reason: signer mismatch.`,
          navHref: `/jobs/${a.jobId.toString()}`,
          chainscanHref: chainscanTx(lg.transactionHash),
        });
      }

      for (const lg of reputation) {
        if (!lg.transactionHash || lg.blockNumber === null || lg.logIndex === null) continue;
        const a = lg.args as { serviceId: bigint; jobAmount: bigint };
        entries.push({
          id: `${lg.transactionHash}:${lg.logIndex}`,
          type: "REPUTATION_INCREMENT",
          txHash: lg.transactionHash,
          blockNumber: lg.blockNumber,
          logIndex: lg.logIndex,
          primaryText: `Service #${a.serviceId.toString()} reputation incremented from ${formatEther(a.jobAmount)} $0G settled job.`,
          navHref: `/marketplace/${a.serviceId.toString()}`,
          chainscanHref: chainscanTx(lg.transactionHash),
        });
      }

      for (const lg of inftMints) {
        if (!lg.transactionHash || lg.blockNumber === null || lg.logIndex === null) continue;
        const a = lg.args as { tokenId: bigint; to: `0x${string}` };
        entries.push({
          id: `${lg.transactionHash}:${lg.logIndex}`,
          type: "INFT_MINTED",
          txHash: lg.transactionHash,
          blockNumber: lg.blockNumber,
          logIndex: lg.logIndex,
          primaryText: `Agent INFT #${a.tokenId.toString()} minted to ${shortAddr(a.to)}. Reputation starts at 0.`,
          navHref: `/marketplace/1`,
          chainscanHref: chainscanTx(lg.transactionHash),
        });
      }

      // Sort newest first.
      entries.sort((a, b) => {
        if (a.blockNumber !== b.blockNumber) {
          return a.blockNumber > b.blockNumber ? -1 : 1;
        }
        return b.logIndex - a.logIndex;
      });

      const top = entries.slice(0, FEED_LIMIT);

      // Resolve unique block timestamps in parallel.
      const uniqueBlocks = Array.from(
        new Set(top.map((e) => e.blockNumber.toString())),
      );
      const blockTs = new Map<string, number>();
      await Promise.allSettled(
        uniqueBlocks.map(async (bn) => {
          const block = await client.getBlock({ blockNumber: BigInt(bn) });
          blockTs.set(bn, Number(block.timestamp));
        }),
      );

      const entriesWithTs: ActivityEntry[] = top.map((e) => ({
        ...e,
        timestamp: blockTs.get(e.blockNumber.toString()) ?? 0,
      }));

      // Stats derived from the full event set (not the top-20 slice).
      let totalSettledWei = 0n;
      for (const lg of jobSettled) {
        const a = lg.args as { paidToSeller?: bigint };
        if (typeof a.paidToSeller === "bigint") {
          totalSettledWei += a.paidToSeller;
        }
      }
      const signaturesRecovered = jobAttested.length;

      return {
        entries: entriesWithTs,
        totalSettledWei,
        signaturesRecovered,
      };
    },
  });
}
