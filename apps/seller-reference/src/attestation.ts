import { ethers } from "ethers";
import { keccak256, toUtf8Bytes } from "ethers";
import { PACT_ADDRESSES, PactEscrowAbi } from "@pact/shared";

import { log } from "./logger.ts";
import type { AttestationCapture } from "./inference.ts";

/**
 * CLAUDE.md "Broadcasting on 0G mainnet" rules:
 *   - Use legacy transactions with explicit gas price (4 gwei tip
 *     minimum on 0G; auto-estimate undershoots and the node rejects).
 *   - Verify post-tx state via on-chain reads, never trust the receipt
 *     parser alone.
 *
 * 4 gwei = 4_000_000_000 wei. `type: 0` forces legacy (non-EIP-1559).
 */
const GAS = { gasPrice: 4_000_000_000n, type: 0 as const };

/**
 * Submit a captured attestation to PactEscrow.submitAttestation. The
 * contract verifies the signature against the service's registered
 * signingAddress and atomically settles the job. On success, parses
 * the JobSettled event from the receipt and logs the seller payout.
 *
 * Returns the tx hash on success. Throws on revert; caller decides
 * whether to retry (typically: don't, since revert reasons here are
 * usually NotPending, AlreadyExpired, or AttestationInvalid — none
 * fixable by retry).
 */
export async function submitAttestation(
  wallet: ethers.Wallet,
  jobId: bigint,
  capture: AttestationCapture,
): Promise<string> {
  const escrow = new ethers.Contract(
    PACT_ADDRESSES.PactEscrow,
    PactEscrowAbi,
    wallet,
  );

  // outputRootHash: bytes32 — v0.1 uses keccak256(messageContent) as a
  // local proxy for "what the seller actually returned". v0.2 will
  // upload the output to 0G Storage and use the real root hash. The
  // contract just stores this opaquely; verifier doesn't read it.
  const outputRootHash = keccak256(toUtf8Bytes(capture.messageContent));

  // chatId: bytes32 — keccak256 of the UUID string. The contract uses
  // it for replay protection (mapping(bytes32 => bool) _usedChatIds).
  const chatIdBytes32 = keccak256(toUtf8Bytes(capture.chatId));

  // attestationText / attestationSignature: bytes — the canonical
  // 5-field colon-separated text + the 65-byte secp256k1 signature with
  // recovery byte. The verifier wraps text in EIP-191 + recovers.
  const textBytes = ethers.toUtf8Bytes(capture.attestationText);

  log.info("attestation.submit", {
    jobId: jobId.toString(),
    chatId: capture.chatId,
    chatIdBytes32,
    outputRootHash,
    textBytes: textBytes.length,
    signatureBytes: ethers.getBytes(capture.signature).length,
    seller: wallet.address,
  });

  let tx;
  try {
    tx = await escrow.submitAttestation(
      jobId,
      outputRootHash,
      chatIdBytes32,
      textBytes,
      capture.signature,
      GAS,
    );
  } catch (e) {
    const msg = (e as Error).message;
    log.error("attestation.submitFailed", {
      jobId: jobId.toString(),
      reason: msg.slice(0, 400),
    });
    throw e;
  }

  log.info("attestation.tx.sent", {
    jobId: jobId.toString(),
    txHash: tx.hash,
  });

  // 0G's receipt schema is non-standard (missing some EVM fields) — wait
  // for receipt but verify final state via getJob() rather than trusting
  // the parsed receipt object alone (CLAUDE.md broadcast rule #3).
  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error(`tx ${tx.hash} returned null receipt`);
  }
  if (receipt.status !== 1) {
    throw new Error(
      `tx ${tx.hash} reverted (status=${receipt.status}, gasUsed=${receipt.gasUsed})`,
    );
  }

  // Verify the job actually settled by reading state.
  const job = await escrow.getJob(jobId);
  // job.state is uint8: Pending=0 ... Settled=3.
  const STATE_SETTLED = 3;
  if (Number(job.state) !== STATE_SETTLED) {
    throw new Error(
      `tx ${tx.hash} confirmed but job.state=${job.state} (expected Settled=3)`,
    );
  }

  log.info("attestation.settled", {
    jobId: jobId.toString(),
    txHash: tx.hash,
    sellerCutWei: (BigInt(job.amount) - BigInt(job.protocolFee)).toString(),
    protocolFeeWei: BigInt(job.protocolFee).toString(),
  });
  return tx.hash;
}
