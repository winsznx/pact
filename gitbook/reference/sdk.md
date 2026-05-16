---
description: Full API reference for @trypact/sdk.
---

# SDK API

`@trypact/sdk` is a typed TypeScript SDK for the PACT protocol on 0G mainnet. viem is a peer dependency.

* npm: [@trypact/sdk](https://www.npmjs.com/package/@trypact/sdk)
* Source: [`packages/sdk/`](https://github.com/winsznx/pact/tree/main/packages/sdk)

***

## Install

```bash
pnpm add @trypact/sdk viem
```

***

## `PactClient`

The main entry point. Construct with viem clients.

```ts
import { PactClient } from "@trypact/sdk";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const chain = {
  id: 16661, name: "0G Mainnet",
  nativeCurrency: { name: "OG", symbol: "OG", decimals: 18 },
  rpcUrls: { default: { http: ["https://evmrpc.0g.ai"] } },
} as const;

const account = privateKeyToAccount(process.env.BUYER_KEY as `0x${string}`);

const pact = new PactClient({
  publicClient: createPublicClient({ chain, transport: http() }),
  walletClient: createWalletClient({ account, chain, transport: http() }),
});
```

| Constructor field | Required for |
| --- | --- |
| `publicClient` | All reads (services, jobs, attestations) |
| `walletClient` | Writes (creating jobs, calling `pact.run`) |

`walletClient` is optional. Read only consumers can construct without it.

***

## `pact.services`

```ts
pact.services.list(): Promise<Service[]>
pact.services.get(serviceId: bigint): Promise<Service>
pact.services.count(): Promise<bigint>           // nextServiceId() - 1
```

### `Service` type

```ts
interface Service {
  serviceId: bigint;
  inftTokenId: bigint;
  seller: `0x${string}`;
  capabilityHash: `0x${string}`;
  modelId: string;
  modelCommitment: `0x${string}`;
  providerAddress: `0x${string}`;
  signingAddress: `0x${string}`;          // the address verifyAttestation expects
  providerIdentity: string;
  providerType: "centralized" | "decentralized" | "self";
  targetSeparated: boolean;
  pricePerCall: bigint;                   // wei of $0G
  maxInputBytes: bigint;
  registeredAt: bigint;                   // unix timestamp
  active: boolean;
}
```

***

## `pact.jobs`

```ts
pact.jobs.create({
  serviceId: bigint;
  prompt: string;
  timeoutSec?: number;                    // default 300
}): Promise<{ jobId: bigint; txHash: `0x${string}` }>

pact.jobs.get(jobId: bigint): Promise<Job>

pact.jobs.watch(jobId: bigint, opts?: {
  intervalMs?: number;                    // default 3000
  timeoutSec?: number;                    // default 300
}): AsyncIterable<JobUpdate>
```

### `Job` type

```ts
interface Job {
  jobId: bigint;
  serviceId: bigint;
  buyer: `0x${string}`;
  seller: `0x${string}`;
  state: JobState;
  amount: bigint;                         // wei escrowed
  inputHash: `0x${string}`;
  outputRootHash: `0x${string}`;
  chatId: `0x${string}`;
  attestationText: `0x${string}`;         // 5 field canonical text, hex encoded
  attestationSignature: `0x${string}`;    // 65 byte ECDSA(secp256k1)
  createdAt: bigint;
  timeout: bigint;
}
```

### `JobState` enum

```ts
enum JobState {
  Pending = 0,
  Sealed = 1,
  Attested = 2,
  Settled = 3,
  Expired = 4,
  Disputed = 5,
  Slashed = 6,
}

const JOB_STATE_LABEL: Record<JobState, string>;
// JOB_STATE_LABEL[3] === "Settled"
```

***

## `pact.attestations`

```ts
pact.attestations.verify({
  text: `0x${string}`;                    // job.attestationText
  signature: `0x${string}`;               // job.attestationSignature
  expectedSigner: `0x${string}`;          // service.signingAddress
}): Promise<VerifyResult>

interface VerifyResult {
  ok: boolean;
  recoveredSigner: `0x${string}`;
  expectedSigner: `0x${string}`;
}
```

Pure crypto. No RPC. Runs viem's `recoverMessageAddress`.

***

## `pact.run`

The happy path one liner. Equivalent to `create` plus `watch` plus `verify` chained.

```ts
pact.run({
  serviceId: bigint;
  prompt: string;
  timeoutSec?: number;                    // default 300
}): Promise<RunResult>

interface RunResult {
  jobId: bigint;
  verified: VerifyResult;
  txHashes: { createJob: `0x${string}` };
  service: Service;
  attestation: {
    text: `0x${string}`;
    signature: `0x${string}`;
  };
}
```

Throws on failure:

| Error | When |
| --- | --- |
| `JobTimeoutError` | Seller didn't attest within `timeoutSec`. Buyer can call `reclaimExpired(jobId)`. |
| `AttestationInvalidError` | Settled, but local verification failed. Slashable. |
| `InsufficientFundsError` | Wallet has less than `pricePerCall` plus gas. |
| `PactError` | Base class for all SDK errors. |

***

## Constants

```ts
import { NETWORK_0G_MAINNET, PACT_ADDRESSES, PACT_REGISTRY_ABI, PACT_ESCROW_ABI } from "@trypact/sdk";

NETWORK_0G_MAINNET = {
  id: 16661,
  chainId: 16661,
  rpcUrl: "https://evmrpc.0g.ai",
  explorerUrl: "https://chainscan.0g.ai",
};

PACT_ADDRESSES = {
  PactRegistry: "0x152A5a433A6592df57d7F77B7B01eEE00C481C2d",
  PactEscrow: "0xB2b762Df53294923d3eaD00d8118AD37388dD4aA",
  AttestationVerifier: "0x765C857B6764c90B0093Ea16f6103902665D0aa2",
  ReputationVault: "0x1574E42D7fF268384408430D5b76C88f37b8a72B",
  SlashingArbiter: "0x324E5b2183134EB239C7E934438831a15abe7C00",
  AgentNFT_proxy: "0xe76dBE7FCf8c7F784b05DF88996bd63CA2c4d7D6",
  AgentNFT_impl: "0x4EC0DCac00A274Fb69F54cAb62370b2c71989CE4",
};
```

***

## Source

* Package: [`packages/sdk/`](https://github.com/winsznx/pact/tree/main/packages/sdk)
* npm: [@trypact/sdk](https://www.npmjs.com/package/@trypact/sdk)
* TypeScript types: [`packages/sdk/src/types.ts`](https://github.com/winsznx/pact/blob/main/packages/sdk/src/types.ts)
