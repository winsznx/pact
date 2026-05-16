---
description: Fees, bonds, slash splits, and the sqrt weighted reputation math.
---

# Economics

All numbers below are exact on chain constants. Every value is referenced by file:line so you can verify against source.

***

## At a glance

| What | Value | Source |
| --- | --- | --- |
| Protocol fee | **5%** of every settled job (95% to seller) | `PactEscrow.PROTOCOL_FEE_BPS = 500` |
| Minimum seller bond | **5 $0G** per service | `SlashingArbiter.MIN_BOND = 5e18` |
| Successful slash split | **70% disputer / 20% protocol / 10% burned** | `SlashingArbiter.SLASH_DISPUTER_BPS = 7000` |
| Failed dispute split | **90% to seller / 10% protocol** (anti griefing) | `SlashingArbiter` |
| Dispute window | **24h after Settled** | `PactEscrow` |
| Default job timeout | Buyer specified (typical 300s) | `createJob.timeout` |
| Buyer reputation weight | **`sqrt(buyer_total_paid_wei)`** | `ReputationVault.getBuyerWeight` |

***

## Per call settlement

On a successful inference call where the seller's attestation verifies on chain:

```
buyer pays:       pricePerCall (locked at createJob)
seller receives:  pricePerCall × 0.95
protocol fee:     pricePerCall × 0.05  (accrues to PactEscrow, sweepable to treasury)
```

There is no per call gas fee on the seller. The buyer pays gas for `createJob` (one tx). The seller pays gas for `submitAttestation` (one tx). On 0G mainnet this is about 0.001 $0G per side at the recommended 4 gwei.

***

## Bond economics

Sellers stake a minimum 5 $0G to `SlashingArbiter` per service. The bond is the slashable collateral that makes the "if the TEE signature doesn't match, you lose money" claim real.

* Bond stays bonded for the life of the service.
* Sellers can top up bond at any time. `stakeBond` is idempotent and additive.
* Bond is reclaimable via `requestWithdrawal`, wait the withdrawal cooldown, then `withdrawBond`. This window exists to prevent front running a fraud disputer with a withdrawal.

***

## Slashing math

When a dispute succeeds (recovered signer is not the registered `signingAddress`):

```
bond_slashed = current_bond_balance

→ 70% to disputer  (incentive to challenge fraud)
→ 20% to protocol  (treasury, future arbiter incentives)
→ 10% burned       (deflationary, prevents collusion between disputer and treasury)
```

When a dispute fails (settled attestation was actually authentic):

```
disputer's dispute bond is forfeit:

→ 90% to seller    (compensation for the operational disruption)
→ 10% to protocol  (anti griefing fee)
```

This asymmetry, where successful disputes pay more, is the incentive aligning honest disputers to file claims while making frivolous disputes expensive.

***

## Why sqrt buyer weight

Reputation contribution per buyer is `sqrt(buyer's lifetime $0G spent across all services)`. Effects:

* A buyer who spends $1 has weight `sqrt(1e18) ≈ 1e9`.
* A buyer who spends $4 has weight `sqrt(4e18) ≈ 2e9` (only 2 times, not 4 times).
* A buyer who spends $100 has weight `sqrt(100e18) ≈ 10e9` (10 times over $1, not 100 times).

So:

* **Sybil resistance.** A malicious seller spinning 1,000 brand new wallets to self settle achieves `1000 × sqrt(small)` which is still small. They'd need to spend real volume to fake real reputation.
* **No whale dominance.** A single huge buyer can't single handedly own a service's score.

The math is implemented as `babylonianSqrt` in [`ReputationVault.sol`](https://github.com/winsznx/pact/blob/main/packages/contracts/src/ReputationVault.sol).

***

## What's NOT charged

* No listing fee for sellers. Registration is free apart from gas plus bond.
* No fee to read the registry, get a service, or verify an attestation.
* No fee to use the hosted MCP server or the indexer API.
* No fee to read the contracts directly.

The only fee is 5% of settled job value, paid at settlement time, on chain, atomic.

***

## Source

* `PROTOCOL_FEE_BPS`: [`packages/contracts/src/PactEscrow.sol`](https://github.com/winsznx/pact/blob/main/packages/contracts/src/PactEscrow.sol)
* `MIN_BOND`, `SLASH_*_BPS`: [`packages/contracts/src/SlashingArbiter.sol`](https://github.com/winsznx/pact/blob/main/packages/contracts/src/SlashingArbiter.sol)
* `getBuyerWeight`, `babylonianSqrt`: [`packages/contracts/src/ReputationVault.sol`](https://github.com/winsznx/pact/blob/main/packages/contracts/src/ReputationVault.sol)

***

## Next

* [Architecture](../about/architecture.md)
* [Contracts reference](../reference/contracts.md)
