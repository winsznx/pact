---
description: System diagram, contract layout, and the role of each 0G primitive.
---

# Architecture

***

## The big picture

```
                   ┌────────────────────────────────────────────────┐
                   │             0G MAINNET (chainId 16661)         │
                   │                                                │
                   │   ┌─────────────────┐    ┌──────────────────┐  │
   Buyer ──pay──▶  │   │   PactEscrow    │◄───┤ AttestationVerif │  │
                   │   │  (escrow + jobs)│    │ (EIP-191 + ECDSA)│  │
                   │   └────────┬────────┘    └──────────────────┘  │
                   │            │ atomic settle (95 / 5)            │
                   │            ▼                                   │
                   │   ┌─────────────────┐    ┌──────────────────┐  │
                   │   │  PactRegistry   │    │ SlashingArbiter  │  │
                   │   │ (Service + INFT)│    │ (bond + dispute) │  │
                   │   └────────┬────────┘    └────────┬─────────┘  │
                   │            │                     │             │
                   │            ▼                     │             │
                   │   ┌─────────────────┐            │             │
                   │   │ ReputationVault │◄───────────┘             │
                   │   │ (sqrt-weighted, │   slash on fraud →       │
                   │   │  INFT-bound)    │     bond redistributed   │
                   │   └─────────────────┘                          │
                   │            ▲                                   │
                   │            │ tokenURI / ownerOf                │
                   │   ┌─────────────────┐                          │
                   │   │   AgentNFT      │                          │
                   │   │   (ERC-7857)    │                          │
                   │   └─────────────────┘                          │
                   └────────────────────────────────────────────────┘
                                          ▲
                              JobCreated  │  submitAttestation
                                          │
            ┌─────────────────────────────┴───────────────────────────┐
            │           Seller reference agent (Node.js)              │
            │                                                         │
            │   poll PactEscrow.nextJobId every 3s                    │
            │      │                                                  │
            │      ▼                                                  │
            │   ┌──────────────────────────────┐    ┌───────────────┐ │
            │   │ @0gfoundation/0g-compute-sdk │───►│  0G Compute   │ │
            │   │  - acknowledgeProviderSigner │    │  Direct broker│ │
            │   │  - chat/completions          │    │  (TEE)        │ │
            │   │  - GET /signature/{chatId}   │◄───│               │ │
            │   └──────────────┬───────────────┘    └───────────────┘ │
            │                  ▼                                      │
            │   viem.recoverMessageAddress (local sanity check)       │
            │                  │                                      │
            │                  ▼                                      │
            │   PactEscrow.submitAttestation(jobId, outputRoot,       │
            │       chatId, text, signature)                          │
            └─────────────────────────────────────────────────────────┘
```

***

## Contracts

Seven mainnet contracts. See [Mainnet addresses](../reference/addresses.md) for every address. NatSpec on every external function. Foundry tests, 56 of 56 passing.

| Contract | Role |
| --- | --- |
| **PactRegistry** | Source of truth for services (modelId, signingAddress, providerAddress, pricePerCall, etc.). Single seller can list many services. |
| **PactEscrow** | Per call escrow lifecycle. `createJob`, `submitAttestation`, `reclaimExpired`, `dispute`. State machine lives here. |
| **AttestationVerifier** | The crypto. `ECDSA.recover(text, signature) == signingAddress` check. Called inline from `submitAttestation`. |
| **ReputationVault** | Sqrt weighted reputation by buyer volume. INFT bound. Updates atomically on settlement. |
| **SlashingArbiter** | Bond custody and slash logic. 70/20/10 split on successful dispute, 90/10 on failed dispute. |
| **AgentNFT (proxy + impl)** | ERC-7857 INFT for seller identity. Transferable. The reputation accumulator is bound to `tokenId`, not `wallet`. |

***

## Off chain components

| App | Role |
| --- | --- |
| **`apps/web`** | Next.js 16 frontend. Landing, marketplace, jobs, verify, explorer, seller dashboard. Deployed to Vercel at trypact.xyz. |
| **`apps/seller-reference`** | Reference seller agent. Watches `JobCreated`, calls 0G Compute Direct broker, submits TEE attestation. Long running Node process. |
| **`apps/indexer`** | Read cache. Polls events, exposes REST at api.trypact.xyz. Deployed to Railway. |
| **`apps/mcp-http`** | Hosted MCP server. Exposes 4 read tools at mcp.trypact.xyz. Deployed to Railway alongside the indexer. |

| Package | Role |
| --- | --- |
| **`packages/contracts`** | Foundry workspace. Solidity 0.8.24 + cancun. All contract source, tests, deploy scripts. |
| **`packages/sdk`** | `@trypact/sdk` on npm. Buyer TypeScript SDK. |
| **`packages/mcp-server`** | `@trypact/mcp-server` on npm. Local stdio MCP server (full five tools including `run`). |
| **`packages/shared`** | Workspace shared addresses, ABIs, chain config. |

***

## Five 0G primitives

Each is structurally necessary. Remove any one and something breaks.

| Primitive | Role | What breaks without it |
| --- | --- | --- |
| **0G Chain** | All settlement, all events | The entire protocol is just gone. |
| **0G Compute** | TEE attested inference via Direct broker. Source of the `text` + `signature` every settlement requires. | No verifiable inference. The "T" in TEE stops being load bearing. |
| **0G Storage** | Encrypted output blobs and KV reputation history (v0.2 path). | Buyers can't retrieve outputs at scale. v0.1 uses local handoff. |
| **ERC-7857 INFT** | Seller identity and reputation accumulator. | Reputation becomes wallet bound, not agent bound. Transferring an agent loses its history. |
| **0G DA** | Production scale job event log (v0.2). | The indexer cache works for v0.1, but production scale needs the DA path. |

***

## Why this shape

* **Commit reveal ordering.** Buyer commits input on `createJob` before seller can see it. Seller commits output and attestation on `submitAttestation` before revealing output. Settlement is atomic with verification. Kills the obvious griefing vectors.
* **Verification on chain plus client side.** Same primitive, both places. Anyone can verify without trusting the operator.
* **Reputation on the agent, not the wallet.** INFT transferable means reputation transferable. Sell the agent, sell the reputation.
* **Bond slashable only on cryptographic fraud.** Output quality, model behavior, latency, none of those slash. They live in reputation. Slashing applies to verifiable facts, not subjective judgments.

***

## Source

* All Solidity: [`packages/contracts/src/`](https://github.com/winsznx/pact/tree/main/packages/contracts/src)
* Foundry tests: [`packages/contracts/test/`](https://github.com/winsznx/pact/tree/main/packages/contracts/test)
* Frontend: [`apps/web/`](https://github.com/winsznx/pact/tree/main/apps/web)
* SDK: [`packages/sdk/`](https://github.com/winsznx/pact/tree/main/packages/sdk)
