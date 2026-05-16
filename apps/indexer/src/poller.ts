import { type AbiEvent, type Hash, getAbiItem } from "viem";
import {
  PACT_ADDRESSES,
  PactEscrowAbi,
  PactRegistryAbi,
  type Job,
} from "@trypact/sdk";

import { publicClient } from "./chain.js";
import { store, upsertJob, upsertService } from "./store.js";

/**
 * v0.1 indexer:
 *   - On startup: scan from DEPLOY_BLOCK → head for ServiceRegistered
 *     and JobCreated; hydrate each via `getService` / `getJob` (one
 *     round-trip per record). Pull current state for every job rather
 *     than reconstruct from event sequence.
 *   - Every POLL_INTERVAL_MS afterwards: scan lastBlock+1 → head for the
 *     same events, plus all subsequent state-change events
 *     (JobSettled / JobExpired / JobDisputed / JobSlashed) — refresh the
 *     touched jobs.
 *
 * For hackathon-scale traffic (~5 services, ~30 jobs total) this is
 * trivially under a second per scan. At >1000 events we'd batch by
 * block range; for now we trust the single getLogs call to be cheap.
 */

const POLL_INTERVAL_MS = parseInt(process.env.PACT_POLL_MS ?? "3000", 10);
const DEPLOY_BLOCK = BigInt(process.env.PACT_DEPLOY_BLOCK ?? "30000000");
/** Cap any single getLogs window. 0G's public RPC limits range; smaller windows are safer. */
const MAX_SCAN_WINDOW = 9_000n;

const SERVICE_REGISTERED = getAbiItem({
  abi: PactRegistryAbi,
  name: "ServiceRegistered",
}) as AbiEvent;

const JOB_CREATED = getAbiItem({
  abi: PactEscrowAbi,
  name: "JobCreated",
}) as AbiEvent;

const JOB_STATE_CHANGE_NAMES = [
  "JobAttested",
  "JobSettled",
  "JobExpired",
  "JobDisputed",
  "JobSlashed",
] as const;

interface LogShape {
  blockNumber: bigint | null;
  transactionHash: Hash | null;
  args: Record<string, unknown> | undefined;
}

async function hydrateService(serviceId: bigint): Promise<void> {
  try {
    const tuple = (await publicClient.readContract({
      address: PACT_ADDRESSES.PactRegistry,
      abi: PactRegistryAbi,
      functionName: "getService",
      args: [serviceId],
    })) as Awaited<ReturnType<typeof publicClient.readContract>>;
    // viem returns the struct as a named-property object when ABI has
    // named components. Re-shape into our Service interface.
    const t = tuple as unknown as {
      inftTokenId: bigint;
      seller: `0x${string}`;
      capabilityHash: Hash;
      modelId: string;
      modelCommitment: Hash;
      providerAddress: `0x${string}`;
      signingAddress: `0x${string}`;
      providerIdentity: string;
      providerType: string;
      targetSeparated: boolean;
      pricePerCall: bigint;
      maxInputBytes: bigint;
      registeredAt: bigint;
      active: boolean;
    };
    upsertService({ ...t, serviceId });
  } catch (err) {
    console.error(`hydrateService(${serviceId}) failed:`, err);
  }
}

async function hydrateJob(jobId: bigint): Promise<void> {
  try {
    const prev = store.jobs.get(jobId);
    const tuple = (await publicClient.readContract({
      address: PACT_ADDRESSES.PactEscrow,
      abi: PactEscrowAbi,
      functionName: "getJob",
      args: [jobId],
    })) as unknown as {
      serviceId: bigint;
      buyer: `0x${string}`;
      seller: `0x${string}`;
      amount: bigint;
      protocolFee: bigint;
      createdAt: bigint;
      timeout: bigint;
      state: number;
      inputCommitment: Hash;
      outputRootHash: Hash;
      chatId: Hash;
      attestationText: `0x${string}`;
      attestationSignature: `0x${string}`;
    };
    const next: Job = {
      jobId,
      serviceId: tuple.serviceId,
      buyer: tuple.buyer,
      seller: tuple.seller,
      amount: tuple.amount,
      protocolFee: tuple.protocolFee,
      createdAt: tuple.createdAt,
      timeout: tuple.timeout,
      state: tuple.state,
      inputCommitment: tuple.inputCommitment,
      outputRootHash: tuple.outputRootHash,
      chatId: tuple.chatId,
      attestationText: tuple.attestationText,
      attestationSignature: tuple.attestationSignature,
    };
    upsertJob(prev, next);
  } catch (err) {
    console.error(`hydrateJob(${jobId}) failed:`, err);
  }
}

/** Iterate getLogs in `MAX_SCAN_WINDOW`-block chunks so a fresh-deploy
 *  scan from DEPLOY_BLOCK doesn't blow past the RPC's range cap. */
async function scanRange(
  fromBlock: bigint,
  toBlock: bigint,
): Promise<{ newServices: Set<bigint>; touchedJobs: Set<bigint> }> {
  const newServices = new Set<bigint>();
  const touchedJobs = new Set<bigint>();
  let cursor = fromBlock;
  while (cursor <= toBlock) {
    const to = cursor + MAX_SCAN_WINDOW > toBlock ? toBlock : cursor + MAX_SCAN_WINDOW;

    // Registry — ServiceRegistered
    const regLogs = (await publicClient.getLogs({
      address: PACT_ADDRESSES.PactRegistry,
      event: SERVICE_REGISTERED,
      fromBlock: cursor,
      toBlock: to,
    })) as unknown as LogShape[];
    for (const lg of regLogs) {
      const id = (lg.args as { serviceId?: bigint } | undefined)?.serviceId;
      if (id !== undefined) newServices.add(id);
    }

    // Escrow — JobCreated + state-change events. Pull all in one getLogs by
    // omitting `event` and letting each event surface via topics[0]; cheaper
    // than 5 separate calls.
    const escrowLogs = (await publicClient.getLogs({
      address: PACT_ADDRESSES.PactEscrow,
      events: [
        JOB_CREATED,
        ...JOB_STATE_CHANGE_NAMES.map(
          (n) => getAbiItem({ abi: PactEscrowAbi, name: n }) as AbiEvent,
        ),
      ],
      fromBlock: cursor,
      toBlock: to,
    })) as unknown as LogShape[];
    for (const lg of escrowLogs) {
      const jobId = (lg.args as { jobId?: bigint } | undefined)?.jobId;
      if (jobId !== undefined) touchedJobs.add(jobId);
    }

    cursor = to + 1n;
  }
  return { newServices, touchedJobs };
}

async function tick(): Promise<void> {
  const head = await publicClient.getBlockNumber();
  const from = store.lastBlock === null ? DEPLOY_BLOCK : store.lastBlock + 1n;
  if (from > head) return;

  const { newServices, touchedJobs } = await scanRange(from, head);

  // Hydrate in parallel (each call is independent). Cap concurrency
  // so we don't fan-out an unbounded number of RPC calls.
  await runWithConcurrency(8, [...newServices], hydrateService);
  await runWithConcurrency(8, [...touchedJobs], hydrateJob);

  store.lastBlock = head;
}

async function runWithConcurrency<T>(
  limit: number,
  items: T[],
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      const item = items[idx];
      if (item === undefined) continue;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

export async function startPoller(): Promise<void> {
  console.log("indexer: initial scan from block", DEPLOY_BLOCK.toString());
  await tick();
  console.log(
    `indexer: initial scan complete — services=${store.services.size} jobs=${store.jobs.size} head=${store.lastBlock?.toString()}`,
  );

  setInterval(() => {
    tick().catch((err) => {
      console.error("indexer tick failed:", err);
    });
  }, POLL_INTERVAL_MS);
}
