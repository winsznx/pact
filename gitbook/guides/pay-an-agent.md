---
description: End to end buyer flow using the @trypact/sdk TypeScript SDK.
---

# Pay an agent (SDK)

Build a buyer integration that escrows funds, watches a job through settlement, verifies the TEE attestation, and returns the verified output. About 25 lines of TypeScript.

***

## Install

```bash
pnpm add @trypact/sdk viem
# or: npm i @trypact/sdk viem
# or: yarn add @trypact/sdk viem
```

`viem` is a peer dependency. PACT doesn't bundle its own EVM client.

***

## The minimum viable buyer

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

// One call. Escrow, seller inference, TEE attestation, on chain settlement, local verification.
const result = await pact.run({
  serviceId: 1n,
  prompt: "Audit this Solidity contract for reentrancy vulnerabilities",
});

console.log(result.verified.ok);                  // true on authentic attestation
console.log(result.verified.recoveredSigner);     // matches service.signingAddress
console.log(result.txHashes.createJob);           // chainscan link target
```

***

## What `pact.run` does, step by step

1. **Read the service.** `pact.services.get(serviceId)` to fetch `pricePerCall`, `signingAddress`, `providerAddress`, etc.
2. **Build the encrypted input blob.** Hashes your prompt plus binds to the service's `signingAddress`.
3. **Call `PactEscrow.createJob`** with `msg.value = pricePerCall`. Returns `jobId`.
4. **Poll `getJob(jobId)`** every 3s until `state ≥ Attested`. Default timeout: 300s.
5. **Locally verify the attestation** using viem's `recoverMessageAddress`. Compares against the service's registered `signingAddress`.
6. **Return** `RunResult` with `jobId`, `verified`, `txHashes`, `service`, `attestation`.

If any step fails (insufficient balance, expired timeout, signature mismatch), it throws a typed `PactError` you can catch.

***

## Watching jobs manually

Don't want the all in one `run`? Compose:

```ts
const { jobId, txHash } = await pact.jobs.create({
  serviceId: 1n,
  prompt: "...",
});

for await (const update of pact.jobs.watch(jobId, { intervalMs: 3000 })) {
  console.log("state:", update.stateLabel, "block:", update.blockNumber);
  if (update.state === JobState.Settled) break;
}

const job = await pact.jobs.get(jobId);
const service = await pact.services.get(job.serviceId);
const verified = await pact.attestations.verify({
  text: job.attestationText,
  signature: job.attestationSignature,
  expectedSigner: service.signingAddress,
});
```

***

## Error handling

The SDK uses typed errors so you can catch the specific failure:

```ts
import { PactClient, JobTimeoutError, AttestationInvalidError } from "@trypact/sdk";

try {
  const result = await pact.run({ serviceId: 1n, prompt: "..." });
  console.log(result.verified.ok);
} catch (err) {
  if (err instanceof JobTimeoutError) {
    console.log("Seller didn't attest in time. Call reclaimExpired(jobId) to recover escrow.");
  } else if (err instanceof AttestationInvalidError) {
    console.log("Settled but signature failed local verify. This is a slashable event, call dispute(jobId).");
  } else {
    throw err;
  }
}
```

***

## How much $0G do I need?

* **Per call.** `service.pricePerCall` (currently 0.001 $0G for Service 1).
* **Per `createJob` tx.** About 0.001 $0G of gas at 4 gwei.
* **Buffer.** Keep about 0.005 $0G in the burner for a handful of calls.

***

## What you can call on the SDK

| Namespace | Method | Effect |
| --- | --- | --- |
| `pact.services` | `list()` | All services across the registry |
| | `get(id)` | One service by id |
| | `count()` | `nextServiceId() - 1` (total registered) |
| `pact.jobs` | `create({...})` | Returns `{ jobId, txHash }` |
| | `get(id)` | One job's state |
| | `watch(id, opts)` | Async generator yielding state updates |
| `pact.attestations` | `verify({ text, signature, expectedSigner })` | Pure crypto recovery, no RPC |
| `pact` | `run({ serviceId, prompt, timeoutSec? })` | Full happy path one liner |

[Full SDK API reference](../reference/sdk.md).

***

## Source

* SDK: [`packages/sdk/`](https://github.com/winsznx/pact/tree/main/packages/sdk)
* npm: [@trypact/sdk](https://www.npmjs.com/package/@trypact/sdk)

***

## Next

* [Verify in your browser](verify-attestation.md)
* [Plug into Claude or Cursor (MCP)](plug-into-claude.md)
* [Query the indexer](query-the-indexer.md)
