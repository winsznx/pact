import {
  decodeEventLog,
  keccak256,
  stringToHex,
  type Hex as ViemHex,
  type PublicClient,
  type WalletClient,
} from "viem";

import { PACT_ADDRESSES } from "./addresses.js";
import { PactEscrowAbi } from "./abis.js";
import type {
  Address,
  Hash,
  Hex,
  Job,
  Service,
} from "./types.js";
import { JobState, isTerminalState } from "./types.js";

/**
 * Default poll cadence for `watch()` / `run()`. 3s matches the seller
 * agent's loop in apps/seller-reference and feels live in a UI without
 * over-hammering the RPC.
 */
const DEFAULT_POLL_MS = 3_000;

/** Default job timeout: 5 minutes. Buyer can override per-call. */
const DEFAULT_TIMEOUT_SEC = 5 * 60;

/** PactEscrow.getJob output tuple, before we widen `state` to the enum. */
interface JobTuple {
  serviceId: bigint;
  buyer: Address;
  seller: Address;
  amount: bigint;
  protocolFee: bigint;
  createdAt: bigint;
  timeout: bigint;
  state: number;
  inputCommitment: Hash;
  outputRootHash: Hash;
  chatId: Hash;
  attestationText: Hex;
  attestationSignature: Hex;
}

function hydrate(jobId: bigint, t: JobTuple): Job {
  return {
    jobId,
    serviceId: t.serviceId,
    buyer: t.buyer,
    seller: t.seller,
    amount: t.amount,
    protocolFee: t.protocolFee,
    createdAt: t.createdAt,
    timeout: t.timeout,
    state: t.state as JobState,
    inputCommitment: t.inputCommitment,
    outputRootHash: t.outputRootHash,
    chatId: t.chatId,
    attestationText: t.attestationText,
    attestationSignature: t.attestationSignature,
  };
}

export interface CreateJobArgs {
  serviceId: bigint;
  /** Plain text prompt. Will be UTF-8 encoded + hex-prefixed. */
  prompt?: string;
  /** Pre-encoded (and optionally ECIES-encrypted) input bytes. Overrides `prompt`. */
  encryptedInput?: Hex;
  /**
   * Value to escrow (wei). If omitted, the service's `pricePerCall` is used.
   * Pass explicitly to overpay for buffer or batched calls.
   */
  value?: bigint;
  /** Job timeout in seconds. Defaults to 300 (5 min). */
  timeoutSec?: number;
  /** Optional service hint — saves a `getService` RPC if you already have it. */
  service?: Service;
}

export interface CreateJobResult {
  jobId: bigint;
  txHash: Hash;
  inputCommitment: Hash;
}

export interface WatchOptions {
  pollMs?: number;
  signal?: AbortSignal;
}

export interface RunArgs extends CreateJobArgs, WatchOptions {}

export class JobsAPI {
  constructor(
    private readonly publicClient: PublicClient,
    private readonly walletClient: WalletClient | undefined,
    private readonly servicesGet: (id: bigint) => Promise<Service>,
  ) {}

  /** Read a single job from PactEscrow. */
  async get(jobId: bigint): Promise<Job> {
    const tuple = (await this.publicClient.readContract({
      address: PACT_ADDRESSES.PactEscrow,
      abi: PactEscrowAbi,
      functionName: "getJob",
      args: [jobId],
    })) as JobTuple;
    return hydrate(jobId, tuple);
  }

  /** Submit a new job: escrow funds + commit input hash on-chain. */
  async create(args: CreateJobArgs): Promise<CreateJobResult> {
    if (!this.walletClient) {
      throw new Error(
        "PactClient was constructed without a walletClient — pass one to `new PactClient({ walletClient })` to call write methods.",
      );
    }
    const service = args.service ?? (await this.servicesGet(args.serviceId));
    const encryptedInput = resolveInput(args);
    const value = args.value ?? service.pricePerCall;
    const timeoutSec = BigInt(args.timeoutSec ?? DEFAULT_TIMEOUT_SEC);
    const inputCommitment = keccak256(encryptedInput) as Hash;
    const now = BigInt(Math.floor(Date.now() / 1000));

    const { request } = await this.publicClient.simulateContract({
      address: PACT_ADDRESSES.PactEscrow,
      abi: PactEscrowAbi,
      functionName: "createJob",
      args: [args.serviceId, encryptedInput as ViemHex, now + timeoutSec],
      value,
      account: this.walletClient.account ?? undefined,
    });

    const txHash = (await this.walletClient.writeContract(request)) as Hash;
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    const jobId = extractJobIdFromLogs(receipt.logs);
    if (jobId === undefined) {
      throw new Error(
        "createJob succeeded but JobCreated event was not found in receipt logs",
      );
    }
    return { jobId, txHash, inputCommitment };
  }

  /**
   * Poll a job and yield snapshots on every state change. Stops at any
   * terminal state (Settled / Expired / Slashed). Caller can also abort
   * via `signal`.
   */
  async *watch(jobId: bigint, opts: WatchOptions = {}): AsyncGenerator<Job> {
    const pollMs = opts.pollMs ?? DEFAULT_POLL_MS;
    const signal = opts.signal;

    let previousState: JobState | undefined;
    while (true) {
      if (signal?.aborted) return;
      const job = await this.get(jobId);
      if (job.state !== previousState) {
        previousState = job.state;
        yield job;
      }
      if (isTerminalState(job.state)) return;
      await sleep(pollMs, signal);
    }
  }

  /**
   * High-level helper: create a job, watch it through settlement, return
   * the final state. Throws on Expired / Slashed.
   */
  async run(args: RunArgs): Promise<{ job: Job; jobId: bigint; createTxHash: Hash; service: Service }> {
    const service =
      args.service ?? (await this.servicesGet(args.serviceId));
    const created = await this.create({ ...args, service });
    let lastJob: Job | undefined;
    for await (const snap of this.watch(created.jobId, args)) {
      lastJob = snap;
    }
    if (!lastJob) {
      throw new Error(`watch(${created.jobId}) yielded no states`);
    }
    if (lastJob.state !== JobState.Settled) {
      throw new Error(
        `Job ${created.jobId} terminated in non-settled state ${JobState[lastJob.state]}`,
      );
    }
    return {
      job: lastJob,
      jobId: created.jobId,
      createTxHash: created.txHash,
      service,
    };
  }
}

function resolveInput(args: CreateJobArgs): Hex {
  if (args.encryptedInput) return args.encryptedInput;
  if (args.prompt !== undefined) return stringToHex(args.prompt) as Hex;
  throw new Error("createJob requires either `prompt` or `encryptedInput`");
}

function extractJobIdFromLogs(
  logs: ReadonlyArray<{ address: string; topics: readonly Hex[]; data: Hex }>,
): bigint | undefined {
  for (const log of logs) {
    if (
      log.address.toLowerCase() !==
      PACT_ADDRESSES.PactEscrow.toLowerCase()
    ) {
      continue;
    }
    try {
      const decoded = decodeEventLog({
        abi: PactEscrowAbi,
        data: log.data,
        topics: log.topics as [signature: Hex, ...args: Hex[]],
      });
      if (decoded.eventName === "JobCreated") {
        const args = decoded.args as { jobId?: bigint } | undefined;
        if (args?.jobId !== undefined) return args.jobId;
      }
    } catch {
      // not our event — ignore
    }
  }
  return undefined;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(t);
          resolve();
        },
        { once: true },
      );
    }
  });
}
