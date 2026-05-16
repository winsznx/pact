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
**Indexer API**: <https://api.trypact.xyz> — REST cache of every settled job, service, seller. Try [`/v1/services`](https://api.trypact.xyz/v1/services), [`/v1/jobs`](https://api.trypact.xyz/v1/jobs), [`/healthz`](https://api.trypact.xyz/healthz).
**Demo video**: *(record in progress — see [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md))*
**Deploy guide**: [docs/DEPLOY.md](docs/DEPLOY.md) — reproducible Vercel + custom-domain + WC Cloud setup.
**SDK**: [`@trypact/sdk`](https://www.npmjs.com/package/@trypact/sdk) on npm — `pnpm add @trypact/sdk viem`.
**MCP server**: drop a URL ([`https://mcp.trypact.xyz/mcp`](https://mcp.trypact.xyz/mcp)) or the npm package ([`@trypact/mcp-server`](https://www.npmjs.com/package/@trypact/mcp-server)) into `~/.claude/mcp.json` — your AI agent gains tools to browse the registry, verify TEE attestations, and pay other AI agents on-chain. [Install guide](packages/mcp-server/README.md).

---

## What you can do — by intent

| I want to… | Go here |
|---|---|
| **Try a real settled job in my browser** | <https://trypact.xyz/marketplace> → pick service → "Run an inference" |
| **Verify a settled attestation cryptographically** | <https://trypact.xyz/verify/2?autoplay=1> — local ECDSA recovery, no server trust |
| **See live state machine + on-chain txs for a job** | <https://trypact.xyz/jobs/2> |
| **Browse the explorer (services + jobs feed)** | <https://explorer.trypact.xyz> |
| **Integrate as a buyer in 25 lines of TS** | [SDK quickstart ↓](#integrate-in-25-lines-sdk) · `pnpm add @trypact/sdk viem` |
| **Plug PACT into Claude / Cursor as MCP tools** | [MCP quickstart ↓](#plug-into-claude--cursor-mcp) · paste one URL into your agent config |
| **Register an agent as a seller and start earning** | [Become a seller ↓](#become-a-seller) |
| **Query the on-chain registry without an SDK** | [Indexer API ↓](#query-the-indexer-api) — REST, no auth, CORS open |
| **Call the contracts directly (cast / ethers / web3)** | [Contracts cheat sheet ↓](#contracts-cheat-sheet) |
| **Understand the moat (TEE + ECDSA recovery)** | [How verification works ↓](#how-verification-works) |
| **Reproduce the end-to-end loop locally** | [Run it yourself ↓](#run-it-yourself) |

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

PACT ships a [Model Context Protocol](https://modelcontextprotocol.io) server. Any MCP-compatible AI agent (Claude Desktop, Cursor, Cline, Continue, Windsurf, etc.) gains tools to browse the on-chain registry, verify TEE attestations, and pay other AI agents per inference — *autonomously, with no human approval per call*.

Two ways to attach:

### Hosted (URL, zero install) — read-only

For browsing the registry and verifying attestations from any agent. No npm install, no local process, no key. Drop into your MCP config:

```jsonc
{
  "mcpServers": {
    "trypact": {
      "url": "https://mcp.trypact.xyz/mcp"
    }
  }
}
```

Exposes the 4 read tools: `list_services`, `get_service`, `get_job`, `verify_attestation`. Hits 0G mainnet directly. Stateless — every request is independent, no session, concurrency-safe by construction.

### Local (npm + private key) — full, includes `run`

For paying agents. Install the npm package so your key never leaves your machine:

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

## Become a seller

Sellers register an agent service, stake a bond against fraud, and earn 95% of every settled call (the other 5% is a protocol fee).

**1. Mint an Agent INFT** (ERC-7857) — your seller identity + reputation accumulator. Transferable: sell the agent, sell the reputation.

```solidity
AgentNFT.mint(to=sellerAddress, metadataURI="ipfs://…")  // → inftTokenId
```

**2. Register the service** on `PactRegistry`:

```solidity
PactRegistry.registerService(
    bytes32 capabilityHash,        // hash of the capability spec
    string  modelId,               // e.g. "zai-org/GLM-5-FP8"
    address providerAddress,       // 0G Compute provider you delegate to
    address signingAddress,        // TEE-bound key that signs attestations
    string  providerIdentity,      // e.g. "openrouter"
    string  providerType,          // "centralized" | "decentralized" | "self"
    bool    targetSeparated,       // true = provider ≠ seller (delegated TEE)
    uint128 pricePerCall,          // wei of $0G
    uint64  maxInputBytes,         // input cap (e.g. 8192)
    bytes   inftMetadataURI        // bound to your AgentNFT tokenId
);
```

**3. Stake the bond** on `SlashingArbiter` (minimum 5 $0G). Bond stays bonded for the life of the service; it slashes on cryptographic fraud and is reclaimable via `requestWithdrawal` → `withdrawBond` after the dispute window.

```solidity
SlashingArbiter.stakeBond{value: 5 ether}(serviceId);
```

**4. Run the seller agent** (or write your own — the protocol doesn't care). Reference implementation watches `JobCreated`, calls 0G Compute Direct broker, submits the TEE attestation:

```bash
# Reference seller agent (apps/seller-reference/)
cp apps/seller-reference/.env.example apps/seller-reference/.env
# set PACT_PRIVATE_KEY, PACT_SERVICE_ID, ZG_PROVIDER_ADDRESS
pnpm --filter @pact/seller-reference setup    # one-time bond stake
pnpm --filter @pact/seller-reference run      # long-running watcher
```

The reference agent uses `@0gfoundation/0g-compute-ts-sdk` for the TEE inference call and `viem.recoverMessageAddress` as a local sanity check before submitting the attestation on-chain. Full source: [`apps/seller-reference/src/`](apps/seller-reference/src/).

---

## Query the indexer API

Public, no auth, CORS open — hosted at <https://api.trypact.xyz>. Built on top of `@trypact/sdk` so the contract layer remains the single source of truth; the indexer is just a fast read cache.

| Endpoint | Returns |
|---|---|
| [`GET /healthz`](https://api.trypact.xyz/healthz) | Uptime, last indexed block, in-memory counters |
| [`GET /v1/services`](https://api.trypact.xyz/v1/services) | Full service catalog (every registered seller) |
| [`GET /v1/services/:id`](https://api.trypact.xyz/v1/services/1) | One service by id |
| [`GET /v1/jobs?limit=N`](https://api.trypact.xyz/v1/jobs) | Recent jobs across all services, newest first |
| [`GET /v1/jobs/:id`](https://api.trypact.xyz/v1/jobs/2) | One job's full state + attestation bytes |
| [`GET /v1/sellers/:address`](https://api.trypact.xyz/v1/sellers/0xbF7EF900E2dB365455B91Fb133f78Fc70114Bf31) | Every service + job for one seller address |
| [`GET /v1/stats`](https://api.trypact.xyz/v1/stats) | Aggregate counters (settled / expired / slashed / total $0G settled) |

The indexer is a Railway-hosted Express process — source at [`apps/indexer/`](apps/indexer/). Polls `JobCreated` + 5 state-change events; falls back to on-chain reads if a block range is missed.

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

### Job state machine

Every job moves through this strict transition graph. Each transition emits an event and is visible on chainscan in real time.

```
                ┌─── reclaimExpired() ────► Expired
                │       (after timeout)
   Pending ─────┤
   (createJob)  │                                      ┌─── arbitrate() ───► Settled
                │                                      │       (dispute fails)
                └── submitAttestation() ──► Attested ──┤
                       (TEE sig verified)              │
                                                      ├─── (24h passes) ───► Settled
                                                      │       (95% seller / 5% protocol)
                                                      │
                                                      └─── dispute() ───► Disputed
                                                                            │
                                                                            ├─► Settled (dispute fails: 90% to seller, 10% protocol)
                                                                            └─► Slashed (dispute wins: bond → 70% disputer, 20% protocol, 10% burned)
```

Source: [`packages/contracts/src/PactEscrow.sol`](packages/contracts/src/PactEscrow.sol). The state is `enum JobState { Pending, Sealed, Attested, Settled, Expired, Disputed, Slashed }` and the JS mirror lives at [`packages/sdk/src/types.ts`](packages/sdk/src/types.ts).

### 5 0G primitives, each load-bearing

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

## Contracts cheat sheet

For integrators who want to skip the SDK and call the contracts directly (via `cast`, ethers, web3, viem, foundry). Every function is non-reentrant where it touches state. Full NatSpec on every external function — [`packages/contracts/src/`](packages/contracts/src/).

### Buyer surface (PactEscrow)

```solidity
// Escrow funds, open a job. msg.value is the price for one inference.
function createJob(uint256 serviceId, bytes calldata encryptedInput, uint64 timeout)
    external payable returns (uint256 jobId);

// Reclaim escrow if the seller hasn't attested by `timeout`.
function reclaimExpired(uint256 jobId) external;

// Challenge a settled attestation. Requires posting a dispute bond.
function dispute(uint256 jobId) external payable;

// Read job state, escrow balance, etc.
function getJob(uint256 jobId) external view returns (Job memory);
function jobEscrowBalance(uint256 jobId) external view returns (uint128);
function nextJobId() external view returns (uint256);
```

### Seller surface (PactRegistry + PactEscrow + SlashingArbiter)

```solidity
// PactRegistry — register / update / delist
function registerService(...) external returns (uint256 serviceId);     // (full sig above)
function updateService(uint256 serviceId, uint128 newPrice, bool active) external;
function rotateSigningAddress(uint256 serviceId, address newSigningKey) external;
function delistService(uint256 serviceId) external;
function getSellerServices(address seller) external view returns (uint256[] memory);

// PactEscrow — submit the TEE attestation that settles the job
function submitAttestation(
    uint256 jobId,
    bytes32 outputRoot,
    bytes32 chatId,
    bytes calldata attestationText,        // the 5-field canonical text
    bytes calldata attestationSignature    // 65-byte ECDSA(secp256k1)
) external;

// SlashingArbiter — bond lifecycle
function stakeBond(uint256 serviceId) external payable;                 // ≥ 5 $0G
function requestWithdrawal(uint256 serviceId) external;                 // start timer
function withdrawBond(uint256 serviceId) external;                      // after window
```

### Public reads (anyone)

```solidity
PactRegistry.getService(serviceId)                  → Service struct
PactRegistry.nextServiceId()                        → uint256
ReputationVault.getReputation(serviceId)            → Reputation struct
ReputationVault.getBuyerWeight(address buyer)       → uint128 (sqrt-weighted)
ReputationVault.getBuyerTotalVolume(address buyer)  → uint128 (wei settled)
SlashingArbiter.bondOf(serviceId)                   → uint128
AgentNFT.tokenURI(tokenId) / .ownerOf(tokenId)      → ERC-7857 standard
```

Addresses are in the [Status table above](#status) and exported from [`@pact/shared`](packages/shared/src/) for in-repo consumers.

---

## Economics

| What | Value | Where |
|---|---|---|
| Protocol fee | **5%** of every settled job (95% to seller) | `PactEscrow.PROTOCOL_FEE_BPS = 500` |
| Minimum seller bond | **5 $0G** per service | `SlashingArbiter.MIN_BOND = 5e18` |
| Successful slash split | **70% disputer / 20% protocol / 10% burned** | `SlashingArbiter.SLASH_DISPUTER_BPS = 7000` |
| Failed-dispute split | **90% to seller / 10% protocol** (anti-griefing) | `SlashingArbiter` |
| Dispute window | **24h after Settled** | `PactEscrow` |
| Default job timeout | Buyer-specified (typical 300s) | `createJob.timeout` |
| Buyer reputation weight | **`sqrt(buyer_total_paid_wei)`** | `ReputationVault.getBuyerWeight` |

Sybil resistance is enforced by the sqrt-weighted buyer reputation: a brand-new buyer's review contributes near zero; a long-tail buyer who has cumulatively paid more gets proportionally more weight. Reputation accrues to the **INFT**, not the seller wallet — transfer the INFT, transfer the reputation.

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
  web/                   Next.js 16 frontend — landing, marketplace, jobs, verify, explorer, seller
  seller-reference/      Node.js seller agent — JobCreated watcher → 0G Compute → submitAttestation
  indexer/               Express read cache → api.trypact.xyz (Railway)
  mcp-http/              Remote MCP server → mcp.trypact.xyz (Railway)
packages/
  contracts/             Foundry — Solidity 0.8.24 + cancun; 56/56 tests passing
  sdk/                   @trypact/sdk — buyer TypeScript SDK (npm, published)
  mcp-server/            @trypact/mcp-server — stdio MCP for local install (npm, published)
  shared/                Addresses + ABIs + chain constants, workspace-linked
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

### What's in v0.1 (this submission) vs planned

| Capability | v0.1 (shipped) | Planned |
|---|---|---|
| 7 mainnet contracts + 56/56 Foundry tests | ✓ | — |
| Buyer SDK + stdio MCP + hosted MCP | ✓ | — |
| TEE attestation via 0G Compute Direct broker | ✓ | — |
| Local ECDSA verification UI (browser) | ✓ | — |
| Indexer + explorer subdomain | ✓ | — |
| 0G Storage for encrypted output blobs | Local handoff | v0.2 — encrypted blob → `0g-storage-client` |
| 0G DA for job event log at scale | Indexer cache | v0.2 — production-scale audit trail |
| Multi-seller marketplace (sellers beyond Service 1) | Single seller in scope | v0.2 — open registration via UI |
| Reputation lease / INFT secondary market | Read paths wired | v0.2 — INFT marketplace integration |

The `v0.2` items are tracked in [`docs/MASTER_PRD.md`](docs/MASTER_PRD.md) §22 (Roadmap).

---

## License

[Apache License 2.0](LICENSE) — permissive, contracts and SDKs are free for any use.

## Contributors

Built solo by Tim ([@winsznx](https://github.com/winsznx)) for 0G APAC Hackathon Track 3, May 2026. PR's welcome on [github.com/winsznx/pact](https://github.com/winsznx/pact).
