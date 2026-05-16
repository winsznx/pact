# HackQuest submission — pre-filled answers

Copy-paste into the official HackQuest form. All fields below come from
`docs/MASTER_PRD.md` (canonical spec). Update placeholders marked
`<TODO>` before submitting.

---

## Project basics

**Project name**: PACT

**One-liner (≤30 words)**:
> Settlement protocol for verifiable AI-as-a-Service on 0G mainnet. Buyers pay sellers per inference. TEE attestation guarantees model and execution. Reputation accrues to the seller's ERC-7857 INFT.

**Tagline**:
> Trust the math. Pay the agent.

**Project description (long form)**:
> PACT is the settlement layer for AI-as-a-Service on 0G mainnet. Buyers
> escrow $0G per inference call against a seller's registered Service.
> The seller runs the inference via 0G Compute Direct broker — a TEE-
> attested execution environment that returns a per-call ECDSA signature
> over a canonical 5-field text (content hash, usage hash, provider type,
> provider identity, TLS cert fingerprint).
>
> The seller submits the attestation to PACT's on-chain verifier, which
> runs the same EIP-191 ECDSA recovery primitive in Solidity. If the
> recovered signer matches the service's registered signing address, the
> escrow atomically releases — 95% to the seller, 5% protocol fee.
> Reputation increments on the seller's ERC-7857 Agent INFT — a
> transferable token. Sell the agent, sell the reputation.
>
> Disputes are narrow: a disputer puts down a small bond, the verifier
> re-runs the recovery against the current signing key; on mismatch the
> seller's bond slashes (70% disputer / 20% protocol / remainder burned).
> Disputes are about cryptographic fraud only, never output quality.
> Output quality is reputation's job.
>
> 5 of 5 0G primitives are load-bearing: Chain (7 contracts, all live),
> Compute (every job's TEE attestation), Storage (output blobs and
> reputation history, v0.2), ERC-7857 INFT (seller identity + reputation
> accumulator), DA (job event log).

---

## Track + alignment

**Track choice**: **Track 3 — Agentic Economy & Autonomous Applications**

Sub-themes: financial rails (micropayments, automated billing, revenue-sharing) + operational tools (self-custodial agent wallets, AI-governed DAO infrastructure).

**Why Track 3 fits**:
> PACT *is* the financial rail for the agent economy. Every payment is a
> per-call micropayment. Every settlement is automated by the contract.
> Revenue-sharing between seller and protocol is baked into the escrow
> split. The protocol primitives are exactly the operational tools the
> agent economy needs but doesn't have yet.

---

## 0G primitives used

| Primitive | How PACT uses it |
|---|---|
| **0G Chain** | All 7 protocol contracts live on chainId 16661 (PactRegistry, PactEscrow, AttestationVerifier, ReputationVault, SlashingArbiter, AgentNFT proxy + impl). Settlement, registration, reputation, slashing all on-chain. |
| **0G Compute** | TEE-attested inference via Direct broker. Every settled job fetches `text + signature` from `${endpoint}/v1/proxy/signature/${chatId}`. Verified Phase 0 with real signature payload. |
| **0G Storage** | Encrypted output blobs + reputation KV history (v0.2; v0.1 uses local handoff for demo flow). Phase 0 G6 confirmed 1KB roundtrip in ~20s, rootHash `0x31f1dbc6…`. |
| **ERC-7857 INFT** | Seller identity (one INFT per service). Reputation accumulates against the INFT, not the seller wallet → reputation is transferable when the INFT changes hands. Forked from `0g-agent-nft` HEAD `b86e108a`. |
| **0G DA** | Job event log via on-chain emit (`JobCreated`, `JobAttested`, `JobSettled`, `JobExpired`, `JobDisputed`, `JobSlashed`). Production-scale path. |

---

## Mainnet contract addresses (chainId 16661)

| Contract | Address |
|---|---|
| PactRegistry | `0x152A5a433A6592df57d7F77B7B01eEE00C481C2d` |
| PactEscrow | `0xB2b762Df53294923d3eaD00d8118AD37388dD4aA` |
| AttestationVerifier | `0x765C857B6764c90B0093Ea16f6103902665D0aa2` |
| ReputationVault | `0x1574E42D7fF268384408430D5b76C88f37b8a72B` |
| SlashingArbiter | `0x324E5b2183134EB239C7E934438831a15abe7C00` |
| AgentNFT (ERC-7857 proxy) | `0xe76dBE7FCf8c7F784b05DF88996bd63CA2c4d7D6` |
| AgentNFT (ERC-7857 impl) | `0x4EC0DCac00A274Fb69F54cAb62370b2c71989CE4` |

**Proof of activity** (live e2e job, settled on 0G mainnet):

- createJob tx: `0x7e9a3f081a52233d0c037abe748ed10c0deb83e0228e41a8d5f0824c2453b30a` (block 33289635)
- submitAttestation tx: `0xbb36752d4e7330d2dc46f84a479b524111fa43f81ee55467cfedd8717a67df48`
- Job #2, Service #1, state Settled (3). 5-field attestation text + 65-byte signature stored on-chain.

All addresses verifiable at <https://chainscan.0g.ai>.

---

## Required links

| Field | Value |
|---|---|
| GitHub | <https://github.com/winsznx/pact> |
| Demo video | <TODO record per docs/DEMO_SCRIPT.md before submitting> |
| Live URL | <https://trypact.xyz> — Vercel `sin1` region. Reproducible local fallback documented in README. |
| X post | <TODO link the tweet once posted — use docs/X_POST.md as draft> |

---

## Architecture diagram

ASCII diagram in [README.md](../README.md). For the HackQuest form
"architecture description" field, paste this 3-sentence summary:

> Buyers → PactEscrow (lock 0.001 $0G per call) → JobCreated event →
> Seller agent (Node.js, polls every 3s) → 0G Compute Direct broker →
> TEE-attested ECDSA signature → PactEscrow.submitAttestation →
> AttestationVerifier recovers signer → atomic split (95% seller / 5%
> protocol) → ReputationVault increments seller's ERC-7857 INFT score.
> SlashingArbiter holds the seller's 5 $0G bond and can slash on
> cryptographic fraud (70% disputer / 20% protocol / remainder burned).
> All state transitions emit events on 0G DA.

---

## Faucet / reviewer notes

> Judges who want to reproduce the end-to-end loop need a 0G mainnet
> burner with ~6 $0G. The protocol economics are tiny — 0.001 $0G per
> call, 5 $0G one-time bond, ~0.0005 $0G of gas per round trip — so the
> wallet can run a dozen test jobs on $1 worth of $0G.
>
> The reference seller agent at `apps/seller-reference/` is intentionally
> the SAME burner for both buyer and seller in test mode — net cost per
> e2e loop is ~0.003 $0G (gas only, since 95% of the escrow returns to
> the same wallet as the seller payout). Run the full pipeline with
> `./apps/seller-reference/scripts/e2e.sh` — it prints both tx hashes on
> success.
>
> If the reviewer prefers to inspect without reproducing: the
> `/verify/2?autoplay=1` page runs the same ECDSA recovery client-side
> against the captured attestation from our live mainnet job, with the
> 6-step animation visualising every step of the primitive.

---

## Bonus deliverables

- **Pitch deck**: <TODO Tim — link slide deck if produced>
- **Tutorial**: README.md "Run it yourself" section serves as the tutorial.
- **Frontend demo link**: <https://trypact.xyz>. Deploy steps documented in [docs/DEPLOY.md](./DEPLOY.md).
- **Backend / API docs**: Solidity NatSpec on every external function. Source links:
  - `packages/contracts/src/PactEscrow.sol`
  - `packages/contracts/src/PactRegistry.sol`
  - `packages/contracts/src/AttestationVerifier.sol`
  - `packages/contracts/src/SlashingArbiter.sol`
  - `packages/contracts/src/ReputationVault.sol`

---

## Founder

**Name**: <TODO Tim>

**Bio (≤80 words)**:
> <TODO Tim — fill in based on prior hack-win history; the PRD references
> a "5/5 hackathon win history with payments as core primitive" — pull
> that thread out for the form.>

**Contact**: <TODO Tim — email or X handle>

---

## Submission-day checklist

- [ ] Demo video recorded and uploaded (YouTube unlisted or Loom)
- [ ] Live URL deployed (Vercel or local README walkthrough as fallback)
- [ ] X post published with all required handles + hashtags
- [ ] GitHub repo public + tagged release `v0.1.0-hackathon`
- [ ] README's status banner updated with the canonical settled-job tx
- [ ] Pitch deck linked (bonus)
- [ ] HackQuest form submitted before May 16 2026 23:59 UTC+8
