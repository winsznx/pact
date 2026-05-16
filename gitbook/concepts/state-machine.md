---
description: The strict transition graph every job moves through.
---

# Job state machine

Every job moves through this transition graph. Each transition emits an event, is verifiable on chainscan, and is mirrored by the frontend in real time.

***

## The diagram

```
                ┌─── reclaimExpired() ────► Expired
                │       (after timeout, buyer reclaims escrow)
   Pending ─────┤
   (createJob)  │                                      ┌─── arbitrate() ───► Settled
                │                                      │       (dispute fails: 90% to seller, 10% protocol)
                └── submitAttestation() ──► Attested ──┤
                       (TEE sig verified)              │
                                                      ├─── (24h passes) ───► Settled
                                                      │       (95% seller / 5% protocol)
                                                      │
                                                      └─── dispute() ───► Disputed
                                                                            │
                                                                            ├─► Settled (dispute fails: 90% / 10%)
                                                                            └─► Slashed (dispute wins: bond → 70% disputer, 20% protocol, 10% burned)
```

***

## The enum

```solidity
enum JobState {
    Pending,   // 0  escrow locked, awaiting seller attestation
    Sealed,    // 1  committed (legacy state, kept for ordering invariant)
    Attested,  // 2  TEE signature verified on chain, awaiting dispute window
    Settled,   // 3  payout complete, 95% to seller
    Expired,   // 4  timeout reached, escrow reclaimed by buyer
    Disputed,  // 5  settlement challenged, awaiting arbitration
    Slashed    // 6  dispute won, seller's bond redistributed
}
```

JS mirror: [`JobState`](https://github.com/winsznx/pact/blob/main/packages/sdk/src/types.ts) in `@trypact/sdk`.

***

## Transition rules

| From | To | Function | Who can call | What happens |
| --- | --- | --- | --- | --- |
| `Pending` | `Attested` | `submitAttestation` | seller | `AttestationVerifier.verify` runs inline. Succeeds only if ECDSA recovery matches `signingAddress`. |
| `Pending` | `Expired` | `reclaimExpired` | anyone (after `timeout`) | Buyer's escrow returned in full. |
| `Attested` | `Settled` | implicit after 24h, or `arbitrate` resolution | anyone | 95% to seller, 5% to protocol fee accrues. |
| `Attested` | `Disputed` | `dispute` | anyone (with dispute bond) | Freezes settlement, opens arbitration window. |
| `Disputed` | `Settled` | `arbitrate` (dispute fails) | arbiter | 90% to seller, 10% to protocol (anti griefing). |
| `Disputed` | `Slashed` | `arbitrate` (dispute wins) | arbiter | Seller's bond goes 70% disputer, 20% protocol, 10% burned. |

***

## Why state matters for SDK users

Only state ≥ `Attested` (value 2) carries a meaningful `attestationText` and `attestationSignature`. Verifying earlier states is a no op. The SDK's `pact.run()` blocks until state == `Settled` and then runs verification. `result.verified.ok` is meaningful only for settled jobs.

For inspecting historical jobs:

```ts
const job = await pact.jobs.get(2n);
if (job.state === JobState.Settled) {
  const verified = await pact.attestations.verify({
    text: job.attestationText,
    signature: job.attestationSignature,
    expectedSigner: (await pact.services.get(job.serviceId)).signingAddress,
  });
  console.log(verified.ok);
}
```

***

## Source

* `enum JobState`: [`packages/contracts/src/PactEscrow.sol`](https://github.com/winsznx/pact/blob/main/packages/contracts/src/PactEscrow.sol)
* JS mirror: [`packages/sdk/src/types.ts`](https://github.com/winsznx/pact/blob/main/packages/sdk/src/types.ts)
* Live state machine UI: [`apps/web/src/components/jobs/JobStateMachine.tsx`](https://github.com/winsznx/pact/tree/main/apps/web/src/components/jobs)

***

## Next

* [TEE attestation in detail](attestation.md)
* [Economics (slash splits, fees)](economics.md)
