"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { type Hex } from "viem";
import {
  PACT_ADDRESSES,
  PactEscrowAbi,
  PactRegistryAbi,
  ReputationVaultAbi,
  SlashingArbiterAbi,
} from "@pact/shared";

/**
 * Seller profile aggregator.
 *
 * Strategy:
 *   1. `PactRegistry.getSellerServices(addr)` — clean accessor, returns
 *      uint256[] of serviceIds the seller registered (queried via INFT
 *      ownership). No event scan needed.
 *   2. For each serviceId: parallel `getService`, `getBond`,
 *      `getReputation` reads.
 *   3. Recent jobs: scan `JobSettled` events (paidToSeller field) for
 *      this seller's address. `JobSettled.seller` is indexed → topic
 *      filter is cheap. We also pull `JobCreated` filtered by
 *      `serviceId ∈ services` to capture Pending/Sealed jobs in
 *      flight.
 *   4. Earnings = sum of `paidToSeller` across the seller's
 *      `JobSettled` events. totalBonded = sum of locked bond amounts.
 *      totalReputation = sum of `weightedScore` across services.
 *
 * Polling: 30s. Seller data doesn't churn fast.
 */

const DEPLOY_BLOCK = 30_000_000n;
const SECONDS_PER_DAY = 86_400;
const WITHDRAWAL_DELAY_SECONDS = 7 * SECONDS_PER_DAY;
const MIN_BOND_WEI = 5_000_000_000_000_000_000n; // 5 $0G

export type BondStatus =
  | "locked"
  | "withdrawal_pending"
  | "withdrawable"
  | "withdrawn";

export interface SellerService {
  id: bigint;
  modelId: string;
  signingAddress: `0x${string}`;
  providerAddress: `0x${string}`;
  pricePerCallWei: bigint;
  targetSeparated: boolean;
  registeredAt: number;
  active: boolean;
  inftTokenId: bigint;
}

export interface BondState {
  amountWei: bigint;
  withdrawableAt: number; // 0 when no withdrawal requested
  status: BondStatus;
}

export interface InftState {
  tokenId: bigint;
  weightedScore: bigint;
  totalJobs: bigint;
}

export interface SellerJob {
  jobId: bigint;
  serviceId: bigint;
  buyer: `0x${string}`;
  state: number;
  amountWei: bigint;
  paidToSellerWei: bigint;
  createdAt: number;
  settledAt?: number;
}

export interface SellerProfile {
  isSeller: boolean;
  services: SellerService[];
  bonds: Map<string, BondState>;
  infts: Map<string, InftState>;
  recentJobs: SellerJob[];
  totalEarningsWei: bigint;
  totalBondedWei: bigint;
  totalReputation: bigint;
}

const EMPTY_PROFILE: SellerProfile = {
  isSeller: false,
  services: [],
  bonds: new Map(),
  infts: new Map(),
  recentJobs: [],
  totalEarningsWei: 0n,
  totalBondedWei: 0n,
  totalReputation: 0n,
};

export function useSellerProfile(address: `0x${string}` | undefined) {
  const client = usePublicClient();

  return useQuery<SellerProfile>({
    queryKey: ["seller-profile", address ?? null],
    enabled: !!client && !!address,
    refetchInterval: 30_000,
    queryFn: async () => {
      if (!client || !address) return EMPTY_PROFILE;

      // 1) Owned services via the registry accessor.
      const serviceIds = (await client.readContract({
        address: PACT_ADDRESSES.PactRegistry,
        abi: PactRegistryAbi,
        functionName: "getSellerServices",
        args: [address],
      })) as readonly bigint[];

      if (serviceIds.length === 0) return EMPTY_PROFILE;

      // 2) Per-service reads in parallel: getService + getBond + getReputation
      const perService = await Promise.all(
        serviceIds.map(async (id) => {
          const [svc, bondTuple, rep] = await Promise.all([
            client.readContract({
              address: PACT_ADDRESSES.PactRegistry,
              abi: PactRegistryAbi,
              functionName: "getService",
              args: [id],
            }),
            client.readContract({
              address: PACT_ADDRESSES.SlashingArbiter,
              abi: SlashingArbiterAbi,
              functionName: "getBond",
              args: [id],
            }),
            client.readContract({
              address: PACT_ADDRESSES.ReputationVault,
              abi: ReputationVaultAbi,
              functionName: "getReputation",
              args: [id],
            }),
          ]);
          return {
            id,
            svc: svc as ServiceTuple,
            bondTuple: bondTuple as readonly [bigint, bigint],
            rep: rep as ReputationTuple,
          };
        }),
      );

      const services: SellerService[] = perService.map((r) => ({
        id: r.id,
        modelId: r.svc.modelId,
        signingAddress: r.svc.signingAddress,
        providerAddress: r.svc.providerAddress,
        pricePerCallWei: r.svc.pricePerCall,
        targetSeparated: r.svc.targetSeparated,
        registeredAt: Number(r.svc.registeredAt),
        active: r.svc.active,
        inftTokenId: r.svc.inftTokenId,
      }));

      const bonds = new Map<string, BondState>();
      const infts = new Map<string, InftState>();
      const now = Math.floor(Date.now() / 1000);
      let totalBondedWei = 0n;
      let totalReputation = 0n;

      for (const r of perService) {
        const [amountWei, withdrawableAtBig] = r.bondTuple;
        const withdrawableAt = Number(withdrawableAtBig);

        let status: BondStatus;
        if (amountWei === 0n) {
          status = "withdrawn";
        } else if (withdrawableAt === 0) {
          status = "locked";
        } else if (now < withdrawableAt) {
          status = "withdrawal_pending";
        } else {
          status = "withdrawable";
        }

        bonds.set(r.id.toString(), {
          amountWei,
          withdrawableAt,
          status,
        });
        if (status === "locked" || status === "withdrawal_pending") {
          totalBondedWei += amountWei;
        }

        infts.set(r.id.toString(), {
          tokenId: r.svc.inftTokenId,
          weightedScore: r.rep.weightedScore,
          totalJobs: r.rep.totalJobs,
        });
        totalReputation += r.rep.weightedScore;
      }

      // 3) Recent jobs — three event-fetch stages, each in its own
      // try/catch so a single bad source doesn't void the others.
      const recentJobs: SellerJob[] = [];
      let totalEarningsWei = 0n;
      const jobIds = new Set<bigint>();

      try {
        const settledLogs = await client.getContractEvents({
          address: PACT_ADDRESSES.PactEscrow,
          abi: PactEscrowAbi,
          eventName: "JobSettled",
          fromBlock: DEPLOY_BLOCK,
          args: { seller: address },
        });
        for (const lg of settledLogs) {
          const a = lg.args as { jobId?: bigint; paidToSeller?: bigint };
          if (typeof a.paidToSeller === "bigint") {
            totalEarningsWei += a.paidToSeller;
          }
          if (typeof a.jobId === "bigint") jobIds.add(a.jobId);
        }
      } catch {
        /* totalEarningsWei stays at 0; jobIds may still get filled below */
      }

      try {
        // Also include Pending/Sealed: scan JobCreated by serviceId.
        const createdScans = await Promise.allSettled(
          serviceIds.map((sid) =>
            client.getContractEvents({
              address: PACT_ADDRESSES.PactEscrow,
              abi: PactEscrowAbi,
              eventName: "JobCreated",
              fromBlock: DEPLOY_BLOCK,
              args: { serviceId: sid },
            }),
          ),
        );
        for (const r of createdScans) {
          if (r.status !== "fulfilled") continue;
          for (const lg of r.value) {
            const a = lg.args as { jobId?: bigint };
            if (typeof a.jobId === "bigint") jobIds.add(a.jobId);
          }
        }
      } catch {
        /* recentJobs may end up empty; OK */
      }

      try {
        const settledResults = await Promise.allSettled(
          Array.from(jobIds).map(async (jid) => {
            const job = (await client.readContract({
              address: PACT_ADDRESSES.PactEscrow,
              abi: PactEscrowAbi,
              functionName: "getJob",
              args: [jid],
            })) as JobTuple;
            const state = Number(job.state);
            const paidToSeller =
              state === 3 // Settled
                ? BigInt(job.amount) - BigInt(job.protocolFee)
                : 0n;
            return {
              jobId: jid,
              serviceId: job.serviceId,
              buyer: job.buyer,
              state,
              amountWei: BigInt(job.amount),
              paidToSellerWei: paidToSeller,
              createdAt: Number(job.createdAt),
            } satisfies SellerJob;
          }),
        );
        const jobs = settledResults
          .filter((r): r is PromiseFulfilledResult<SellerJob> => r.status === "fulfilled")
          .map((r) => r.value);
        jobs.sort((a, b) => b.createdAt - a.createdAt);
        recentJobs.push(...jobs.slice(0, 10));
      } catch {
        /* swallow */
      }

      return {
        isSeller: services.length > 0,
        services,
        bonds,
        infts,
        recentJobs,
        totalEarningsWei,
        totalBondedWei,
        totalReputation,
      };
    },
  });
}

/* Minimal contract-output type aliases for readability. */
interface ServiceTuple {
  inftTokenId: bigint;
  seller: `0x${string}`;
  capabilityHash: Hex;
  modelId: string;
  modelCommitment: Hex;
  providerAddress: `0x${string}`;
  signingAddress: `0x${string}`;
  providerIdentity: string;
  providerType: string;
  targetSeparated: boolean;
  pricePerCall: bigint;
  maxInputBytes: bigint;
  registeredAt: bigint;
  active: boolean;
}

interface ReputationTuple {
  totalJobs: bigint;
  totalVolume: bigint;
  weightedScore: bigint;
  firstJobAt: bigint;
  lastJobAt: bigint;
}

interface JobTuple {
  serviceId: bigint;
  buyer: `0x${string}`;
  seller: `0x${string}`;
  amount: bigint;
  protocolFee: bigint;
  createdAt: bigint;
  timeout: bigint;
  state: number;
  inputCommitment: Hex;
  outputRootHash: Hex;
  chatId: Hex;
  attestationText: Hex;
  attestationSignature: Hex;
}

export const SELLER_CONSTANTS = {
  MIN_BOND_WEI,
  WITHDRAWAL_DELAY_SECONDS,
} as const;
