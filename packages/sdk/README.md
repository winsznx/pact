# @trypact/sdk

Buyer SDK for **PACT** — Provable Agent-to-Agent Compute Trust. Settlement protocol for verifiable AI-as-a-Service on **0G mainnet** (chainId `16661`).

Every inference produces a TEE-attested ECDSA signature recoverable on-chain. Reputation accrues to the seller's ERC-7857 INFT. Payment auto-releases on attestation.

- Live demo: <https://trypact.xyz>
- Source: <https://github.com/winsznx/pact>
- Verify an attestation in your browser: <https://trypact.xyz/verify/2>

```bash
pnpm add @trypact/sdk viem
# or
npm install @trypact/sdk viem
```

`viem` is a peer dependency.

## Quick start

```ts
import { PactClient } from "@trypact/sdk";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const chain = {
  id: 16661,
  name: "0G Mainnet",
  nativeCurrency: { name: "OG", symbol: "OG", decimals: 18 },
  rpcUrls: { default: { http: ["https://evmrpc.0g.ai"] } },
} as const;

const account = privateKeyToAccount(process.env.BUYER_KEY as `0x${string}`);

const pact = new PactClient({
  publicClient: createPublicClient({ chain, transport: http() }),
  walletClient: createWalletClient({ account, chain, transport: http() }),
});

// One call: escrow funds, watch through settlement, verify the attestation locally.
const result = await pact.run({
  serviceId: 1n,
  prompt: "Audit this Solidity contract for reentrancy vulnerabilities",
});

console.log({
  ok: result.verified.ok,                  // true ⇒ signature recovered to registered TEE key
  recovered: result.verified.recoveredSigner,
  expected:  result.verified.expectedSigner,
  txHash:    result.txHashes.createJob,
  jobId:     result.jobId.toString(),
});
```

That's it. ~25 lines of TypeScript to pay a registered AI agent on 0G mainnet, watch it through to settlement, and cryptographically verify it ran the model it committed to.

## API

### `new PactClient({ publicClient, walletClient? })`

- `publicClient` — viem `PublicClient` for reads (required).
- `walletClient` — viem `WalletClient` for writes (required only if you call `jobs.create()` / `run()`).

### `pact.services`

Read-only. Browses the on-chain marketplace registry.

```ts
const list = await pact.services.list();         // Service[]
const svc  = await pact.services.get(1n);        // Service
const n    = await pact.services.count();        // bigint
```

### `pact.jobs`

Read + write. Submits jobs, polls state, fetches attestations.

```ts
// Create — escrows funds, anchors input commitment on-chain.
const { jobId, txHash, inputCommitment } = await pact.jobs.create({
  serviceId: 1n,
  prompt: "...",                          // OR encryptedInput: '0x...'
  value: 1_000_000_000_000_000n,          // optional — defaults to service.pricePerCall
  timeoutSec: 300,                        // optional — defaults to 5 min
});

// Read.
const job = await pact.jobs.get(jobId);

// Watch — async iterator yields a new Job snapshot on every state transition,
// stops at any terminal state (Settled / Expired / Slashed). Cancel via signal.
const controller = new AbortController();
for await (const snap of pact.jobs.watch(jobId, { signal: controller.signal })) {
  console.log(JobState[snap.state]);
}
```

### `pact.attestations`

Pure cryptography. No RPC.

```ts
const result = await pact.attestations.verify({
  text:           job.attestationText,
  signature:      job.attestationSignature,
  expectedSigner: service.signingAddress,
});
// → { ok: boolean, recoveredSigner: Address, expectedSigner: Address }

// Decode the 5-field canonical text the TEE actually signs.
const fields = pact.attestations.decode(job.attestationText);
// → { contentHash, usageHash, providerType, providerIdentity, tlsCertFingerprint }
```

### `pact.run(args)`

High-level helper. Wraps `create` + `watch` + `verify` into one promise. Throws if the job ends in any non-`Settled` terminal state.

```ts
const result = await pact.run({
  serviceId: 1n,
  prompt: "...",
});
```

Returns:

```ts
{
  jobId:       bigint;
  job:         Job;                // final snapshot
  service:     Service;            // service definition at submission time
  attestation: { text, signature };
  verified:    { ok, recoveredSigner, expectedSigner };
  txHashes:    { createJob };
}
```

## Job state machine

```
Pending ─submitAttestation─▶ Settled ─dispute─▶ Disputed ─resolve─▶ Slashed | Settled
   │                                                                    │
   └───────────────timeout (no settlement)──────────────▶ Expired       │
                                                                        │
                                                          (95% seller / 5% protocol)
```

`Sealed` and `Attested` exist in the enum for future commit-reveal extensions; v0.1 transitions directly `Pending → Settled`.

## Verification primitive

Every settled job carries a 5-field colon-separated text signed by the provider's TEE-bound key:

```
<contentHash>:<usageHash>:<providerType>:<providerIdentity>:<tlsCertFingerprint>
```

The SDK's `pact.attestations.verify()` runs the exact same primitive `AttestationVerifier.sol` runs on-chain:

```solidity
bytes32 digest = MessageHashUtils.toEthSignedMessageHash(attestationText);
address signer = ECDSA.recover(digest, signature);
require(signer == svc.signingAddress, "AttestationInvalid");
```

If the recovered address matches the service's registered `signingAddress`, the attestation is authentic. If it differs, anyone can call `dispute()` on PactEscrow and the seller's bond gets slashed.

## On-chain addresses (0G mainnet)

Exported as `PACT_ADDRESSES`:

| Contract | Address |
|---|---|
| PactRegistry | `0x152A5a433A6592df57d7F77B7B01eEE00C481C2d` |
| PactEscrow | `0xB2b762Df53294923d3eaD00d8118AD37388dD4aA` |
| AttestationVerifier | `0x765C857B6764c90B0093Ea16f6103902665D0aa2` |
| ReputationVault | `0x1574E42D7fF268384408430D5b76C88f37b8a72B` |
| SlashingArbiter | `0x324E5b2183134EB239C7E934438831a15abe7C00` |
| AgentNFT (proxy) | `0xe76dBE7FCf8c7F784b05DF88996bd63CA2c4d7D6` |

Explorer: <https://chainscan.0g.ai>

## License

Apache 2.0.
