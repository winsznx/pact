---
description: Recover a TEE signature locally in your browser. No server trust.
---

# Verify in your browser

PACT's central trust claim is that the attestation signature can be verified by anyone, on any device, without trusting any server in the loop. This guide shows you how.

***

## The 30 second version

Open [trypact.xyz/verify/2?autoplay=1](https://trypact.xyz/verify/2?autoplay=1).

That page loads job #2's `attestationText` and `attestationSignature` directly from the contract on 0G mainnet, then runs viem's `recoverMessageAddress` in your browser to recover the signing address from the signature. The recovered address is compared against the service's registered `signingAddress` (also read from the contract). If they match, the attestation is authentic.

The animation walks through every step. Parsing the five field canonical text, wrapping with EIP-191 prefix, keccak256, secp256k1 recovery, comparison, MATCH badge.

***

## Why this matters

If verification only worked on our infrastructure, this would be a trust us product. By making the same primitive run in any browser, on any node, against bytes read straight from the contract, PACT can claim:

> Any third party can confirm in seconds, without trusting our backend, that a given attestation is authentic.

That's the entire moat. The animation page is just a friendly UI on top of the same `recoverMessageAddress` call you can run yourself.

***

## Run it yourself in 10 lines

```ts
import { recoverMessageAddress, createPublicClient, http } from "viem";
import { PactClient } from "@trypact/sdk";

const pact = new PactClient({
  publicClient: createPublicClient({
    chain: { id: 16661, name: "0G Mainnet", nativeCurrency: { name: "OG", symbol: "OG", decimals: 18 }, rpcUrls: { default: { http: ["https://evmrpc.0g.ai"] } } } as const,
    transport: http(),
  }),
});

const job = await pact.jobs.get(2n);
const service = await pact.services.get(job.serviceId);
const recovered = await recoverMessageAddress({
  message: { raw: job.attestationText },
  signature: job.attestationSignature,
});

console.log(recovered === service.signingAddress); // true → authentic
```

***

## Why the contract uses the same primitive

The on chain `AttestationVerifier.verify` runs the exact same recovery:

```solidity
bytes32 digest = MessageHashUtils.toEthSignedMessageHash(attestationText);
address signer = ECDSA.recover(digest, signature);
require(signer == svc.signingAddress, "AttestationInvalid");
```

No exotic crypto. No zero knowledge stack. The same `ECDSA.recover` baked into every Ethereum wallet for ten years.

Browser verifier = same bytes (read from chain) plus same hash function (keccak256) plus same recovery function (secp256k1 ECDSA) → same recovered address. If any of those drift, the moat breaks. They don't drift. They're all standardized.

***

## Disputing a job that fails verification

If `recovered !== expectedSigner` for a settled job, that's a slashable event. Anyone can call:

```solidity
PactEscrow.dispute{value: disputeBond}(jobId);
```

If the dispute succeeds (the on chain recovery confirms the mismatch you found), the seller's bond slashes. 70% to you, 20% to the protocol, 10% burned.

[See Economics for the full slash splits](../concepts/economics.md).

***

## Source

* Solidity verifier: [`AttestationVerifier.sol`](https://github.com/winsznx/pact/blob/main/packages/contracts/src/AttestationVerifier.sol)
* Browser animation: [`ECDSARecoveryViz.tsx`](https://github.com/winsznx/pact/blob/main/apps/web/src/components/jobs/ECDSARecoveryViz.tsx)
* SDK verifier: [`packages/sdk/src/attestations.ts`](https://github.com/winsznx/pact/blob/main/packages/sdk/src/attestations.ts)

***

## Next

* [TEE attestation concept](../concepts/attestation.md)
* [Pay an agent (SDK)](pay-an-agent.md)
