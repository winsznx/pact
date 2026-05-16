export type Address = `0x${string}`;
export type Hash = `0x${string}`;
export type Hex = `0x${string}`;

/**
 * PactEscrow job state machine. The on-chain `IPactEscrow.JobState` enum;
 * order matches the Solidity source, so the numeric value is the raw
 * `uint8` returned by `getJob`.
 */
export enum JobState {
  Pending = 0,
  Sealed = 1,
  Attested = 2,
  Settled = 3,
  Expired = 4,
  Disputed = 5,
  Slashed = 6,
}

export const JOB_STATE_LABEL: Record<JobState, string> = {
  [JobState.Pending]: "Pending",
  [JobState.Sealed]: "Sealed",
  [JobState.Attested]: "Attested",
  [JobState.Settled]: "Settled",
  [JobState.Expired]: "Expired",
  [JobState.Disputed]: "Disputed",
  [JobState.Slashed]: "Slashed",
};

/** A state is *terminal* if the job cannot leave it under normal operation. */
export const JOB_TERMINAL_STATES: ReadonlySet<JobState> = new Set([
  JobState.Settled,
  JobState.Expired,
  JobState.Slashed,
]);

export function isTerminalState(state: JobState): boolean {
  return JOB_TERMINAL_STATES.has(state);
}

/**
 * Single PactEscrow.Job snapshot. Mirrors `getJob(uint256)` output. All
 * numeric values are `bigint` because viem returns them that way and we
 * never want silent precision loss on uint128 / uint256 fields.
 */
export interface Job {
  jobId: bigint;
  serviceId: bigint;
  buyer: Address;
  seller: Address;
  amount: bigint;
  protocolFee: bigint;
  createdAt: bigint;
  timeout: bigint;
  state: JobState;
  inputCommitment: Hash;
  outputRootHash: Hash;
  chatId: Hash;
  attestationText: Hex;
  attestationSignature: Hex;
}

/** PactRegistry.Service snapshot — mirrors `getService(uint256)` output. */
export interface Service {
  serviceId: bigint;
  inftTokenId: bigint;
  seller: Address;
  capabilityHash: Hash;
  modelId: string;
  modelCommitment: Hash;
  providerAddress: Address;
  signingAddress: Address;
  providerIdentity: string;
  providerType: string;
  targetSeparated: boolean;
  pricePerCall: bigint;
  maxInputBytes: bigint;
  registeredAt: bigint;
  active: boolean;
}

/** TEE attestation as recorded on-chain after `submitAttestation`. */
export interface Attestation {
  text: Hex;
  signature: Hex;
}

/** Result of locally verifying an attestation via ECDSA recovery (no chain RPC). */
export interface VerifyResult {
  ok: boolean;
  recoveredSigner: Address;
  expectedSigner: Address;
}

/**
 * Parsed canonical attestation text. The 5-field, colon-separated payload
 * the TEE signs and `AttestationVerifier.parseAttestationText` validates
 * on-chain.
 */
export interface AttestationFields {
  contentHash: Hash;
  usageHash: Hash;
  providerType: string;
  providerIdentity: string;
  tlsCertFingerprint: Hex;
}

/** Top-level result of a `pact.run(...)` invocation. */
export interface RunResult {
  jobId: bigint;
  job: Job;
  service: Service;
  attestation: Attestation;
  verified: VerifyResult;
  txHashes: {
    createJob: Hash;
    settlement?: Hash;
  };
}

/** Per-network constants. v0.1 ships 0g-mainnet only. */
export interface PactNetwork {
  id: "0g-mainnet";
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
}
