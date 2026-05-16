# PACT — Claude Code rules

> Loaded every Claude Code session. Keep tight. If this file grows, it costs context every turn.

---

## Project

**PACT** — Provable Agent-to-Agent Compute Trust. Settlement protocol for AI-as-a-Service on 0G mainnet. Sellers mint Agent INFTs, buyers pay per inference, TEE attestation + commit-reveal guarantees model and execution. Reputation accrues to the INFT itself.

**Submission:** 0G APAC Hackathon · Track 3 (Agentic Economy & Autonomous Applications) · deadline May 16, 2026 23:59 UTC+8.

**Canonical spec:** `docs/MASTER_PRD.md`. If a request contradicts the PRD, stop and flag — do not silently drift. Drift = stop, ask, decide which to update.

**Current phase:** see `docs/AGENT_PROGRESS.md` (read first thing every session).

---

## Hard rules

- **No mock data, ever.** Real on-chain calls, real 0G mainnet (chainId 16661), real $0G in escrow. If something can't be tested live yet, write the code path and gate it behind a flag — never fake the data.
- **No demos.** Everything built is real product. Even what's only seen during the 3-min video is real on mainnet.
- **No scope cuts unless <24hr to deadline AND something is broken.** Default answer to "should I trim this?" is no.
- **Payments-prior.** Every primitive must touch the payment path or feed reputation. If a feature doesn't, it's V2.
- **No deadline anxiety framing.** Treat May 16 as logistics, not pressure. Ship with conviction.
- **TESSERA carry-over:** do NOT reference, copy, or import from VeilPay. Under-constrained comparator bug. Circuit/crypto written from scratch.
- **No hallucinated SDKs, APIs, or contract addresses.** If unsure, stop and ask. Every external dependency must be verifiable.

---

## Stack (pinned, do not drift)

```
node 20.18.0       pnpm 9.12.3        typescript 5.6.3
next 15.0.3        react 19.0.0       tailwindcss 4.0.0-beta.3 (CSS @theme)
viem 2.21.45       wagmi 2.13.0       @rainbow-me/rainbowkit 2.2.0
foundry (latest)   solidity 0.8.24    evm_version cancun
hardhat 3.0.0      @nomicfoundation/hardhat-toolbox 5.0.0
@supabase/supabase-js 2.46.1
@0glabs/0g-ts-sdk @0glabs/0g-serving-broker
openai 4.73.0      eciesjs 0.4.13     ethers 6.13.4     zod 3.23.8
```

**Repo:** pnpm + turborepo monorepo. `apps/{web,indexer,seller-reference}` · `packages/{sdk,seller-sdk,contracts,shared}`.

**Deploy targets:** Vercel (web) · Railway (indexer) · Supabase (db) · 0G mainnet (contracts).

**RPC:** primary `https://evmrpc.0g.ai`, fallback QuickNode 0G. Explorer `https://chainscan.0g.ai`. Storage indexer `https://indexer-storage-turbo.0g.ai`.

---

## 0G primitives in use (load-bearing, all 5)

| Primitive | Used for |
|---|---|
| 0G Chain | All 5 protocol contracts, all settlement, all events |
| 0G Compute | TEE-attested inference (Router `router-api.0g.ai/v1` OR Direct via `@0glabs/0g-serving-broker`) |
| 0G Storage | Encrypted output blobs + KV reputation history |
| ERC-7857 INFT | Seller identity + reputation accumulator (transferable) |
| 0G DA | Job event log (production scale) |

If a session proposes removing one, push back — see PRD §6 for what breaks.

---

## Architecture invariants

- 5 contracts: `PactRegistry`, `PactEscrow`, `AttestationVerifier`, `ReputationVault`, `SlashingArbiter`. No more, no fewer in v0.1.
- Job state machine is canonical: `Pending → Sealed → Attested → Settled` (happy) or `→ Expired` / `→ Disputed → {Settled, Slashed}`.
- Commit-reveal ordering is the moat: buyer commits input hash on `JobCreated` → seller commits attestation+output_hash on `submitAttestation` BEFORE revealing output to buyer. Never reorder.
- Disputes are about cryptographic fraud only (model_hash mismatch, invalid TEE sig, replay). Never about output quality. Quality is reputation's job.
- Reputation accrues to INFT, not wallet. INFT transferable → reputation transferable. Bond travels with INFT.
- Sybil resistance: buyer weight = `sqrt(buyer_total_paid)`. New buyers near-zero weight.
- All ground truth on-chain. Indexer is a cache, never authoritative.

---

## Coding standards

- **Solidity:** 0.8.24 + cancun. NatSpec on every external function. Checks-effects-interactions. nonReentrant on all state-changing externals. No proxies in v0.1.
- **TypeScript:** strict mode on. No `any` — use `unknown` and narrow. Zod schemas for all external boundaries (API, contract events, Supabase).
- **Tests:** Foundry for contracts (≥30 unit, ≥5 invariant, ≥10 integration). Vitest for SDK. Playwright for E2E. No skipped tests in main.
- **Errors:** typed error classes in SDK (`PactError`, `JobTimeoutError`, `AttestationInvalidError`, etc.). Never throw strings.
- **Events:** every state change emits an event. Indexed params for anything queried by frontend.
- **Naming:** functions imperative (`createJob`, `submitAttestation`). Types PascalCase. Constants SCREAMING_SNAKE.

---

## Broadcasting on 0G mainnet (operational rules)

1. **Use forge create or cast send, NOT forge script for individual broadcasts.** forge script's receipt parser bails on 0G's non-standard receipt fields (missing field feePayer / timestampMillis) and reports "contract was not deployed" / "Failure on receiving a receipt" even when the tx successfully landed. Verify on-chain via cast code <predicted_addr> instead of trusting forge's exit code.

2. **Always force legacy mode with explicit gas price.** 0G's tip cap minimum is 2 gwei; forge auto-estimates below this and txs reject. Use --legacy --with-gas-price 4000000000 (4 gwei) on every broadcast.

3. **Verify wiring via cast call, not forge logs.** After multi-contract deploys, read each immutable address slot directly: cast call <escrow> "arbiter()(address)" — confirms wiring is what you intended. Don't trust deploy script logs alone.

This applies to all Phase 2/3/4/5/6 mainnet operations.

---

## Frontend rules (full spec → `docs/FRONTEND_PRD.md` when written)

- Design system anchored to Antimetal reference: ivarTextFont upright headlines, abcdFont labels and body. Single signal accent — chartreuse (#d0f100).
- Premium B2B aesthetic. No emoji in UI copy. No consumer-playful tone.
- All numbers in upright serif when oversized (stat hero, balances). Mono for addresses, hashes, technical labels.
- Live state machine visible during job execution. Each transition links to a real chainscan tx.
- No skeletons that fake data. Show "fetching" honestly.

---

## Build phases

```
Phase 0 — Day 0 validation       (PRD §21, 8 gates)
Phase 1 — Contracts              (PactRegistry → Escrow → Verifier → RepVault → SlashingArbiter → tests → mainnet deploy)
Phase 2 — Buyer SDK              (@pact/sdk, npm publish)
Phase 3 — Indexer + API          (Supabase + Railway)
Phase 4 — Seller reference agent
Phase 5 — Frontend               (per FRONTEND_PRD.md)
Phase 6 — Submission             (README, video, X post, HackQuest form)
```

One phase at a time. Each phase has exit criteria in PRD §13. Don't start Phase N+1 until N exits clean.

---

## Working agreement

- Read `docs/MASTER_PRD.md` and `docs/AGENT_PROGRESS.md` at session start.
- One concern per prompt. Defined deliverable before next prompt is written.
- Append to `docs/AGENT_PROGRESS.md` between sessions: what shipped, what decided, what's blocked.
- If asked to do something the PRD doesn't cover: stop, flag, ask. Don't extrapolate.
- Diffs over rewrites. Reference shared types/constants instead of redefining.
- When the PRD and reality conflict (e.g., 0G SDK API differs from spec), stop and surface — don't paper over.

---

## What "done" means for this hack

A judge can: clone the repo, follow README, fund a wallet with $0G, run buyer SDK, get a TEE-attested inference, verify the attestation, see settlement on chainscan.0g.ai. Same flow works on `pact.xyz`. Reputation increments. Bond stays bonded. Three minutes of video shows it real.

That's the bar. Anything less is not done.