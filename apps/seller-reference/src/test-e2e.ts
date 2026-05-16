// CLI end-to-end test: this script plays the BUYER side. It uses the
// same burner wallet as the seller (cheap loop — ~0.00005 $0G net cost
// since 95% of the escrow comes back as the seller payout to the same
// wallet, minus the 5% protocol fee, plus a small amount of gas).
//
// Flow:
//   1. Read PactEscrow.nextJobId() to anchor the expected jobId.
//   2. Build inputCommitment = keccak256("e2e-test-prompt").
//   3. createJob(serviceId, inputCommitment, 3600) with value=0.001 $0G.
//   4. Parse JobCreated event from receipt to confirm jobId.
//   5. Poll getJob(jobId) every 3s up to 120s; success on state == Settled.

import { ethers, keccak256, toUtf8Bytes } from "ethers";
import { PACT_ADDRESSES, PactEscrowAbi } from "@pact/shared";

import { loadConfig } from "./config.ts";
import { log } from "./logger.ts";

const GAS = { gasPrice: 4_000_000_000n, type: 0 as const };
const PROMPT = "e2e-test-prompt";
const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 120_000;
const STATE_SETTLED = 3;
const VALUE_WEI = ethers.parseEther("0.001");

async function main(): Promise<void> {
  const cfg = loadConfig();
  const provider = new ethers.JsonRpcProvider(cfg.PACT_RPC_URL);
  const wallet = new ethers.Wallet(cfg.PACT_PRIVATE_KEY, provider);
  const escrow = new ethers.Contract(
    PACT_ADDRESSES.PactEscrow,
    PactEscrowAbi,
    wallet,
  );

  const startedAt = Date.now();
  const balanceBefore = await provider.getBalance(wallet.address);
  const nextJobIdBefore = (await escrow.nextJobId()) as bigint;
  log.info("e2e.start", {
    buyer: wallet.address,
    balanceOg: ethers.formatEther(balanceBefore),
    serviceId: cfg.PACT_SERVICE_ID.toString(),
    valueOg: ethers.formatEther(VALUE_WEI),
    nextJobIdBefore: nextJobIdBefore.toString(),
  });

  const inputCommitment = keccak256(toUtf8Bytes(PROMPT));
  log.info("e2e.createJob.sending", {
    serviceId: cfg.PACT_SERVICE_ID.toString(),
    inputCommitment,
    timeout: 3600,
    valueWei: VALUE_WEI.toString(),
  });

  const tx = await escrow.createJob(
    cfg.PACT_SERVICE_ID,
    inputCommitment,
    3600,
    { value: VALUE_WEI, ...GAS },
  );
  log.info("e2e.createJob.txSent", { txHash: tx.hash });

  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error(`createJob reverted: tx ${tx.hash}`);
  }

  // Parse JobCreated to extract the assigned jobId.
  const iface = new ethers.Interface(PactEscrowAbi);
  let jobId: bigint | null = null;
  for (const lg of receipt.logs as ethers.Log[]) {
    try {
      const parsed = iface.parseLog({ topics: lg.topics, data: lg.data });
      if (parsed?.name === "JobCreated") {
        jobId = parsed.args.jobId as bigint;
        break;
      }
    } catch {
      /* not a PactEscrow log */
    }
  }
  if (jobId === null) {
    throw new Error(`createJob receipt has no JobCreated log: ${tx.hash}`);
  }
  log.info("e2e.createJob.confirmed", {
    txHash: tx.hash,
    jobId: jobId.toString(),
    block: receipt.blockNumber,
  });

  // Poll for settlement.
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let attempts = 0;
  while (Date.now() < deadline) {
    attempts += 1;
    const job = await escrow.getJob(jobId);
    const state = Number(job.state);
    log.info("e2e.poll", {
      attempt: attempts,
      jobId: jobId.toString(),
      state,
    });
    if (state === STATE_SETTLED) {
      const elapsedMs = Date.now() - startedAt;
      const balanceAfter = await provider.getBalance(wallet.address);
      const sellerCutWei = BigInt(job.amount) - BigInt(job.protocolFee);
      log.info("e2e.settled", {
        jobId: jobId.toString(),
        createJobTx: tx.hash,
        block: receipt.blockNumber,
        elapsedMs,
        elapsedSeconds: (elapsedMs / 1000).toFixed(1),
        amountWei: BigInt(job.amount).toString(),
        protocolFeeWei: BigInt(job.protocolFee).toString(),
        sellerCutWei: sellerCutWei.toString(),
        sellerCutOg: ethers.formatEther(sellerCutWei),
        protocolFeeOg: ethers.formatEther(BigInt(job.protocolFee)),
        balanceBeforeOg: ethers.formatEther(balanceBefore),
        balanceAfterOg: ethers.formatEther(balanceAfter),
        netCostOg: ethers.formatEther(balanceBefore - balanceAfter),
        attestationTextBytes: ethers.dataLength(job.attestationText),
        attestationSignatureBytes: ethers.dataLength(job.attestationSignature),
      });
      log.info("e2e.PASS", { jobId: jobId.toString(), createJobTx: tx.hash });
      return;
    }
    if (state !== 0 && state !== 1 && state !== 2) {
      // Pending=0, Sealed=1, Attested=2 are intermediate. Anything else
      // before Settled is a terminal failure (Expired=4, Disputed=5, Slashed=6).
      throw new Error(
        `job ${jobId.toString()} reached terminal non-settled state ${state}`,
      );
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(
    `timeout: job ${jobId.toString()} did not reach Settled in ${POLL_TIMEOUT_MS / 1000}s`,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  log.error("e2e.FAIL", {
    message: (err as Error).message,
    stack: (err as Error).stack?.split("\n").slice(0, 5).join("\n"),
  });
  process.exit(1);
});
