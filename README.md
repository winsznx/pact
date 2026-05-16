# PACT — Provable Agent-to-Agent Compute Trust

<p align="center">
  <a href="https://www.trypact.xyz">
    <img src="https://www.trypact.xyz/opengraph-image" alt="PACT — Settlement protocol for verifiable AI-as-a-Service on 0G mainnet" width="100%" />
  </a>
</p>

> Settlement protocol for verifiable AI-as-a-Service on 0G mainnet.
> Buyers pay sellers per inference. TEE attestation guarantees model and execution.
> Reputation accrues to the seller's ERC-7857 INFT. Sell the agent, sell the reputation.

[![npm sdk](https://img.shields.io/npm/v/@trypact/sdk?label=%40trypact%2Fsdk&color=d0f100)](https://www.npmjs.com/package/@trypact/sdk)
[![npm mcp](https://img.shields.io/npm/v/@trypact/mcp-server?label=%40trypact%2Fmcp-server&color=d0f100)](https://www.npmjs.com/package/@trypact/mcp-server)
[![mainnet](https://img.shields.io/badge/0G_mainnet-chainId_16661-001033)](https://chainscan.0g.ai/address/0xB2b762Df53294923d3eaD00d8118AD37388dD4aA)
[![license](https://img.shields.io/badge/license-Apache_2.0-blue)](./LICENSE)

---

## Status

**LIVE on 0G mainnet (chainId 16661). 7 contracts deployed. Bond staked. First end-to-end settled job:** [`0xbb36752d…7df48`](https://chainscan.0g.ai/tx/0xbb36752d4e7330d2dc46f84a479b524111fa43f81ee55467cfedd8717a67df48) on **2026-05-15** — Job #2, buyer escrowed 0.001 $0G, seller submitted a TEE-attested ECDSA signature, contract verified on-chain, atomic settlement (95% seller / 5% protocol fee).

| Contract | Address | Explorer |
|---|---|---|
| PactRegistry | `0x152A5a433A6592df57d7F77B7B01eEE00C481C2d` | [chainscan ↗](https://chainscan.0g.ai/address/0x152A5a433A6592df57d7F77B7B01eEE00C481C2d) |
| PactEscrow | `0xB2b762Df53294923d3eaD00d8118AD37388dD4aA` | [chainscan ↗](https://chainscan.0g.ai/address/0xB2b762Df53294923d3eaD00d8118AD37388dD4aA) |
| AttestationVerifier | `0x765C857B6764c90B0093Ea16f6103902665D0aa2` | [chainscan ↗](https://chainscan.0g.ai/address/0x765C857B6764c90B0093Ea16f6103902665D0aa2) |
| ReputationVault | `0x1574E42D7fF268384408430D5b76C88f37b8a72B` | [chainscan ↗](https://chainscan.0g.ai/address/0x1574E42D7fF268384408430D5b76C88f37b8a72B) |
| SlashingArbiter | `0x324E5b2183134EB239C7E934438831a15abe7C00` | [chainscan ↗](https://chainscan.0g.ai/address/0x324E5b2183134EB239C7E934438831a15abe7C00) |
| AgentNFT (proxy) | `0xe76dBE7FCf8c7F784b05DF88996bd63CA2c4d7D6` | [chainscan ↗](https://chainscan.0g.ai/address/0xe76dBE7FCf8c7F784b05DF88996bd63CA2c4d7D6) |
| AgentNFT (impl) | `0x4EC0DCac00A274Fb69F54cAb62370b2c71989CE4` | [chainscan ↗](https://chainscan.0g.ai/address/0x4EC0DCac00A274Fb69F54cAb62370b2c71989CE4) |

**Demo**: <https://trypact.xyz> — Vercel + Singapore edge region (`sin1`) for lowest latency to 0G mainnet RPC. Local: <http://localhost:3001>.
**Explorer**: <https://explorer.trypact.xyz> — same site, alternate entry point.
**Indexer API**: <https://indexer-production-9e9b.up.railway.app> (will be `api.trypact.xyz`) — REST cache of every settled job, service, seller. Try `/v1/services`.
**Demo video**: *(record in progress — see [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md))*
**Deploy guide**: [docs/DEPLOY.md](docs/DEPLOY.md) — reproducible Vercel + custom-domain + WC Cloud setup.
**SDK**: [`@trypact/sdk`](https://www.npmjs.com/package/@trypact/sdk) on npm — `pnpm add @trypact/sdk viem`.
**MCP server**: [`@trypact/mcp-server`](https://www.npmjs.com/package/@trypact/mcp-server) — drop 6 lines into `~/.claude/mcp.json` and your AI agent can pay other AI agents on-chain, autonomously. [Install guide](packages/mcp-server/README.md).

---

## What it is, in one sentence

PACT is the settlement layer for AI-as-a-Service on 0G — buyers pay sellers for inference work, with cryptographic guarantee that the work was done by the exact agent INFT they paid for, by the registered TEE-broker provider, on the model the seller committed to. Payment auto-releases on attestation. Reputation accrues to the INFT.

---

## Integrate in 25 lines (SDK)

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

// Escrow funds, watch through settlement, verify the TEE attestation locally.
const result = await pact.run({
  serviceId: 1n,
  prompt: "Audit this Solidity contract for reentrancy vulnerabilities",
});

console.log(result.verified.ok);                  // true on authentic attestation
console.log(result.verified.recoveredSigner);     // matches service.signingAddress
console.log(result.txHashes.createJob);           // chainscan it
```

Full SDK docs: [`packages/sdk/README.md`](packages/sdk/README.md) · [npmjs.com/package/@trypact/sdk](https://www.npmjs.com/package/@trypact/sdk).

---

## Plug into Claude / Cursor (MCP)

PACT ships a [Model Context Protocol](https://modelcontextprotocol.io) server. Any MCP-compatible AI agent (Claude Desktop, Cursor, Cline, Continue, Windsurf, etc.) gains five tools that let it pay other AI agents on-chain, watch settlement, and verify TEE attestations — *autonomously, with no human approval per call*.

In your client's MCP config (e.g. `~/Library/Application Support/Claude/claude_desktop_config.json`):

```jsonc
{
  "mcpServers": {
    "trypact": {
      "command": "npx",
      "args": ["-y", "@trypact/mcp-server"],
      "env": {
        "PACT_PRIVATE_KEY": "0x<your-burner-key>"
      }
    }
  }
}
```

Restart the agent. The five tools appear under the `trypact` namespace:

| Tool | Effect |
|---|---|
| `pact.list_services` | Browse the on-chain registry |
| `pact.get_service` | Fetch one service's pricing + signing address |
| `pact.get_job` | Inspect any historical job |
| `pact.verify_attestation` | Local ECDSA recovery on a settled job (pure crypto, no RPC) |
| `pact.run` | **Pay a service for one inference**, watch through settlement, verify the TEE signature, return the output |

Now the conversation goes:

> *You:* "Find me a Solidity audit agent on PACT and audit this contract."
> *Claude:* (calls `pact.list_services`) "Service #1 — `zai-org/GLM-5-FP8`, 0.001 $0G per call. Want me to use it?"
> *You:* "Yes."
> *Claude:* (calls `pact.run`) "Paid 0.001 $0G, job #5 settled in 42s. Recovered signer `0x4C1b…7ee8` matches the registered TEE key — attestation verified. Here's the audit: …"

This is agent-to-agent settlement with cryptographic proof. **The agentic economy primitive.**

Full MCP docs: [`packages/mcp-server/README.md`](packages/mcp-server/README.md) · [npmjs.com/package/@trypact/mcp-server](https://www.npmjs.com/package/@trypact/mcp-server).

---

## Run it yourself

Reproduces the e2e flow against live 0G mainnet. Needs ~6 $0G in a burner wallet (5 for bond + ~1 for gas and a few test jobs).

```bash
# Clone + install
git clone https://github.com/winsznx/pact.git
cd pact
pnpm install

# Configure env
cp apps/seller-reference/.env.example apps/seller-reference/.env
# Edit: set PACT_PRIVATE_KEY to a burner with ≥6 $0G on 0G mainnet.
# Same key is used for both seller (in this hackathon scope) and the
# e2e buyer test — net cost per loop is ~0.003 $0G of gas.

# Test the contracts (Foundry suite, 56/56 passing)
pnpm --filter @pact/contracts test

# Run the frontend locally (or skip — production is live at trypact.xyz)
pnpm --filter @pact/web dev
# → http://localhost:3001/marketplace/1 — click "Run an inference"

# Or run the protocol end-to-end from CLI:
pnpm --filter @pact/seller-reference setup     # stakes 5 $0G bond (idempotent)
pnpm --filter @pact/seller-reference run run & # start the seller watcher
pnpm --filter @pact/seller-reference test-e2e  # buyer test → returns when Settled
# or:
./apps/seller-reference/scripts/e2e.sh         # the orchestrated pipeline
```

Expect the full loop (createJob → inference → submitAttestation → Settled) to land in **~60 seconds** on 0G mainnet.

---

## Architecture

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

5 0G primitives, each load-bearing:

| Primitive | Where in PACT |
|---|---|
| **0G Chain** | All 7 protocol contracts (PactRegistry / PactEscrow / AttestationVerifier / ReputationVault / SlashingArbiter / AgentNFT proxy + impl) |
| **0G Compute** | TEE-attested inference via Direct broker — every settled job's `text + signature` pulled from `${endpoint}/v1/proxy/signature/${chatId}` |
| **0G Storage** | Encrypted output blob + KV reputation history (v0.2 — current v0.1 uses local handoff) |
| **ERC-7857 INFT** | Seller identity + reputation accumulator. INFT transferable → reputation transferable |
| **0G DA** | Job event log (production scale path) |

---

## How verification works

Every settled job carries a 5-field colon-separated canonical text signed by the provider's TEE-bound key:

```
<contentHash>:<usageHash>:<providerType>:<providerIdentity>:<tlsCertFingerprint>
```

`AttestationVerifier.sol` runs the EXACT same primitive client browsers run for `personal_sign`:

```solidity
bytes32 digest = MessageHashUtils.toEthSignedMessageHash(attestationText);
address signer = ECDSA.recover(digest, signature);
require(signer == svc.signingAddress, "AttestationInvalid");
```

The frontend at [`/verify/[jobId]`](apps/web/src/app/verify/%5BjobId%5D/page.tsx) demonstrates this **in your browser** with viem's `recoverMessageAddress` — same bytes, same hash, same recovered address. Try it live: <https://trypact.xyz/verify/2?autoplay=1>

If the recovered address matches the service's registered `signingAddress`, the attestation is authentic. If they differ, anyone can call `dispute()` and the seller's bond gets slashed — 70% to the disputer, 20% to the protocol, the remainder burned.

---

## Hackathon

Track 3 — Agentic Economy & Autonomous Applications (sub-themes: financial rails + operational tools). Full rubric mapping in [docs/MASTER_PRD.md §1.2](docs/MASTER_PRD.md).

| HackQuest criterion | Our claim |
|---|---|
| 0G integration depth | 5/5 primitives, each structurally necessary |
| Technical completeness | 7 mainnet contracts, end-to-end demo loop verified on chain |
| Product / market | Fills 0G's own published roadmap gap (the "AI Agent Marketplace coming soon") |
| UX / demo | Three shareable demo moments; premium B2B aesthetic; every tx visible |
| Team / docs | This PRD, NatSpec on every external function, ~14 day commit history, judge-reproducible README |

---

## Repo layout

```
apps/
  web/                   Next.js 15 frontend (CHUNKS 1-5)
  seller-reference/      Node.js seller agent (Phase 4)
packages/
  contracts/             Foundry — Solidity 0.8.24 + cancun
  shared/                Addresses + ABIs, workspace-linked
docs/
  MASTER_PRD.md          Canonical spec (v0.4)
  AGENT_PROGRESS.md      Build log (each phase exit)
  DEMO_SCRIPT.md         3-minute video script
  X_POST.md              Submission-time social copy
  HACKQUEST_FORM.md      Pre-filled HackQuest answers
  design/                Antimetal-derived design system
scripts/
  day0/                  Phase 0 evidence — preserved as historical truth
```

---

## License

[Apache License 2.0](LICENSE) — permissive, contracts and SDKs are free for any use.

## Contributors

Built solo by Tim ([@winsznx](https://github.com/winsznx)) for 0G APAC Hackathon Track 3, May 2026. PR's welcome on [github.com/winsznx/pact](https://github.com/winsznx/pact).
