---
description: 0G APAC Hackathon Track 3 submission.
---

# Hackathon submission

PACT was built for the **0G APAC Hackathon Track 3** (Agentic Economy & Autonomous Applications). Sub themes: financial rails plus operational tools. Submission deadline: May 16, 2026, 23:59 UTC+8.

Full rubric mapping: [`docs/MASTER_PRD.md §1.2`](https://github.com/winsznx/pact/blob/main/docs/MASTER_PRD.md).

***

## What we claim

| HackQuest criterion | Our claim |
| --- | --- |
| 0G integration depth | 5 of 5 primitives, each structurally necessary. See [Architecture](architecture.md). |
| Technical completeness | 7 mainnet contracts. 56 of 56 Foundry tests passing. End to end demo loop verified on chain (first settled job: [`0xbb36752d…7df48`](https://chainscan.0g.ai/tx/0xbb36752d4e7330d2dc46f84a479b524111fa43f81ee55467cfedd8717a67df48)). |
| Product fit | Fills 0G's own published roadmap gap (the "AI Agent Marketplace coming soon"). |
| UX and demo | Three shareable demo moments. Premium B2B aesthetic. Every tx visible on chainscan. |
| Team and docs | This GitBook, NatSpec on every external function, ~14 day commit history, judge reproducible README. |

***

## What's shipped (v0.1)

* 7 mainnet contracts (see [Mainnet addresses](../reference/addresses.md))
* 56 of 56 Foundry tests
* Buyer TypeScript SDK on npm: [@trypact/sdk](https://www.npmjs.com/package/@trypact/sdk)
* Local stdio MCP server on npm: [@trypact/mcp-server](https://www.npmjs.com/package/@trypact/mcp-server)
* Hosted MCP server at [mcp.trypact.xyz](https://mcp.trypact.xyz/mcp)
* Indexer REST cache at [api.trypact.xyz](https://api.trypact.xyz)
* Web app at [trypact.xyz](https://trypact.xyz) with marketplace, jobs, verify viz, explorer, seller dashboard
* This GitBook at [docs.trypact.xyz](https://docs.trypact.xyz)
* Reference seller agent ([`apps/seller-reference/`](https://github.com/winsznx/pact/tree/main/apps/seller-reference))

***

## What's v0.2

| Capability | v0.1 (shipped) | v0.2 |
| --- | --- | --- |
| 0G Storage for encrypted output blobs | Local handoff | Encrypted blob via `0g-storage-client` |
| 0G DA for job event log at scale | Indexer cache | Production scale audit trail |
| Multi seller marketplace (beyond Service 1) | Single seller in scope | Open registration via UI |
| Reputation lease and INFT secondary market | Read paths wired | INFT marketplace integration |

Tracked in [`docs/MASTER_PRD.md`](https://github.com/winsznx/pact/blob/main/docs/MASTER_PRD.md) §22 (Roadmap).

***

## Demo

* Live web app: [trypact.xyz](https://trypact.xyz)
* Live verify page: [trypact.xyz/verify/2?autoplay=1](https://trypact.xyz/verify/2?autoplay=1)
* Source: [github.com/winsznx/pact](https://github.com/winsznx/pact)
* 5 minute demo script: [`docs/DEMO_SCRIPT.md`](https://github.com/winsznx/pact/blob/main/docs/DEMO_SCRIPT.md)

***

## Built by

Tim ([@winsznx](https://github.com/winsznx)). Solo. 14 days. PRs welcome.
