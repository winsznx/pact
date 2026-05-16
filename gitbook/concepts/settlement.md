---
description: How buyers and sellers settle on PACT, end to end.
---

# Settlement protocol

PACT runs a four step settlement cycle per inference call. Every step touches an on chain event you can grep on [chainscan](https://chainscan.0g.ai).

***

## The cycle

```
1. Seller registers a service (one time)
   PactRegistry.registerService(...) → emits ServiceRegistered

2. Seller stakes a bond (one time, ≥ 5 $0G)
   SlashingArbiter.stakeBond(serviceId) → emits BondStaked

3. Buyer creates a job (per inference)
   PactEscrow.createJob(serviceId, encryptedInput, timeout) {value: price}
     → emits JobCreated, state = Pending

4. Seller runs the inference and submits the TEE attestation
   PactEscrow.submitAttestation(jobId, outputRoot, chatId, text, signature)
     → AttestationVerifier.verify(...) runs inline
     → on success: emits Attested, immediately Settled
     → atomic payout: 95% to seller, 5% to protocol fee
```

If the seller doesn't attest by `timeout`, the buyer reclaims escrow via `reclaimExpired(jobId)`. If anyone challenges a settled attestation within the 24h dispute window, `dispute(jobId)` opens a Disputed to arbitration path. On win, the seller's bond is slashed. See [Economics](economics.md).

***

## Why commit reveal ordering matters

The job lifecycle enforces a strict ordering invariant. The buyer's input is committed on `JobCreated` before the seller has any chance to inspect it. The seller's output and attestation are committed on `submitAttestation` before the seller reveals the output to the buyer. This kills the most obvious griefing vectors.

A malicious seller can't see the prompt, generate a cheap response, and inflate the price post hoc. Price is locked at `createJob`.

A malicious buyer can't see the output, refuse to pay, then reuse it. Payment is locked the moment the attestation verifies on chain.

A man in the middle can't substitute either side because the contract verifies the TEE signature against the registered signing address, on chain, inline with settlement.

***

## What's settled, exactly

A "settled" job means the contract verified that:

1. The escrowed funds went to the address registered as the seller for `serviceId`.
2. The 5 field canonical text (see [Attestation](attestation.md)) was signed by the address the seller registered as `signingAddress` for that service.
3. The TEE bound signing key on the provider side acknowledged the inference happened.

What it does not assert: anything about the *quality* of the output. PACT is a settlement layer for cryptographic provenance, not a quality oracle. Quality lives in [reputation](reputation.md), sqrt weighted by buyer volume to resist sybil.

***

## Five 0G primitives, each load bearing

| Primitive | Role in PACT |
| --- | --- |
| **0G Chain** | All 7 protocol contracts. Every settlement, every event, every dispute. |
| **0G Compute** | TEE attested inference via Direct broker. Every settled job's `text` and `signature` is pulled from `${endpoint}/v1/proxy/signature/${chatId}`. |
| **0G Storage** | Encrypted output blob and KV reputation history (v0.2 path. v0.1 uses local handoff). |
| **ERC-7857 INFT** | Seller identity and reputation accumulator. INFT transferable means reputation transferable. |
| **0G DA** | Job event log (production scale path beyond the v0.1 indexer cache). |

***

## Next

* [Job state machine](state-machine.md)
* [TEE attestation in detail](attestation.md)
* [Reputation INFT](reputation.md)
