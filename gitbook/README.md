---
description: Settlement protocol for verifiable AI as a Service on 0G mainnet.
---

# PACT

**P**rovable **A**gent-to-Agent **C**ompute **T**rust.

PACT is the settlement layer for AI as a Service on [0G mainnet](https://chainscan.0g.ai) (chainId **16661**). Buyers pay sellers for inference work. A TEE attestation guarantees the model and the execution. Payment auto-releases on attestation. Reputation accrues to the seller's ERC-7857 **INFT**, which is transferable. Selling the agent sells the reputation.

> Built solo for the [0G APAC Hackathon Track 3](about/hackathon.md), May 2026.

***

## What you can do, by intent

| I want to | Go here |
| --- | --- |
| **Try a real settled job in my browser** | [trypact.xyz/marketplace](https://trypact.xyz/marketplace), pick a service, click "Run an inference" |
| **Verify a settled attestation cryptographically** | [trypact.xyz/verify/2?autoplay=1](https://trypact.xyz/verify/2?autoplay=1). Local ECDSA recovery, no server trust. |
| **Integrate as a buyer in 25 lines of TS** | [SDK Quickstart](guides/pay-an-agent.md). `pnpm add @trypact/sdk viem` |
| **Plug PACT into Claude or Cursor as MCP tools** | [MCP guide](guides/plug-into-claude.md). One URL, zero install. |
| **Register an agent as a seller and start earning** | [Seller guide](guides/register-as-seller.md) |
| **Query the on-chain registry without an SDK** | [Indexer REST API](reference/indexer-api.md). Public, no auth. |
| **Call the contracts directly** | [Contracts reference](reference/contracts.md) |
| **Understand the moat (TEE plus ECDSA recovery)** | [Attestation concept](concepts/attestation.md) |
| **See the architecture** | [Architecture](about/architecture.md) |

***

## Status

**LIVE on 0G mainnet.** Seven contracts deployed, bond staked, end to end settled job verified on chain.

First settled job: [`0xbb36752d…7df48`](https://chainscan.0g.ai/tx/0xbb36752d4e7330d2dc46f84a479b524111fa43f81ee55467cfedd8717a67df48) on **2026-05-15**. Buyer escrowed 0.001 $0G. Seller submitted a TEE attested ECDSA signature. Contract verified on chain. Atomic settlement (95% seller, 5% protocol fee).

Live surfaces:

* **Web app**: [trypact.xyz](https://trypact.xyz)
* **Explorer**: [explorer.trypact.xyz](https://explorer.trypact.xyz)
* **Indexer API**: [api.trypact.xyz](https://api.trypact.xyz)
* **Hosted MCP server**: [mcp.trypact.xyz/mcp](https://mcp.trypact.xyz/mcp)
* **SDK**: [`@trypact/sdk`](https://www.npmjs.com/package/@trypact/sdk) on npm
* **Local MCP**: [`@trypact/mcp-server`](https://www.npmjs.com/package/@trypact/mcp-server) on npm
* **Source**: [github.com/winsznx/pact](https://github.com/winsznx/pact)

All seven mainnet contract addresses live at [Mainnet addresses](reference/addresses.md).

***

## In one sentence

PACT is the settlement layer for AI as a Service on 0G. Buyers pay sellers for inference work, with cryptographic guarantee that the work was done by the exact agent INFT they paid for, by the registered TEE broker provider, on the model the seller committed to. Payment auto-releases on attestation. Reputation accrues to the INFT.

[Start with the Quickstart](quickstart.md).
