import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ethers } from "ethers";
import { PACT_ADDRESSES, PactEscrowAbi } from "@pact/shared";

import { submitAttestation } from "./attestation.ts";
import { runInferenceAndCaptureAttestation } from "./inference.ts";
import { loadLastProcessedJobId, saveLastProcessedJobId } from "./state.ts";
import { log } from "./logger.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(HERE, "..", "jobs-output");

const STATE_PENDING = 0;

interface WatcherOpts {
  serviceId: bigint;
  providerAddress: string;
  pollIntervalMs: number;
}

/**
 * Polling watcher loop. Per the Phase 1 broadcast notes, 0G's WS support
 * is unreliable, so we poll PactEscrow.nextJobId() every `pollIntervalMs`
 * and fan out to handle any new jobs targeting our serviceId.
 *
 * Restart-safe via .processed-jobs (managed by state.ts).
 */
export async function runWatcher(
  wallet: ethers.Wallet,
  opts: WatcherOpts,
): Promise<void> {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  const escrow = new ethers.Contract(
    PACT_ADDRESSES.PactEscrow,
    PactEscrowAbi,
    wallet,
  );

  let lastProcessed = loadLastProcessedJobId();
  log.info("watcher.start", {
    seller: wallet.address,
    serviceId: opts.serviceId.toString(),
    providerAddress: opts.providerAddress,
    pollIntervalMs: opts.pollIntervalMs,
    lastProcessedJobId: lastProcessed.toString(),
  });

  let stopping = false;
  const stop = (signal: string) => {
    if (stopping) return;
    stopping = true;
    log.info("watcher.shutdown", { signal, lastProcessedJobId: lastProcessed.toString() });
    saveLastProcessedJobId(lastProcessed);
    process.exit(0);
  };
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));

  while (!stopping) {
    try {
      const nextJobId = (await escrow.nextJobId()) as bigint;
      // Latest assigned jobId is nextJobId - 1n. Scan from
      // lastProcessed + 1 to nextJobId - 1 inclusive.
      if (nextJobId > lastProcessed + 1n) {
        for (let id = lastProcessed + 1n; id < nextJobId; id++) {
          if (stopping) break;
          await maybeHandleJob(wallet, escrow, id, opts);
          lastProcessed = id;
          saveLastProcessedJobId(lastProcessed);
        }
      }
    } catch (e) {
      log.error("watcher.pollError", {
        reason: (e as Error).message.slice(0, 400),
      });
    }
    await sleep(opts.pollIntervalMs);
  }
}

/**
 * Inspect a single jobId. If it targets our service AND is still
 * Pending, run inference + submit attestation. Anything else logs
 * and moves on.
 */
async function maybeHandleJob(
  wallet: ethers.Wallet,
  escrow: ethers.Contract,
  jobId: bigint,
  opts: WatcherOpts,
): Promise<void> {
  let job;
  try {
    job = await escrow.getJob(jobId);
  } catch (e) {
    log.warn("watcher.getJobFailed", {
      jobId: jobId.toString(),
      reason: (e as Error).message.slice(0, 200),
    });
    return;
  }

  const jobServiceId = BigInt(job.serviceId);
  const jobState = Number(job.state);

  if (jobServiceId !== opts.serviceId) {
    log.info("watcher.skip.foreignService", {
      jobId: jobId.toString(),
      jobServiceId: jobServiceId.toString(),
      ourServiceId: opts.serviceId.toString(),
    });
    return;
  }
  if (jobState !== STATE_PENDING) {
    log.info("watcher.skip.notPending", {
      jobId: jobId.toString(),
      state: jobState,
    });
    return;
  }
  if (job.seller.toLowerCase() !== wallet.address.toLowerCase()) {
    // Service 1's seller must equal our wallet for submitAttestation
    // to be authorized. If it doesn't match, log loudly — this means
    // we're running with the wrong key.
    log.error("watcher.sellerMismatch", {
      jobId: jobId.toString(),
      ourAddress: wallet.address,
      jobSeller: job.seller,
    });
    return;
  }

  log.info("watcher.newJob", {
    jobId: jobId.toString(),
    buyer: job.buyer,
    amountWei: BigInt(job.amount).toString(),
    inputCommitment: job.inputCommitment,
  });

  try {
    const capture = await runInferenceAndCaptureAttestation(
      wallet,
      opts.providerAddress,
    );

    // v0.1 output relay: write the seller's plaintext output to a
    // local file. Buyer's frontend (running on the same machine for
    // the demo) reads it from localStorage[`pact:output:${jobId}`].
    // v0.2 wires Supabase + indexer.
    const outputPath = join(OUTPUT_DIR, `${jobId.toString()}.txt`);
    writeFileSync(outputPath, capture.messageContent, "utf8");

    const txHash = await submitAttestation(wallet, jobId, capture);
    log.info("watcher.jobSettled", {
      jobId: jobId.toString(),
      txHash,
      outputBytes: capture.messageContent.length,
      outputPath,
    });
  } catch (e) {
    log.error("watcher.jobFailed", {
      jobId: jobId.toString(),
      reason: (e as Error).message.slice(0, 400),
    });
    // Continue the loop — one bad job shouldn't kill the agent.
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
