import type { PublicClient, WalletClient } from "viem";

import { AttestationsAPI } from "./attestations.js";
import { JobsAPI } from "./jobs.js";
import { ServicesAPI } from "./services.js";
import type { PactNetwork, RunResult } from "./types.js";
import { JobState } from "./types.js";

export const NETWORK_0G_MAINNET: PactNetwork = {
  id: "0g-mainnet",
  chainId: 16661,
  rpcUrl: "https://evmrpc.0g.ai",
  explorerUrl: "https://chainscan.0g.ai",
};

export interface PactClientConfig {
  publicClient: PublicClient;
  /** Optional. Required only if you intend to write (createJob, etc.). */
  walletClient?: WalletClient;
}

/**
 * Top-level entry point. Holds three sub-APIs:
 *   - `services` — read on PactRegistry
 *   - `jobs`     — read + write on PactEscrow
 *   - `attestations` — local ECDSA verify (no RPC)
 *
 * Plus a high-level `run()` that wraps create + watch + verify into one
 * promise — the path most consumers actually want.
 *
 * Example:
 * ```ts
 * import { PactClient } from "@trypact/sdk";
 * import { createPublicClient, createWalletClient, http } from "viem";
 * import { privateKeyToAccount } from "viem/accounts";
 *
 * const account = privateKeyToAccount(process.env.BUYER_KEY as `0x${string}`);
 * const chain = { id: 16661, name: "0G Mainnet", nativeCurrency: { name: "OG", symbol: "OG", decimals: 18 }, rpcUrls: { default: { http: ["https://evmrpc.0g.ai"] } } } as const;
 *
 * const pact = new PactClient({
 *   publicClient: createPublicClient({ chain, transport: http() }),
 *   walletClient: createWalletClient({ account, chain, transport: http() }),
 * });
 *
 * const result = await pact.run({
 *   serviceId: 1n,
 *   prompt: "Audit this Solidity contract for reentrancy",
 * });
 *
 * console.log(result.verified.ok, result.verified.recoveredSigner);
 * ```
 */
export class PactClient {
  readonly services: ServicesAPI;
  readonly jobs: JobsAPI;
  readonly attestations: AttestationsAPI;
  readonly network: PactNetwork;

  constructor(config: PactClientConfig) {
    this.network = NETWORK_0G_MAINNET;
    this.services = new ServicesAPI(config.publicClient);
    this.jobs = new JobsAPI(
      config.publicClient,
      config.walletClient,
      (id) => this.services.get(id),
    );
    this.attestations = new AttestationsAPI();
  }

  /**
   * Convenience: create a job, watch through settlement, verify the
   * attestation, return everything. Throws on non-settled terminal states.
   */
  async run(
    args: Parameters<JobsAPI["run"]>[0],
  ): Promise<RunResult> {
    const { job, jobId, createTxHash, service } = await this.jobs.run(args);
    if (job.state !== JobState.Settled) {
      throw new Error(
        `run() ended in non-settled state — got ${JobState[job.state]}`,
      );
    }
    const verified = await this.attestations.verify({
      text: job.attestationText,
      signature: job.attestationSignature,
      expectedSigner: service.signingAddress,
    });
    return {
      jobId,
      job,
      service,
      attestation: {
        text: job.attestationText,
        signature: job.attestationSignature,
      },
      verified,
      txHashes: {
        createJob: createTxHash,
      },
    };
  }
}
