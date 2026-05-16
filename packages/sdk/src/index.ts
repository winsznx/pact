/**
 * @trypact/sdk — Buyer SDK for PACT (Provable Agent-to-Agent Compute Trust).
 *
 * Settlement protocol for verifiable AI-as-a-Service on 0G mainnet.
 * Every inference produces a TEE-attested ECDSA signature recoverable
 * on-chain. Reputation accrues to the seller's ERC-7857 INFT.
 *
 * Live demo: https://trypact.xyz
 * Repo:      https://github.com/winsznx/pact
 */

export { PactClient, NETWORK_0G_MAINNET } from "./client.js";
export type { PactClientConfig } from "./client.js";

export { ServicesAPI } from "./services.js";
export {
  JobsAPI,
  type CreateJobArgs,
  type CreateJobResult,
  type RunArgs,
  type WatchOptions,
} from "./jobs.js";
export {
  AttestationsAPI,
  decodeAttestationText,
  verifyAttestation,
  type VerifyArgs,
} from "./attestations.js";

export {
  JobState,
  JOB_STATE_LABEL,
  JOB_TERMINAL_STATES,
  isTerminalState,
  type Address,
  type Hash,
  type Hex,
  type Job,
  type Service,
  type Attestation,
  type AttestationFields,
  type VerifyResult,
  type RunResult,
  type PactNetwork,
} from "./types.js";

export {
  PACT_ADDRESSES,
  PACT_CONFIG,
  PACT_CHAIN_ID,
  PACT_CHAIN_NAME,
  PACT_RPC_URL_PRIMARY,
  PACT_EXPLORER_URL,
  isPactDeployed,
  type PactContractName,
} from "./addresses.js";

export {
  PactRegistryAbi,
  PactEscrowAbi,
  AttestationVerifierAbi,
  ReputationVaultAbi,
  SlashingArbiterAbi,
} from "./abis.js";
