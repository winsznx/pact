# PACT — Provable Agent-to-Agent Compute Trust
## Master Product Requirements Document — v0.4

| Field | Value |
|---|---|
| Project | PACT |
| Version | **v0.4** (Phase 1 contracts complete, deploy ordering finalized) |
| Submission target | 0G APAC Hackathon · Track 3 — Agentic Economy & Autonomous Applications |
| Deadline | May 16, 2026 23:59 UTC+8 |
| Author | Tim (winsznx) |
| Status | Phase 1 EXIT signed off (5/5 contracts, 55/55 tests). Step 2F deploy script unblocked. |

---

## v0.4 changelog (deltas from v0.3)

Phase 1 ran 2026-05-07 in five sessions: AttestationVerifier, INFT fork +
PactRegistry, PactEscrow, ReputationVault, SlashingArbiter. 55/55 tests
green (45 unit + 10 invariants, each invariant 256 runs × 128k calls). All
five contracts wired together; the captured G5 mainnet payload drives both
the honest-settle and rotate-then-slash adversarial paths in Solidity. v0.4
locks the deltas accumulated across all five steps.

- **§5.2 PactEscrow interface gains** `event JobSlashed`, `markSlashed`,
  `getJob` on the interface, and a 5th constructor argument (`arbiter`).
  These were necessary to wire SlashingArbiter ↔ PactEscrow without
  breaking encapsulation.
- **§5.5 SlashingArbiter interface gains** `requestWithdrawal`,
  `openDispute`, `getDispute`. The two-phase withdrawal pattern (request →
  7 days → withdraw, gated by no open disputes) implements §3.3's "DELISTING"
  state explicitly and mitigates §14.1 D1.
- **§16.2 deploy sequence finalized** — 8 steps with 3-way address
  prediction (vault ↔ arbiter ↔ escrow are mutually-immutable, so we predict
  the escrow CREATE address at deployer.nonce + 2 and seed both vault and
  arbiter with it before deploying escrow last).
- **§3.3 state machine** — v0.1 implementation collapses Pending → Settled
  in one atomic transaction inside `submitAttestation`. `Sealed` and
  `Attested` enum values are reserved for a future buyer-confirms-output
  flow; `JobAttested` event still fires inside `submitAttestation` for
  indexer observability.
- **§3.4 sybil weight formula simplified** to
  `sqrt(buyer_total_volume_paid + this_job_amount)` ("after-this-job"
  semantics, so the buyer's first $1 contributes non-zero weight rather
  than `sqrt(0)=0` zeroing the first settlement). v0.1 ships **no time
  decay** — Phase 2 adds exponential decay over a configurable window.
- **§5.1 PactRegistry.getSellerServices follows INFT ownership.**
  Operator/Owner split formalized: INFT owner gets reputation accrual,
  listing visibility, and payment routing; original registrant retains
  rotate/update/delist authority and bond custody. Bond authority
  intentionally lives with the operator who maintains the off-chain
  `acknowledgeProviderSigner` relationship with 0G Compute, not with the
  current INFT owner.
- **§14.1 A3 (provider_identity match) deferred to Phase 2 hardening.**
  G5-inspect (2026-05-07) confirmed each 0G provider issues a single
  signing key across the models it serves, so cross-provider key sharing
  is not a current threat. v0.1 ships A1 (signing-key recovery) + A2
  (chatId replay). v0.2 adds A3 (parsed providerType/providerIdentity
  match against the registered Service struct).
- **Slash distribution dust absorbed into burn fraction.** Disputer + treasury
  shares computed as `* 7000/10000` and `* 2000/10000`; burn computed as the
  remainder. Up to 2 wei of integer-division dust deposits in burn rather
  than vanishing. Verified by `invariant_slashDistribution` across 256 ×
  128k handler calls — the four shares sum to the seller bond exactly.

Sections affected: header, §3.3, §3.4, §5.1, §5.2, §5.4, §5.5, §14.1, §16.2,
footer.

---

## v0.3 changelog (deltas from v0.2)

Phase 1.5 read-only inspection of `listService()` on 2026-05-07 surfaced two
findings that change registration architecture and the TeeTLS/TeeML
classification model. v0.3 locks them.

- **`additionalInfo.TargetSeparated` is the canonical TeeTLS / TeeML
  discriminator on 0G mainnet — replacing trust in the `verifiability` label.**
  The G3 Router catalog labels `zai-org/GLM-5-FP8` as `verifiability: TeeTLS`,
  but `listService()` tags the same provider as `verifiability: TeeML`. The
  field is unreliable. The actual mode lives in `additionalInfo.TargetSeparated`:
  `true` ⇒ proxied (TeeTLS-semantic, model upstream over TLS), `false` ⇒
  in-enclave (TeeML-semantic, model inside TDX). PactRegistry stores
  `TargetSeparated` as the source of truth and ignores `verifiability`.
- **`Service` struct gains `bool targetSeparated`** (PRD §5.1).
- **Seller registration simplified — single `listService()` read populates
  `signingAddress` + `providerType` + `providerIdentity` + `targetSeparated`**
  pre-flight, with no inference call needed. Index 9 of every service entry
  carries the TEE proxy's signing key for both TargetSeparated:true (G5,
  bit-exact match to `/signature/{chatId}` payload) and TargetSeparated:false
  (G8) providers. The on-chain `signing_address` registry can be seeded
  entirely from one read of `listService()`.
- **v0.1 ships TeeTLS providers (TargetSeparated:true). TeeML
  (TargetSeparated:false) is a forward-compatible extension** — verifier
  contract is unchanged (same EIP-191 ECDSA recovery), only the canonical
  text's field semantics differ (in TeeML, `providerType` and
  `providerIdentity` may be empty since there is no upstream API to identify;
  the last colon-field repurposes from TLS cert fingerprint toward enclave
  image digest). Confirmation parked behind a funded G8 probe; not blocking
  Phase 1 contracts.

Sections affected: header, §5.1, §6, §8.3, §17, §19, §21.

---

## v0.2 changelog (deltas from v0.1)

Phase 0 (8 Day-0 gates → 5 functional probe gates G3–G7) ran on 2026-05-07. All five PASSed. Outcomes that touched the PRD:

- **SDK package names corrected.** v0.1 specified `@0glabs/0g-serving-broker` and `@0glabs/0g-ts-sdk`; the live npm packages are `@0gfoundation/0g-compute-ts-sdk@0.8.0` and `@0gfoundation/0g-storage-ts-sdk@1.2.8`. The old `@0glabs/*` names resolve to a deprecated provider-side Go server.
- **Inference path locked to Direct.** v0.1 hedged between Router and Direct paths. G4 confirmed Router exposes no per-call signature — Router is unviable for the moat. G5 confirmed Direct path returns the full ECDSA signature payload via `GET ${endpoint}/signature/{chatId}?model={...}`. Path C (Direct-only) is now the canonical and only inference path.
- **Attestation cryptography fully specified.** G5 captured a real signature payload + `signing_address`. Verified empirically: signature is **EIP-191 `personal_sign`** ECDSA-secp256k1 over the canonical 5-field colon-separated text. On-chain verifier becomes ~4 lines using OpenZeppelin's `ECDSA.recover()` and `MessageHashUtils.toEthSignedMessageHash()`. v0.1's three fallback paths (A/B/C) collapse to one verified path.
- **TEE attestation honestly framed as TeeTLS.** Live providers run in Intel TDX with `dstack` verifier, but for most LLMs (incl. GLM-5-FP8) the model itself runs upstream (OpenRouter/Together/StreamLake) — TEE attests the proxied call + TLS cert pin. Two models on the catalog (`whisper-large-v3`, `z-image`, `GLM-5.1-FP8`) advertise `verifiability: TeeML` (model inside enclave). Demo flagship will switch to GLM-5.1-FP8 once Phase 1 confirms TeeML signature payloads share the same shape.
- **0G primitive verification.** All 5 primitives confirmed live and integrated cleanly: 0G Chain (chainId 16661), 0G Compute Direct (provider `0xd9966e13...` returning signed payloads), 0G Storage (rootHash roundtrip in 20s for 1KB), ERC-7857 reference (`0g-agent-nft` HEAD `b86e108a` compiles clean against 0.8.24+cancun), 0G DA (event log).
- **Domain rename.** `pact.xyz` → `trypact.xyz`.
- **Model identifier corrected.** `glm-5-fp8` → `zai-org/GLM-5-FP8` (full namespace prefix per Router catalog).
- **INFT integration path.** `0g-agent-nft` is a Hardhat project with OpenZeppelin 5.0.2 deps. We fork its contracts into our Foundry workspace with proper remappings — confirmed working in G7.

Sections most affected: §3.2, §5.1–5.3, §6, §7.1–7.2, §8.3, §9, §11, §13, §14, §17, §19, §21. Section numbering preserved from v0.1.

---

## 1. Submission target

### 1.1 Track choice

**Track 3 — Agentic Economy & Autonomous Applications.** Specifically the *Financial Rails* and *Operational Tools* sub-themes ("micropayments, automated billing, and revenue-sharing" / "self-custodial agent wallets and AI-governed DAO infrastructure"). Track 5 retained as fallback only — see §19.4.

### 1.2 Rubric mapping

| HackQuest Criterion | How PACT scores |
|---|---|
| **0G Technical Integration Depth & Innovation** | 5 of 5 0G primitives load-bearing and verified live in Phase 0 — Chain (5 contracts mainnet-deployed), Compute Direct (every job's TEE attestation fetched from `/signature/{chatId}`, ECDSA-recovered on-chain), Storage (encrypted output blobs + reputation log via PoRA-secured rootHashes), ERC-7857 INFT (seller identity, transferable reputation accumulator), DA (job event log). §6 documents per-primitive criticality. |
| **Technical Implementation & Completeness** | 5 deployed mainnet contracts (chainId 16661), working buyer SDK, working seller reference agent, indexer, explorer, end-to-end demo with real `chainscan.0g.ai` transactions. Mandatory mainnet contract address requirement satisfied 5x. |
| **Product Value & Market Potential** | Fills 0G's own roadmap gap — *AI Agent Marketplace* explicitly listed as "coming soon" under the INFT documentation. Every Guild on 0G recipient and OpenClaw skill builder needs PACT's payment+trust rails. We become the dependency, not a competitor. |
| **User Experience & Demo Quality** | Three demo moments engineered to be share-tweetable (§17). Premium B2B aesthetic anchored to the locked Antimetal design system. All on-chain transactions visible during demo, never mocked. |
| **Team Capability & Documentation** | This PRD (v0.4). Architecture diagrams. Per-contract NatSpec. Build log via `AGENT_PROGRESS.md`. README with judge-reproducible Day 0 walkthrough. |

### 1.3 Mandatory deliverables (HackQuest spec)

- [ ] Project name + ≤30-word one-liner + summary
- [ ] Public GitHub with substantial commits (target: 80+ across 14 days)
- [ ] **0G mainnet contract addresses** + chainscan.0g.ai links with verifiable activity
- [ ] ≥1 0G core component integrated (we use 5)
- [ ] ≤3-min demo video — real flows, not slides
- [ ] README in English with architecture diagram, module mapping, deployment steps, faucet/reviewer notes
- [ ] Public X post with `#0GHackathon #BuildOn0G @0G_labs @0g_CN @0g_Eco @HackQuest_`
- [ ] Bonuses: pitch deck, tutorial, frontend demo link, backend API docs (we ship all)

---

## 2. The opportunity

### 2.1 The gap

0G shipped the substrate for an agent economy — ERC-7857 INFT standard with encrypted metadata transfer + `authorizeUsage`, 0G Compute Direct with TEE-by-default inference and per-call ECDSA-signed attestations, 0G Storage with mutable KV over immutable Log. Under their INFT documentation, the **AI Agent Marketplace is explicitly listed as "coming soon."** The financial layer — payments, settlement, dispute, reputation — does not exist.

That gap is exactly what every Guild on 0G recipient and every OpenClaw skill builder hits the moment they try to monetize. PACT is the financial layer they need.

### 2.2 What PACT is, in one sentence

> **PACT is a settlement protocol for AI-as-a-Service on 0G — buyers pay sellers for inference work, with cryptographic guarantee that the work was done by the exact agent INFT they paid for, by the registered TEE-broker provider, on the model the seller committed to. Payment auto-releases on attestation. Reputation accrues to the INFT itself.**

### 2.3 Who needs it

- **Sellers**: anyone who's built an AI agent on 0G (OpenClaw skills, fine-tuned models on 0G Compute, Guild on 0G recipients) and wants to sell its capability without setting up payment infrastructure.
- **Buyers**: other agents, dApps, and end-user wallets that want to call AI services with cryptographic guarantees instead of trusting a centralized API.
- **The 0G ecosystem itself**: PACT is the settlement layer underneath any future 0G agent marketplace, AaaS subscription, or autonomous DeFi protocol that calls inference.

### 2.4 Why we win

1. **5/5 0G primitives load-bearing and Phase-0-verified.** Rubric criterion 1 explicitly rewards "extent of adoption." Track 3 competitors will pick 1–2; we use all 5 with each one structurally necessary, not bolted on.
2. **Payments-prior.** Tim's 5/5 hackathon win history has payments as core primitive. PACT *is* a payments protocol.
3. **Fills 0G's own published roadmap gap.** Judges are 0G Foundation. They fund what completes their stack.
4. **NeuroDegen moat transplants 1:1.** Commit-attestation-before-reveal. Same primitive, different domain. Code patterns, mental model, and security argument are battle-tested.
5. **Foundational primitive → ecosystem capture.** Post-hackathon, Guild on 0G fast-grant (~$200K) is structurally aligned. We become a dependency, not a competitor.

---

## 3. Product spec

### 3.1 Personas

**Seller (Service Provider).** Has built or wraps an AI agent / fine-tuned model. Wants recurring revenue from machine-to-machine calls. Comfortable with wallet/contract interactions. Holds a 0G Compute Direct provider relationship via `acknowledgeProviderSigner`.

**Buyer (Service Consumer).** An agent, dApp, or developer integrating AI into their product. Needs verifiable AI inference. Pays per call. May be programmatic (another agent) or human-driven via dashboard.

**Auditor / Observer.** Anyone — no permission required. Investigates seller reputation. Verifies historical jobs for compliance, research, or skepticism. Browses explorer.

### 3.2 End-to-end journeys

**Seller onboarding (one-time, ~3 minutes).**

1. Land on `trypact.xyz` → connect wallet → mainnet add prompt.
2. "Become a seller" form: capability tag (e.g. `code-review`, `defi-research`), model choice (from 0G Compute catalog, default `zai-org/GLM-5-FP8` for v0.1, upgrading to `zai-org/GLM-5.1-FP8` once Phase 1 confirms TeeML signature shape), per-call price, max input size.
3. Backend calls `acknowledgeProviderSigner(providerAddress)` via `@0gfoundation/0g-compute-ts-sdk`, then fetches the provider's `signing_address` via service metadata, stores it in registration data.
4. **Mint Agent INFT** — `PactRegistry.registerService()` mints an ERC-7857 token to the seller's wallet, anchors capability + `signing_address` + `provider_identity` + model commitment.
5. **Stake bond** — minimum 5 $0G to `SlashingArbiter` (v0.1 hackathon calibration). Visible publicly.
6. Listing live in marketplace within 1 block.

**Buyer flow (per job, target <30 seconds end-to-end).**

1. Browse `trypact.xyz/marketplace` — sort by capability, price, reputation.
2. Click seller INFT → see model, attestation history, reputation breakdown.
3. "Request inference" modal: input field (browser ECIES-encrypts to seller's pubkey), max fee, timeout.
4. Confirm → wallet signs `createJob` tx → escrow funds locked, encrypted input emitted in event.
5. Live status page: `PENDING → SEALED → ATTESTED → SETTLED`. Each transition shows the on-chain tx with chainscan link.
6. On `SETTLED`: buyer fetches encrypted output from 0G Storage by `outputRootHash`, decrypts locally, displays. Buyer may also locally verify `hash1` in the attestation text matches their `keccak256/sha256(decryptedContent)` (recipe pinned in §8.4).
7. Seller's INFT reputation auto-incremented on-chain.

**Auditor flow.**

1. Visit `trypact.xyz/explore`.
2. Live job firehose — anonymized buyer/seller, public attestation hashes, capability, price, settlement time.
3. Click any seller INFT → full job history as chain of attestations.
4. Click any job → cryptographic chain visualization: input commitment, attestation text (signed), output rootHash, settlement tx, signing address recovered live in-browser.
5. Optional: download proof bundle (JSON) for offline verification.

### 3.3 State diagrams

```
JOB STATE MACHINE
─────────────────

  [createJob]                [submitAttestation+verify]
  ──────────►   PENDING   ─────────────────────────────►   SETTLED
                   │                                          │
                   │ [timeout, no attestation]                │ [optional dispute window 24h]
                   ▼                                          ▼
                EXPIRED                                    DISPUTED
                (escrow returned                              │
                 to buyer)                                    │ [arbiter recover]
                                                              │
                                                        ┌─────┴─────┐
                                                        │           │
                                                     VALID       FRAUD
                                                     (seller     (slash + buyer
                                                      keeps      refund)
                                                      funds)
```

> **v0.1 implementation note.** The state machine collapses Pending →
> Settled in one atomic transaction inside `submitAttestation` —
> `Sealed` and `Attested` enum values are reserved for a future
> buyer-confirms-output flow but no v0.1 path persists those buckets.
> The `JobAttested` event still fires inside `submitAttestation` for
> indexer observability.

```
SELLER REGISTRATION
───────────────────

  [register]               [stakeBond]               [first job]
  ────────► REGISTERED ─────────────► BONDED ──────────────────► ACTIVE
              │                         │                           │
              │ [no bond within 7d]     │ [bond < min after slash]  │ [withdraw bond]
              ▼                         ▼                           ▼
          DELISTED                  PROBATION                    DELISTING
```

### 3.4 The dispute model — narrow on purpose

**Disputes are about cryptographic fraud only, not output quality.**

- **Disputable:** invalid ECDSA signature recovery, recovered signer ≠ registered `signing_address`, attestation text malformed, `provider_identity` doesn't match what was registered, `signingAddress` revoked from registry post-attestation.
- **Not disputable:** "the answer was bad," "I didn't like the output," "the model gave a wrong answer."

By design. Quality is reputation's job. Cryptographic fraud is the contract's job.

Arbiter rerun in v0.1 is just on-chain signature re-verification using the *current* `AttestationVerifier` state — if the provider's signing key has been revoked, the slash path triggers retroactively. No off-chain re-execution needed.

> **v0.1 dispute-window note.** v0.1 does NOT enforce the 24h dispute
> window shown in §3.3's diagram; `dispute()` accepts at any time after
> Settled, and `arbitrate()` accepts at any time after a dispute is open.
> SlashingArbiter's 7-day bond-withdrawal delay (§5.5) provides the de
> facto window — disputers have 7 days from a withdrawal request to fire
> a dispute that blocks the bond from leaving. v0.2 adds an explicit
> post-settlement timer.

**Sybil resistance for reputation** — buyer weight =
`sqrt(buyer_total_volume_paid + this_job_amount)`. The "after-this-job"
semantics ensure the buyer's first $1 contributes a non-zero weight; a
naive `sqrt(buyer_total_volume_paid)` evaluated *before* the current job
would be `sqrt(0) = 0` for every buyer's first settlement, zeroing it
silently. Self-dealing requires real $0G commitment that loses to the
protocol fee on every loop. v0.1 ships **no time decay** — Phase 2 adds
exponential decay over a configurable window.

### 3.5 Anti-scope (explicit non-goals for hackathon)

- No fiat on-ramps. $0G only.
- No token launch / no governance token. Protocol fee accrues to a treasury.
- No subscription / streaming payments. Pay-per-call only.
- No OpenClaw orchestration layer. PACT is the payment rail; OpenClaw is a downstream consumer.
- No human-as-buyer KYC. Buyers are wallets.
- No native cross-chain. 0G mainnet only.
- No off-chain reputation imports.

---

## 4. Protocol architecture

### 4.1 Component map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         BUYER FRONTEND (Next.js)                        │
│   marketplace · job request · status · output decrypt · dispute UI      │
└────────────────────┬─────────────────────────────────────┬──────────────┘
                     │                                     │
                     │ wallet (wagmi)                      │ encrypted RPC
                     ▼                                     ▼
┌─────────────────────────────────────────┐   ┌────────────────────────────┐
│        BUYER SDK (@pact/sdk)            │   │       INDEXER API          │
│  jobCreate · jobStatus · output fetch   │   │   /sellers /jobs /repu     │
│  ECIES encrypt/decrypt · sig verify     │   │   (Next.js + Postgres)     │
└──────────────┬──────────────────────────┘   └─────────┬──────────────────┘
               │                                        │
               │                              ingests   │ events
               ▼                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         0G CHAIN (chainId 16661)                        │
│  ┌────────────┐  ┌──────────┐  ┌──────────────┐  ┌─────────┐  ┌──────┐ │
│  │PactRegistry│  │PactEscrow│  │AttestationVer│  │RepVault │  │SlashArb│ │
│  └────────────┘  └──────────┘  └──────────────┘  └─────────┘  └──────┘ │
│       │                                                                 │
│       └──── ERC-7857 INFT (seller identity, agent-nft fork) ─────       │
└─────────────────────────────────────────────────────────────────────────┘
                                                                      
┌─────────────────────────────────────────────────────────────────────────┐
│                      OFF-CHAIN INFRASTRUCTURE                           │
│  ┌──────────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │   0G Storage         │  │  0G Compute      │  │ Seller Agent    │  │
│  │   (encrypted output  │  │  Direct (TEE-    │  │ (reference      │  │
│  │    blobs, KV         │  │   attested       │  │  impl, Node.js) │  │
│  │    reputation)       │  │   inference)     │  │                 │  │
│  └──────────────────────┘  └──────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Trust model

**What we trust:**
- 0G Chain validators (consensus)
- 0G Compute TEE provider operators not to leak their signing keys (standard TEE assumption)
- The TEE attestation signing the canonical 5-field text correctly when the inference is a TLS-pinned proxy call (provider_type: centralized) OR an in-enclave model run (provider_type: tee, future)
- 0G Storage availability (PoRA-secured)
- ECIES (well-vetted secp256k1)
- ECDSA + EIP-191 signature recovery (battle-tested)

**What we don't trust:**
- Sellers (slashable)
- Buyers (pay bonds for disputes)
- Upstream LLM providers (OpenRouter, Together, StreamLake — for `provider_type: centralized` slots) — TEE attestation isolates them; their failure mode is provider-level, not cryptographic
- Off-chain indexers (UX-only; ground truth is on-chain)

**Honest framing for the demo and submission:**

> *PACT verifies cryptographically that the seller invoked a registered 0G Compute Direct provider, that the broker's signing address matches the registered key, and that content/usage/TLS-cert hashes match the seller's commitment. Hardware attestation of model execution is the broker's responsibility. PACT's verifier is unchanged when 0G ships TeeML providers (model inside enclave) — same ECDSA primitive, same payload structure.*

---

## 5. Smart contract specifications

All contracts target **Solidity 0.8.24 + cancun**. Foundry test suite. ~1,200 lines total Solidity.

### 5.1 PactRegistry.sol

Seller registration, capability listing, INFT minting wrapper. Captures the verified 0G Compute attributes.

```solidity
pragma solidity ^0.8.24;

interface IPactRegistry {
    struct Service {
        uint256 inftTokenId;            // ERC-7857 token ID (in linked AgentNFT contract)
        address seller;
        bytes32 capabilityHash;         // keccak256(capabilityTag) e.g. "code-review"
        string  modelId;                // e.g. "zai-org/GLM-5-FP8"
        bytes32 modelCommitment;        // keccak256(modelId || providerAddress)
        address providerAddress;        // 0G Compute provider EVM address (e.g. 0xd9966e13...)
        address signingAddress;         // TEE proxy's signing key (e.g. 0x4C1b546f...)
        string  providerIdentity;       // upstream LLM provider name e.g. "openrouter", "Together"; empty for TargetSeparated:false
        string  providerType;           // upstream service type, e.g. "centralized"; empty for TargetSeparated:false
        bool    targetSeparated;        // From additionalInfo.TargetSeparated. true=proxied (TeeTLS-semantic), false=in-enclave (TeeML-semantic). Canonical discriminator — DO NOT trust the verifiability label from G3 Router catalog, it's misleading (G3 says TeeTLS while listService() says TeeML for the same provider).
        uint128 pricePerCall;           // wei of $0G
        uint64  maxInputBytes;
        uint64  registeredAt;
        bool    active;
    }

    event ServiceRegistered(uint256 indexed serviceId, address indexed seller, uint256 inftTokenId, bytes32 capabilityHash, address signingAddress);
    event ServiceUpdated(uint256 indexed serviceId, uint128 newPrice, bool active);
    event ServiceDelisted(uint256 indexed serviceId);
    event SigningAddressRotated(uint256 indexed serviceId, address oldKey, address newKey);

    /// @notice Register a seller's service against the on-chain registry.
    /// @dev signingAddress, providerType, providerIdentity, and targetSeparated
    ///      are all readable pre-flight from `inference.listService()` — index 9
    ///      carries signingAddress for every provider on 0G mainnet, and
    ///      `additionalInfo` (index 8) parses to a JSON object whose
    ///      ProviderType / ProviderIdentity / TargetSeparated fields populate
    ///      the corresponding params verbatim. Sellers do NOT need to perform
    ///      an inference bootstrap to register; the seller SDK fetches these
    ///      from listService() at register time and submits them directly.
    function registerService(
        bytes32 capabilityHash,
        string calldata modelId,
        address providerAddress,
        address signingAddress,
        string calldata providerIdentity,
        string calldata providerType,
        bool    targetSeparated,
        uint128 pricePerCall,
        uint64  maxInputBytes,
        bytes calldata inftMetadataURI
    ) external returns (uint256 serviceId);

    function rotateSigningAddress(uint256 serviceId, address newSigningKey) external;
    function updateService(uint256 serviceId, uint128 newPrice, bool active) external;
    function delistService(uint256 serviceId) external;

    function getService(uint256 serviceId) external view returns (Service memory);
    function getSellerServices(address seller) external view returns (uint256[] memory);
}
```

#### 5.1.1 Operator / Owner split (v0.1)

PRD's "reputation accrues to the INFT, not the wallet" narrative implies
two roles for any registered service:

| Role | Identity | Authority |
|---|---|---|
| **Operator** | `Service.seller` (msg.sender at registration). Stable. | `rotateSigningAddress`, `updateService`, `delistService`. **Bond custody** at SlashingArbiter (`stakeBond`, `requestWithdrawal`, `withdrawBond`). Off-chain: maintains `acknowledgeProviderSigner` relationship with 0G Compute, runs the seller agent. |
| **Owner** | Current holder of `agentNFT.ownerOf(Service.inftTokenId)`. Transferable. | Reputation accrual via `ReputationVault.recordSettlement` (keyed by serviceId). Listing visibility via `getSellerServices(addr)` (follows INFT ownership). Payment routing on settle (`Service.seller` is paid by `submitAttestation` — Phase 2 may split this). |

`getSellerServices(addr)` returns the set of services whose INFT is
**currently owned** by `addr`, not the set originally registered by `addr`.
INFT transfer immediately moves the listing AND the reputation pointer to
the new owner.

The split is deliberate for v0.1. Operator and Owner are typically the
same wallet at registration time, and only diverge if/when the operator
sells the agent's INFT. The off-chain provider relationship and the
slashable bond stay with the operator who set them up; the marketable
reputation stays on the INFT. Phase 2 may formalize separate Operator
and Owner roles with explicit transfer semantics.

### 5.2 PactEscrow.sol

Job lifecycle, escrow custody, attestation submission, settlement.

```solidity
interface IPactEscrow {
    enum JobState { Pending, Sealed, Attested, Settled, Expired, Disputed, Slashed }

    struct Job {
        uint256 serviceId;
        address buyer;
        address seller;
        uint128 amount;              // total escrowed
        uint128 protocolFee;         // taken on settlement
        uint64  createdAt;
        uint64  timeout;
        JobState state;
        bytes32 inputCommitment;     // keccak256(encryptedInput)
        bytes32 outputRootHash;      // 0G Storage rootHash, set on attestation
        bytes32 chatId;              // bytes32 of UUID from zg-res-key header (binds attestation to job)
        bytes   attestationText;     // the canonical 5-field colon-separated payload (signed by signingAddress)
        bytes   attestationSignature; // 65-byte ECDSA r||s||v
    }

    event JobCreated(uint256 indexed jobId, uint256 indexed serviceId, address indexed buyer, bytes32 inputCommitment, uint128 amount, uint64 timeout);
    event JobAttested(uint256 indexed jobId, bytes32 outputRootHash, bytes32 chatId, address recoveredSigner);
    event JobSettled(uint256 indexed jobId, address indexed seller, uint128 paidToSeller, uint128 protocolFee);
    event JobExpired(uint256 indexed jobId, address indexed buyer, uint128 refunded);
    event JobDisputed(uint256 indexed jobId, address indexed disputer);
    event JobSlashed(
        uint256 indexed jobId,
        address indexed slashedSeller,
        uint128 bondAmount,
        uint128 toDisputer,
        uint128 toTreasury,
        uint128 burned
    );

    function createJob(
        uint256 serviceId,
        bytes calldata encryptedInput,    // ECIES ciphertext, emitted in event
        uint64 timeout
    ) external payable returns (uint256 jobId);

    /// @notice Seller submits attestation. Contract verifies EIP-191 ECDSA recovery
    ///         over the canonical text recovers to service.signingAddress. On pass:
    ///         emit JobAttested → state=Settled → release escrow → increment reputation.
    function submitAttestation(
        uint256 jobId,
        bytes32 outputRootHash,
        bytes32 chatId,
        bytes calldata attestationText,    // 5-field colon-separated payload
        bytes calldata attestationSignature // 65 bytes
    ) external;

    function reclaimExpired(uint256 jobId) external;
    function dispute(uint256 jobId) external payable;

    /// @notice Mark a Disputed job as Slashed. Callable only by the linked
    ///         SlashingArbiter when arbitrate() resolves against the seller.
    function markSlashed(uint256 jobId) external;

    /// @notice Read a job by id. Reverts if the job does not exist.
    function getJob(uint256 jobId) external view returns (Job memory);
}
```

**Constructor (v0.1):**

```solidity
constructor(
    PactRegistry registry,
    IAttestationVerifier verifier,
    IReputationVault vault,
    ISlashingArbiter arbiter,
    address treasury
)
```

All five dependencies are immutable — see §16.2 for the address-prediction
pattern that resolves the 3-way `vault ↔ arbiter ↔ escrow` immutable cycle
at deploy time.

### 5.3 AttestationVerifier.sol

Pluggable verifier. Phase 0 verified, locked at v0.4 (unchanged from v0.2 — `TargetSeparated` and the v0.4 deltas affect registration / arbitration / accounting, never signature recovery). ~95 lines including helpers, custom errors, and `parseAttestationText`.

```solidity
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

interface IAttestationVerifier {
    /// @notice Recovers signer from an EIP-191 personal_sign over the attestation text.
    /// @param attestationText The canonical colon-separated payload as returned by
    ///        0G Compute /signature/{chatId}: "{contentHash}:{usageHash}:{providerType}:{providerIdentity}:{tlsCertFp}"
    /// @param signature 65-byte ECDSA r||s||v
    /// @return signer The recovered EVM address
    function recover(
        bytes calldata attestationText,
        bytes calldata signature
    ) external pure returns (address signer);

    /// @notice Asserts the recovered signer matches the registered signingAddress.
    function verify(
        bytes calldata attestationText,
        bytes calldata signature,
        address expectedSigner
    ) external pure returns (bool);

    /// @notice Optional: parse the 5-field text and return its components.
    function parseAttestationText(bytes calldata text) external pure returns (
        bytes32 contentHash,
        bytes32 usageHash,
        string memory providerType,
        string memory providerIdentity,
        bytes32 tlsCertFingerprint
    );
}
```

Reference implementation:

```solidity
function recover(bytes calldata attestationText, bytes calldata signature)
    external pure returns (address)
{
    bytes32 digest = MessageHashUtils.toEthSignedMessageHash(attestationText);
    return ECDSA.recover(digest, signature);
}

function verify(bytes calldata attestationText, bytes calldata signature, address expectedSigner)
    external pure returns (bool)
{
    return recover(attestationText, signature) == expectedSigner;
}
```

**That's the entire on-chain verification primitive.** Empirically validated in Phase 0 — the EIP-191 recovery against the captured `(text, signature)` pair returns `0x4c1b546f5fc11a9c2428eafed1d951aa13c17ee8` exactly, matching `signing_address` from the live `/signature/{chatId}` endpoint.

### 5.4 ReputationVault.sol

Sybil-resistant reputation accumulator, INFT-bound.

```solidity
interface IReputationVault {
    struct Reputation {
        uint128 totalJobs;
        uint128 totalVolume;
        uint128 weightedScore;     // sybil-discounted (see calc below)
        uint64  firstJobAt;
        uint64  lastJobAt;
    }

    event ReputationIncremented(uint256 indexed serviceId, uint128 jobAmount, uint128 buyerWeight, uint128 newWeightedScore);

    function getReputation(uint256 serviceId) external view returns (Reputation memory);
    function getBuyerWeight(address buyer) external view returns (uint128);

    /// @dev Called by PactEscrow on JobSettled.
    ///      v0.1 weight: jobAmount * sqrt(buyerVolumeAfterThisJob).
    ///      Phase 2 adds the time-decay multiplier sketched in v0.3.
    function recordSettlement(uint256 serviceId, address buyer, uint128 amount) external;
}
```

**Weight calculation (v0.1, matches §3.4):**

```
buyerVolumeAfter = buyerTotalVolumePaid_before + this_job_amount
buyerWeight      = sqrt(buyerVolumeAfter)
jobWeight        = this_job_amount * buyerWeight
weightedScore   += jobWeight  // monotone non-decreasing in v0.1
```

The "after-this-job" semantics (volume incremented before sqrt) ensure the
buyer's very first settlement contributes a non-zero weight; a naive
`sqrt(volume_before)` reads zero on the first call and silently zeroes that
job's contribution. v0.3's "min(volume, sqrt(volume))" prose collapses to
`sqrt(volume)` for any wei-scale value (≥ 1) — the `min` is vestigial and
v0.4 replaces it with the explicit formula above.

**No time decay in v0.1.** The score is monotone non-decreasing across
settlements. Phase 2 ships exponential decay over a configurable window
(half-life or weighted-mean kernel — TBD); the interface is unchanged
because the decay happens inside `recordSettlement` and the read-only
`getReputation`/`getBuyerWeight` views.

### 5.5 SlashingArbiter.sol

Bond custody, dispute arbitration, slash distribution.

```solidity
interface ISlashingArbiter {
    /// @notice Stake (or top up) a bond for `serviceId`. Caller MUST be the
    ///         service's original registrant (PactRegistry.Service.seller —
    ///         the operator, not the current INFT owner; see §5.1.1).
    function stakeBond(uint256 serviceId) external payable;

    /// @notice Phase 1 of two-phase withdrawal. Sets a 7-day timer on this
    ///         service's bond. Idempotent guard rejects duplicate requests.
    function requestWithdrawal(uint256 serviceId) external;

    /// @notice Phase 2 of two-phase withdrawal. Requires:
    ///           - msg.sender == bondPoster
    ///           - 7 days elapsed since requestWithdrawal
    ///           - openDisputesByService[serviceId] == 0
    function withdrawBond(uint256 serviceId) external;

    /// @notice Called by PactEscrow.dispute(); custodies the disputer's
    ///         msg.value bond and registers the dispute. msg.sender must
    ///         equal the linked PactEscrow.
    function openDispute(uint256 jobId, address disputer) external payable;

    /// @notice Re-verify attestation against current service.signingAddress.
    ///         On match: dispute fails, disputer's bond → 90% seller, 10% treasury.
    ///         On mismatch: seller bond slashed 70/20/remainder→burn,
    ///         disputer's original bond refunded, job → Slashed.
    function arbitrate(uint256 jobId) external;

    function getBond(uint256 serviceId)
        external view returns (uint128 amount, uint64 withdrawableAt);
    function getDispute(uint256 jobId)
        external view returns (
            address disputer,
            uint128 disputeBond,
            uint64 openedAt,
            bool resolved
        );

    function MIN_BOND() external view returns (uint128); // 5e18 wei (5 $0G, v0.1 hackathon)
}
```

**MIN_BOND — v0.1 hackathon calibration.** Set to 5 $0G (5e18 wei) for v0.1.
The original v0.3 spec called for 100 $0G; that was over-spec'd for the
hackathon mainnet, where the only seller is the demo seller and over-bonding
that wallet would burn $0G with no sybil-resistance benefit. **Production
calibration based on attestation costs + sybil-resistance modeling against a
populated provider set is deferred to v0.2.**

**Slash distribution (pinned).** When `arbitrate()` finds a signer mismatch
and a non-zero bond, the seller's bond is split:

```
toDisputer = sellerBond * 7000 / 10000   // 70%
toTreasury = sellerBond * 2000 / 10000   // 20%
toBurn     = sellerBond - toDisputer - toTreasury   // remainder ≈ 10%, absorbs dust
```

`toBurn` is **computed as the remainder**, not as `sellerBond * 1000 /
10000`. With integer division, `toDisputer` and `toTreasury` can each round
down by up to 1 wei; computing burn as the remainder pushes that dust into
the burn bucket rather than dropping it. Burn = transfer to `address(0)`,
which permanently locks the ETH (no private key). The four shares
(toDisputer, toTreasury, burned, plus the disputer's refunded original
bond) are verified to sum to (sellerBond + originalDisputerBond) by
`invariant_slashDistribution` across 256 × 128k handler calls.

**Failed-dispute distribution.** When recovery succeeds (no fraud), the
disputer's bond is consumed:

```
toTreasury = disputerBond * 1000 / 10000   // 10% protocol fee on griefing
toSeller   = disputerBond - toTreasury     // 90% compensation, absorbs dust
```

§14.1 C1 mandate ("loser pays") satisfied. The seller is the wronged party
in a spurious dispute, so they receive the compensation; the protocol takes
a fee for arbitrating the dispute.

**v0.1 simplification — `arbitrate()` compares against current
`signingAddress`.** PRD §5.5 literal: "If signature now invalid (key
rotated/revoked) OR signer mismatch → slash." v0.1 ships exactly that —
sellers MUST NOT rotate `signingAddress` while jobs are within the dispute
window or face retroactive slashing. Phase 2 adds rotation history
(`signingAddress[]` per service) so legitimate rotations can be
distinguished from silent revocations and only revocations trigger the
slash path.

### 5.6 Gas profile (estimated, mainnet)

| Operation | Gas (est.) | Cost @ 4 gwei |
|---|---|---|
| `registerService` (incl. INFT mint + signingAddress storage) | ~310k | ~0.0012 $0G |
| `stakeBond` | ~50k | ~0.0002 $0G |
| `createJob` | ~95k | ~0.0004 $0G |
| `submitAttestation` (incl. EIP-191 verify) | ~75k | ~0.0003 $0G |
| `reclaimExpired` | ~45k | ~0.0002 $0G |
| `dispute` | ~70k | ~0.0003 $0G |
| `arbitrate` | ~85k | ~0.0003 $0G |

Per-call cost stays under $0.005 USD-equivalent. Sellers can profitably price at fractions of a cent.

---

## 6. 0G integration map (rubric criterion 1)

Every primitive verified live in Phase 0. Each row answers: *what does PACT lose if this primitive is removed?*

| 0G Primitive | What PACT does with it | Phase 0 verification | What breaks if removed |
|---|---|---|---|
| **0G Chain (chainId 16661)** | Hosts all 5 protocol contracts. Settles every job. Emits canonical events. Holds all $0G escrow. RPC `https://evmrpc.0g.ai`. | G2: hello-world deploy verified on chainscan.0g.ai. | Everything. No off-chain fallback. |
| **0G Compute Direct (`@0gfoundation/0g-compute-ts-sdk@0.8.0`)** | Two distinct read paths used by PACT. **Registration:** seller SDK calls `inference.listService()` and reads `signingAddress` (index 9), `additionalInfo.TargetSeparated`, `additionalInfo.ProviderType`, and `additionalInfo.ProviderIdentity` for the chosen provider — all four fields populate `PactRegistry.registerService(...)` with no inference call required. **Per-call attestation:** the same broker proxies inference; each response is followed by `GET ${endpoint}/signature/{chatId}?model={...}` returning the canonical 5-field colon-separated text + ECDSA signature recoverable to the registered `signingAddress`. The per-call signature adds only `contentHash`, `usageHash`, and (for TargetSeparated:true) `tlsCertFingerprint` over what registration already exposes. | G5 PASS: live provider `0xd9966e13...` returns `{text, signature, signing_address: 0x4c1b546f..., signing_algo: "ecdsa", provider_type: "centralized", provider_identity: "openrouter", tls_cert_fingerprint: 0x84c05f5...}`. EIP-191 recovery verified empirically. G5-inspect PASS: same provider's `listService()` index 9 holds the same `0x4C1b546f...` (EIP-55 form) — registration can be seeded from one read. G3 PASS confirmed Router as fallback for non-verification paths (no signature exposed). G4 PASS confirmed signature absent on Router (consistent). | No way to verify what model ran. Reduces to a trust-the-API marketplace. Moat collapses. |
| **0G Storage (`@0gfoundation/0g-storage-ts-sdk@1.2.8`)** | Encrypted output blobs (ECIES-to-buyer) stored, rootHash anchored on-chain. KV layer for mutable per-INFT reputation event log. | G6 PASS: 1KB roundtrip in 20s (16s up / 4s down), rootHash `0x31f1dbc6...` matched bytes-for-bytes, txSeq `96220`. Storage Indexer at `https://indexer-storage-turbo.0g.ai`, Flow contract `0x62D4144dB0F0a6fBBaeb6296c785C71B3D57C526`. | Outputs would have to live in centralized blob storage. Not censorship-resistant, not portable across buyers. Breaks the "verifiable audit history" claim. |
| **ERC-7857 INFT (forked from `github.com/0gfoundation/0g-agent-nft`)** | Seller identity. Each seller's service is bound to an INFT. Reputation accrues to the INFT, not the wallet. INFT is transferable → reputation is transferable → secondary market for proven-good agents. | G7 PASS: `0g-agent-nft` HEAD `b86e108a` compiles unmodified under 0.8.24+cancun via Foundry remappings to upstream's `node_modules/@openzeppelin/*` (Hardhat→Foundry interop pattern). | Reputation becomes wallet-bound (sybil-vulnerable, non-transferable). The "tokenized reputation" narrative disappears. |
| **0G DA** | All `JobCreated`, `JobAttested`, `JobSettled`, `JobDisputed`, `JobSlashed` events anchored via DA layer. 50 Gbps spec future-proofs against scaling beyond hackathon volume. | Architectural — at hackathon volume the indexer reads directly from chain. DA wiring is in place; the load is what makes it load-bearing. | At hackathon volume removable; production breaks at scale. Listed because we wire it now to avoid V2 migration pain. |

---

## 7. Off-chain services

### 7.1 Buyer SDK (`@pact/sdk`, TypeScript)

Published to npm. Three lines to integrate.

```typescript
import { PactClient } from '@pact/sdk';

const pact = new PactClient({
  rpcUrl: 'https://evmrpc.0g.ai',
  signer: walletClient,
});

const result = await pact.inference({
  capability: 'code-review',
  input: 'Review this Solidity contract: ...',
  maxFee: parseEther('0.01'),
  timeout: 300, // seconds
});

// result.output is decrypted plaintext
// result.attestation is the verifiable receipt (text + signature + signing_address)
// result.txHash is the settlement tx
```

Internal: discovery (`getSellersByCapability`) → key derivation (deterministic ECIES from wallet sig) → encryption → `createJob` → poll `JobAttested` event → fetch from 0G Storage → decrypt → optional client-side `MessageHashUtils + ECDSA.recover` to confirm signing_address → return.

The SDK does NOT use OpenAI-compatible Router under the hood — Router can't sign. Tradeoff accepted: we lose drop-in OpenAI compatibility as a public selling point but gain cryptographic verifiability.

### 7.2 Seller reference agent (Node.js)

Open-source reference impl. Sellers fork and plug in. Demonstrates:

- INFT mint + bond stake on first run
- `acknowledgeProviderSigner(providerAddress)` against chosen 0G Compute provider, persists `signingAddress` + `providerIdentity`
- Event listener for `JobCreated` (filtered to seller's serviceIds)
- ECIES decryption of buyer input
- 0G Compute Direct call via `@0gfoundation/0g-compute-ts-sdk` `createZGComputeNetworkBroker(wallet)` + `inference.listService()` + `getServiceMetadata()` + chat completion
- Follow-up `GET ${endpoint}/signature/{chatId}?model={...}` to fetch attestation text + signature
- Output ECIES encryption for buyer
- 0G Storage upload (`@0gfoundation/0g-storage-ts-sdk@1.2.8`)
- `submitAttestation` call with `(jobId, outputRootHash, chatId, attestationText, attestationSignature)`

Demo seller runs `zai-org/GLM-5-FP8` with capability `code-review`. Pre-staked, pre-registered before recording.

### 7.3 Indexer (Next.js API + Postgres via Supabase)

Subscribes to chain events, writes to Postgres. Powers marketplace, explorer, reputation queries. Listed in §9.

### 7.4 API server (Next.js API routes)

- `GET /api/services` — paginated, filterable seller list
- `GET /api/services/[id]` — service detail + reputation
- `GET /api/jobs/[id]` — job detail with full crypto chain
- `GET /api/jobs?seller=X&buyer=Y` — filtered job feed
- `GET /api/sellers/[addr]` — all services by seller
- `GET /api/stats/global` — protocol-wide stats
- `POST /api/encrypt-test` (dev only) — utility for seller setup

---

## 8. Cryptographic primitives

### 8.1 ECIES over secp256k1 (input + output encryption)

Library: `eciesjs`. Both directions use the same scheme.

- Buyer ephemeral keypair: derived deterministically from wallet sig over `keccak256("PACT::ECIES_KEY::v1")`. Same wallet always derives same keypair.
- Seller pubkey: stored at registration. Seller derives from wallet the same way.

### 8.2 Commit-reveal ordering (the moat)

Order enforced by contract state transitions:

1. **Buyer commits** by emitting `JobCreated(inputCommitment = keccak256(encryptedInput))`.
2. Seller decrypts, runs Direct broker inference, gets attestation text + signature from `/signature/{chatId}` endpoint.
3. **Seller commits** by calling `submitAttestation(...)` — signature recovery anchors the entire 5-field text on-chain BEFORE buyer sees the output.
4. **Reveal happens AFTER commit:** seller uploads encrypted output to 0G Storage at the committed `outputRootHash`. Buyer fetches, decrypts.

NeuroDegen pattern transplanted: agent commits hash before action, reveals after.

### 8.3 TEE attestation verification (Phase 0 verified, locked)

**On-chain (contract):** `AttestationVerifier.recover()` performs EIP-191 ECDSA recovery using OpenZeppelin's `MessageHashUtils.toEthSignedMessageHash` + `ECDSA.recover`. Recovered signer compared against `service.signingAddress` stored at registration.

**The canonical attestation text format** (from live `/signature/{chatId}` endpoint):

```
<contentHash>:<usageHash>:<providerType>:<providerIdentity>:<tlsCertFingerprint>
```

Real example captured in Phase 0:
```
df0870f9b6a0bafc8223cebee0581160c6ea69876e57be3fa4e412450cd0b88e:0a2d1a40916f10253302e59bd1f1ea7dca6616fe4e816e3cd683310c5711eed6:centralized:openrouter:84c05f5412b2f6357c22c1fd3f9d345b9ac02e99254491a05b589b46570d3ba9
```

Field semantics:
- `contentHash` — 32-byte hex hash of the response message content (canonicalization recipe pinned in §8.4)
- `usageHash` — 32-byte hex hash of the response usage JSON
- `providerType` — `centralized` (TLS-pinned proxy to upstream LLM) or `tee` (model in enclave; TeeML)
- `providerIdentity` — upstream provider name (e.g. `openrouter`, `Together`, `StreamLake`)
- `tlsCertFingerprint` — 32-byte SHA-256 of the upstream TLS certificate (binds the attestation to a specific endpoint — substitution attack prevention)

**Signature scheme:** ECDSA-secp256k1 over the EIP-191-prefixed message:
```
keccak256("\x19Ethereum Signed Message:\n" + utf8Length(text) + text)
```

65-byte signature in `r || s || v` format (`v` ∈ {27, 28}). Standard `ECDSA.recover()` handles it.

**Mode classification — `TargetSeparated` is canonical, `verifiability` is unreliable.**
The `verifiability` field on a `listService()` entry (index 7) is misleading on
0G mainnet today: the same provider that the G3 Router catalog labels
`TeeTLS` is labelled `TeeML` by `listService()`. The actual mode discriminator
is **`additionalInfo.TargetSeparated`** in the same `listService()` entry
(index 8 JSON). PactRegistry stores `targetSeparated` as the source of truth
and ignores the `verifiability` label entirely.

- `TargetSeparated: true` ⇒ proxied (TeeTLS-semantic). Model runs upstream
  (e.g. on OpenRouter); the 0G TEE proxy attests over the proxied call and
  pins the upstream's TLS certificate fingerprint. The 5-field text's
  `providerType` and `providerIdentity` carry the upstream service identity
  ("centralized" / "openrouter" in G5); `tlsCertFingerprint` is non-zero.
- `TargetSeparated: false` ⇒ in-enclave (TeeML-semantic). Model runs inside
  the TDX enclave. There is no upstream API to identify, so `providerType`
  and `providerIdentity` in the signed text MAY be empty strings. The last
  colon-field is expected to repurpose from `tlsCertFingerprint` toward the
  enclave image digest (currently empty in registration; will populate once
  0G publishes attestation images).

**v0.1 ships TargetSeparated:true (TeeTLS) providers only.** This is the only
mode confirmed end-to-end in Phase 0 — G5 captured a live signature payload,
G5-inspect confirmed registry alignment. **TargetSeparated:false (TeeML) is a
forward-compatible extension** — the verifier contract is unchanged (same
EIP-191 ECDSA recovery against the registered `signingAddress`); only
`parseAttestationText`'s field semantics differ. A funded G8 probe will
confirm the exact TeeML payload shape; that probe is parked behind video-prep
priority and is no longer architecturally required.

### 8.4 Buyer-side content verification

On output decrypt, buyer locally computes `hash1` from the decrypted message content using the SDK's canonicalization recipe. If `hash1 != attestationText.contentHash` → buyer can dispute (the seller signed an attestation for content different from what was delivered).

**Open Phase 1 task:** extract the exact content/usage canonicalization recipe from `@0gfoundation/0g-compute-ts-sdk@0.8.0` source. Phase 0 confirmed neither raw `keccak256` nor raw `sha256` of the visible content matches the attestation hashes — the SDK applies normalization (likely JSON canonicalization, possibly including model id, response id, or chat id). Spike budget: 1 hour.

This affects only the buyer-side dispute trigger, not the on-chain verifier. The contract verification (§8.3) is complete and verified.

---

## 9. Data model

### 9.1 On-chain state

| Storage | Contract | Purpose |
|---|---|---|
| `services[uint256]` | PactRegistry | All services, by serviceId |
| `sellerServices[address]` | PactRegistry | Reverse lookup |
| `jobs[uint256]` | PactEscrow | All jobs, by jobId |
| `reputations[uint256]` | ReputationVault | Reputation per serviceId |
| `bonds[uint256]` | SlashingArbiter | Bond per serviceId |

### 9.2 Off-chain Postgres schema (Supabase)

```sql
CREATE TABLE services (
  id BIGINT PRIMARY KEY,
  inft_token_id BIGINT NOT NULL,
  seller_address TEXT NOT NULL,
  capability_tag TEXT NOT NULL,
  capability_hash TEXT NOT NULL,
  model_id TEXT NOT NULL,                     -- e.g. "zai-org/GLM-5-FP8"
  model_commitment TEXT NOT NULL,
  provider_address TEXT NOT NULL,             -- 0G Compute provider EVM addr
  signing_address TEXT NOT NULL,              -- TEE proxy signing key
  provider_identity TEXT NOT NULL,            -- "openrouter" / "Together" / etc.
  provider_type TEXT NOT NULL,                -- "centralized" | "tee"
  price_per_call NUMERIC(78,0) NOT NULL,
  max_input_bytes BIGINT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  registered_at TIMESTAMPTZ NOT NULL,
  metadata_uri TEXT,
  display_name TEXT,
  description TEXT,
  sample_outputs JSONB DEFAULT '[]'::jsonb
);
CREATE INDEX ON services(capability_hash);
CREATE INDEX ON services(seller_address);
CREATE INDEX ON services(active);
CREATE INDEX ON services(provider_type);

CREATE TABLE jobs (
  id BIGINT PRIMARY KEY,
  service_id BIGINT NOT NULL REFERENCES services(id),
  buyer_address TEXT NOT NULL,
  seller_address TEXT NOT NULL,
  amount NUMERIC(78,0) NOT NULL,
  protocol_fee NUMERIC(78,0),
  state TEXT NOT NULL,
  input_commitment TEXT NOT NULL,
  output_root_hash TEXT,
  chat_id TEXT,                               -- bytes32 of the UUID from zg-res-key header
  attestation_text TEXT,                      -- canonical 5-field colon-separated payload
  attestation_signature TEXT,                 -- 0x-prefixed 65-byte sig
  recovered_signer TEXT,                      -- recovered EVM address (for explorer convenience)
  tls_cert_fingerprint TEXT,                  -- parsed from attestation_text
  created_at TIMESTAMPTZ NOT NULL,
  attested_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  timeout_at TIMESTAMPTZ NOT NULL,
  create_tx_hash TEXT NOT NULL,
  settle_tx_hash TEXT,
  encrypted_input_url TEXT
);
CREATE INDEX ON jobs(service_id);
CREATE INDEX ON jobs(buyer_address);
CREATE INDEX ON jobs(state);
CREATE INDEX ON jobs(created_at DESC);

CREATE TABLE reputations (
  service_id BIGINT PRIMARY KEY REFERENCES services(id),
  total_jobs BIGINT NOT NULL DEFAULT 0,
  total_volume NUMERIC(78,0) NOT NULL DEFAULT 0,
  weighted_score NUMERIC(78,0) NOT NULL DEFAULT 0,
  first_job_at TIMESTAMPTZ,
  last_job_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bonds (
  service_id BIGINT PRIMARY KEY REFERENCES services(id),
  amount NUMERIC(78,0) NOT NULL,
  staked_at TIMESTAMPTZ NOT NULL,
  withdrawable_at TIMESTAMPTZ
);

CREATE TABLE indexer_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 9.3 RLS policies

```sql
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
CREATE POLICY services_read ON services FOR SELECT USING (true);
-- No INSERT/UPDATE/DELETE policy = blocked from anon/authenticated. Indexer uses service-role key.

-- Same pattern for jobs, reputations, bonds.
REVOKE ALL ON indexer_state FROM anon, authenticated;
```

### 9.4 Indexer event ingestion

Single Node.js process on Railway. Subscribes to `eth_newHeads`, queries logs for the 5 contract addresses, upserts. Maintains `last_block_indexed`. Reorg-safe with 5-block confirmation lag.

---

## 10. API surface

### 10.1 Buyer SDK

```typescript
class PactClient {
  constructor(opts: { rpcUrl: string; signer: WalletClient; chainId?: 16661 });

  getServices(filter?: { capability?: string; minReputation?: bigint; maxPrice?: bigint; providerType?: 'centralized' | 'tee' }): Promise<Service[]>;
  getService(serviceId: bigint): Promise<Service>;
  getReputation(serviceId: bigint): Promise<Reputation>;

  inference(opts: {
    capability?: string;
    serviceId?: bigint;
    input: string | Uint8Array;
    maxFee: bigint;
    timeout?: number;
  }): Promise<{
    output: string | Uint8Array;
    attestation: { text: string; signature: string; signingAddress: string; recoveredSigner: string };
    jobId: bigint;
    txHash: string;
    settledAt: Date;
  }>;

  getJob(jobId: bigint): Promise<Job>;
  reclaimExpired(jobId: bigint): Promise<TxReceipt>;
  dispute(jobId: bigint, bond: bigint): Promise<TxReceipt>;

  verifyAttestation(receipt: AttestationReceipt): Promise<boolean>;
}
```

### 10.2 Seller SDK

```typescript
class PactSeller {
  constructor(opts: {
    rpcUrl: string;
    signer: WalletClient;
    computeBroker: ZGComputeNetworkBroker;  // from @0gfoundation/0g-compute-ts-sdk
  });

  registerService(opts: {
    capability: string;
    modelId: string;          // e.g. "zai-org/GLM-5-FP8"
    providerAddress: string;  // 0G Compute provider EVM addr
    pricePerCall: bigint;
    maxInputBytes: number;
    description: string;
  }): Promise<{ serviceId: bigint; inftTokenId: bigint; signingAddress: string }>;

  stakeBond(serviceId: bigint, amount: bigint): Promise<TxReceipt>;
  start(opts: { serviceIds: bigint[]; handler: InferenceHandler }): Promise<void>;
  stop(): Promise<void>;
}
```

---

## 11. Pinned dependencies

```json
{
  "node": "20.18.0",
  "pnpm": "10.33.0",
  "next": "15.0.3",
  "react": "19.0.0",
  "typescript": "5.6.3",
  "tailwindcss": "4.0.0-beta.3",
  "viem": "2.21.45",
  "wagmi": "2.13.0",
  "@rainbow-me/rainbowkit": "2.2.0",
  "@supabase/supabase-js": "2.46.1",
  "@0gfoundation/0g-compute-ts-sdk": "0.8.0",
  "@0gfoundation/0g-storage-ts-sdk": "1.2.8",
  "@openzeppelin/contracts": "5.0.2",
  "@openzeppelin/contracts-upgradeable": "5.0.2",
  "eciesjs": "0.4.13",
  "ethers": "6.13.4",
  "zod": "3.23.8"
}
```

```toml
# foundry.toml
[profile.default]
solc_version = "0.8.24"
evm_version = "cancun"
optimizer = true
optimizer_runs = 200
remappings = [
  "@openzeppelin/contracts/=node_modules/@openzeppelin/contracts/",
  "@openzeppelin/contracts-upgradeable/=node_modules/@openzeppelin/contracts-upgradeable/"
]
```

```
# foundry version locked from Phase 0 G7 verification
forge Version: 1.6.0-v1.6.0-t3-tempo
```

**Note:** the `openai` package is dropped from v0.1's deps. Router path is non-canonical for PACT (no signature). Direct broker only.

---

## 12. Repo structure

```
trypact/
├─ apps/
│  ├─ web/                    # Next.js 15 — landing + dashboard + explorer
│  ├─ indexer/                # Node.js event indexer
│  └─ seller-reference/       # Reference seller agent
├─ packages/
│  ├─ sdk/                    # @pact/sdk (buyer)
│  ├─ seller-sdk/             # @pact/seller-sdk
│  ├─ contracts/              # Foundry project (forks 0g-agent-nft)
│  └─ shared/                 # Types, ABIs, constants
├─ docs/
│  ├─ MASTER_PRD.md           # this file
│  ├─ FRONTEND_PRD.md         # next deliverable
│  ├─ ARCHITECTURE.md
│  ├─ DEMO_SCREENPLAY.md
│  ├─ AGENT_PROGRESS.md       # rolling build log
│  └─ design/                 # Antimetal design system tokens
├─ scripts/
│  ├─ day0/                   # Phase 0 probes (5/5 PASS as of 2026-05-07)
│  ├─ deploy-mainnet.ts
│  ├─ register-test-providers.ts
│  └─ seed-demo-jobs.ts
├─ pnpm-workspace.yaml
├─ turbo.json
├─ CLAUDE.md
└─ README.md
```

---

## 13. Build order (phase-gated)

### Phase 0 — Foundation & Day 0 validation ✅ COMPLETE (2026-05-07)

5/5 gates PASS. Decisions logged in `docs/AGENT_PROGRESS.md` 2026-05-07 entry. Phase 1 unblocked.

Verified:
- Mainnet RPC + chain ID + faucet path
- SDK package names + versions
- Direct broker inference flow + signature endpoint
- Storage roundtrip (rootHash matches bytes-for-bytes)
- INFT reference contract compiles unmodified
- Attestation cryptography: EIP-191 personal_sign over canonical 5-field text

### Phase 1 — Contracts ✅ COMPLETE (2026-05-07)

- [x] **AttestationVerifier** ✅ COMPLETE (2026-05-07) — ~95 lines, OZ-only, validated bytes-for-bytes against the G5 captured payload via `test_recoverMatchesLiveSigner`.
- [x] **PactRegistry + ERC-7857 INFT integration** ✅ COMPLETE (2026-05-07) — `0g-agent-nft@b86e108a` forked into `packages/contracts/src/inft/` (11 files, minimal closure). `getSellerServices` follows INFT ownership.
- [x] **PactEscrow with full state machine** ✅ COMPLETE (2026-05-07) — Pending → Settled atomic; chatId replay protection (§14.1 A2); pull-pattern fee sweep; 5-arg constructor wires the registry, verifier, vault, arbiter, treasury.
- [x] **ReputationVault** ✅ COMPLETE (2026-05-07) — sqrt-discounted weight, INFT-bound (transfer-portable), no time decay in v0.1. OZ Math.sqrt (no new deps).
- [x] **SlashingArbiter** ✅ COMPLETE (2026-05-07) — 5 $0G MIN_BOND (v0.1 hackathon calibration; was 100 $0G in v0.3, recalibrated 2026-05-08); two-phase withdrawal (request → 7d → withdraw); slash distribution 70/20/remainder→burn; full register→settle→dispute→arbitrate→slash pipeline tested with G5 fixture (`test_arbitrate_invalidSignature_slashes_70_20_10`).
- [x] **Foundry test suite** ✅ COMPLETE (2026-05-07) — 45 unit + 10 invariants = 55/55 green. Each invariant runs 256 × 128k handler calls with zero reverts.
- [ ] Mainnet deploy via `scripts/deploy-mainnet.ts` — Step 2F, queued.
- [ ] Verify all 5 on chainscan.0g.ai — Step 2G, queued.

**Exit (contract layer):** ✅ Phase 1 contracts complete and locally green. Deploy + chainscan verification remaining for full Phase 1 EXIT.

### Phase 1.5 — SDK source spike (parallel, 1 hour)

- [ ] Read `@0gfoundation/0g-compute-ts-sdk@0.8.0` source (specifically `processResponse` internals) to extract the canonicalization recipe used to compute `contentHash` and `usageHash` in the attestation text.
- [ ] Document recipe in `docs/ATTESTATION_RECIPE.md`. This unblocks buyer-side dispute trigger.

### Phase 2 — Buyer SDK (Days 5–6)

- [ ] ECIES wrapper with deterministic key derivation
- [ ] Service discovery + reputation queries
- [ ] `inference()` end-to-end happy path
- [ ] Event polling + status callbacks
- [ ] Client-side attestation verification (`MessageHashUtils + ECDSA.recover` in TS via `viem`)
- [ ] Vitest unit tests against local fork
- [ ] Publish `@pact/sdk@0.1.0` to npm

**Exit:** SDK installable, demo script makes a real mainnet call end-to-end.

### Phase 3 — Indexer + API (Days 7–8)

- [ ] Supabase project provisioned, schema applied, RLS verified
- [ ] Indexer subscribes to events, ingests
- [ ] All 6 REST endpoints
- [ ] Deployed to Railway
- [ ] 100% recovery from cold start

**Exit:** indexer running 24/7, REST API median <200ms.

### Phase 4 — Seller reference agent (Days 9–10)

- [ ] INFT mint + bond stake on first run
- [ ] `acknowledgeProviderSigner` flow + signingAddress capture
- [ ] Event listener + decrypt + Direct broker inference + signature fetch + encrypt + Storage upload + attestation
- [ ] Configuration via `.env`
- [ ] Open-sourced as `apps/seller-reference`

**Exit:** running our own reference seller against mainnet, accepting jobs.

### Phase 5 — Frontend (Days 11–13)

Detailed in **FRONTEND_PRD.md** (next doc deliverable). High-level:
- Landing page (Antimetal design system)
- Marketplace (browse sellers)
- Service detail (reputation + sample + request flow)
- Job status (live state machine)
- Output reveal + decrypt + client-side signature recovery
- Explorer (firehose, anonymized)
- Seller dashboard (mint INFT, manage service, view earnings)

**Exit:** all routes deployed Vercel `trypact.xyz`, end-to-end demo recordable.

### Phase 6 — Submission (Days 14–15)

- [ ] Code freeze 48–72hr before deadline
- [ ] README polished with judge reproduction steps (Day 0 probes are the template)
- [ ] 3-min demo video shot per `DEMO_SCREENPLAY.md`
- [ ] X post drafted (per §18)
- [ ] HackQuest submission filled
- [ ] Pitch deck (8 slides, optional but high-leverage)
- [ ] Post-mortem doc

---

## 14. Security threat model

### 14.1 Attack tree

```
Goal: extract value from PACT
│
├─ A. Steal escrow without delivering service
│   ├─ A1. Submit forged attestation
│   │      → Mitigated: ECDSA recover ≠ registered signingAddress → tx reverts
│   ├─ A2. Reuse old attestation (replay)
│   │      → Mitigated: chatId in Job struct, must match attestation;
│   │                   attestation also includes contentHash/usageHash unique per call
│   ├─ A3. Use a different model than committed
│   │      → DEFERRED to Phase 2 hardening — G5-inspect (2026-05-07)
│   │        confirmed each 0G provider has one signing key across its
│   │        served models, so cross-provider key sharing is not a
│   │        current threat. v0.1 ships A1 (signing-key recovery) +
│   │        A2 (chatId replay). v0.2 adds A3 (parsed
│   │        providerType/providerIdentity match against Service
│   │        registration).
│   └─ A4. Submit attestation without delivering output
│          → Mitigated: outputRootHash on-chain; buyer verifies storage retrieval
│
├─ B. Inflate reputation (Sybil)
│   ├─ B1. Many fake buyers, self-trade
│   │      → Mitigated: buyer weight = sqrt(buyer_total_paid)
│   └─ B2. Wash-trade through accomplice
│          → Mitigated: protocol fee makes loops economically negative
│
├─ C. Grief sellers via spurious disputes
│   ├─ C1. Dispute every job
│   │      → Mitigated: dispute bond ≥ 2× arbitration cost; loser pays
│   └─ C2. Time disputes pre-bond-withdrawal
│          → Mitigated: 24h dispute window; bond withdrawal has 7d delay
│
├─ D. Drain bond
│   ├─ D1. Front-run withdrawal with dispute
│   │      → Mitigated: bond locked while jobs are active OR there are
│   │                   open disputes during the 7-day withdrawal delay
│   │                   window — `withdrawBond` reverts on either
│   │                   condition (PRD §5.5).
│   └─ D2. Manipulate signing key registry
│          → Mitigated: signingAddress is per-service, set at registration,
│                       rotation event-emitted; arbiter uses current state
│                       so retroactive revocations are slashable
│
├─ E. Censor / DoS
│   ├─ E1. Spam createJob to fill mempool
│   │      → Mitigated: createJob requires escrow > 0
│   └─ E2. Censor specific seller via validator collusion
│          → Out-of-scope: 0G Chain validator security
│
└─ F. NEW: TeeTLS provider colludes with upstream LLM
    │  (e.g. OpenRouter and 0G provider together substitute model output)
    │  → Mitigated only at the trust boundary: providerIdentity is signed and
    │    on-chain; reputation reflects historical providerIdentity changes;
    │    dispute path catches signingAddress rotation/revocation
    │  → Honest framing in §4.2: PACT cryptographically attests *which provider
    │    + which TLS endpoint* served the call, not that the upstream LLM is honest.
    │    Upstream provider trust is reputational, not cryptographic.
```

### 14.2 Audit checklist (pre-submission)

- [ ] Reentrancy: external calls follow checks-effects-interactions; nonReentrant on state-changers
- [ ] Integer overflow: 0.8.24 native checks; verify no `unchecked` blocks except gas-critical loop counters
- [ ] Access control: ownable only on the optional registry-key-rotation function for v0.1; all else permissionless
- [ ] Front-running: createJob escrowed → no price manipulation; attestation is seller-specific
- [ ] Time manipulation: `block.timestamp` only for timeouts with >5min granularity
- [ ] ECDSA malleability: OpenZeppelin's `ECDSA.recover` already enforces s ∈ low-s
- [ ] EIP-191 prefix: confirm `MessageHashUtils.toEthSignedMessageHash` used, not raw hash
- [ ] Slither + Mythril clean run
- [ ] All tests passing including invariant suite

---

## 15. Test plan

### 15.1 Foundry contract tests

≥30 unit, ≥5 invariant, ≥10 integration. ~95% line coverage.

**Ground-truth oracle** for AttestationVerifier tests: the captured Phase 0 G5 tuple. Hardcode in test fixtures:
```solidity
bytes constant CAPTURED_TEXT = "df0870f9b6a0bafc8223cebee0581160c6ea69876e57be3fa4e412450cd0b88e:0a2d1a40916f10253302e59bd1f1ea7dca6616fe4e816e3cd683310c5711eed6:centralized:openrouter:84c05f5412b2f6357c22c1fd3f9d345b9ac02e99254491a05b589b46570d3ba9";
bytes constant CAPTURED_SIG = hex"99946cf42f441ae8756cc899f74054926c8b9d4ae5b570499783da23ae73393a647dc0f9a188159876d1ba52b42bdc0b837ccaaf0ccf79b93449a16b1f9fab831c";
address constant CAPTURED_SIGNER = 0x4C1b546f5Fc11A9c2428eaFEd1D951Aa13C17ee8;

function test_recoverMatchesLiveSigner() public {
    address recovered = verifier.recover(CAPTURED_TEXT, CAPTURED_SIG);
    assertEq(recovered, CAPTURED_SIGNER);
}
```

Key invariants:
- `sum(escrow_balances) == address(this).balance - sum(protocol_fees_pending)`
- `forall job: state == Settled => verifier.recover(job.attestationText, job.attestationSignature) == service.signingAddress`
- `forall service: bond[service] >= MIN_BOND OR service.active == false`
- `forall job: state in [Settled, Slashed] => job.amount distributed (escrow == 0)`

### 15.2 Integration tests (against mainnet fork)

- Full happy path: register → stake → create job → attest with real Phase 0 fixture → settle. Verify all events.
- Timeout path
- Dispute path (forged attestation, signer rotation post-settlement)

### 15.3 E2E tests (Playwright, against staging)

Buyer / Seller / Auditor flows.

### 15.4 Adversarial / fuzz tests

Foundry invariant runner with handler contracts. 10k+ runs before submission.

---

## 16. Deployment

### 16.1 Network targets

| Component | Target | Notes |
|---|---|---|
| Contracts | 0G Mainnet (chainId 16661) | Deploy via Foundry script |
| Frontend | Vercel | global edge |
| Indexer | Railway | us-east |
| Database | Supabase | us-east-1 |
| RPC primary | `https://evmrpc.0g.ai` | |
| Storage indexer | `https://indexer-storage-turbo.0g.ai` | |
| Domain | `trypact.xyz` (acquire Day 1) | |

### 16.2 Deployment script

`scripts/deploy-mainnet.ts` sequence (v0.4, finalized after Phase 1
contracts):

```
1. AttestationVerifier()
2. AgentNFT impl + ERC1967Proxy(impl, initData) with initialize()
   (AgentNFT's constructor calls _disableInitializers() — direct
    deployment cannot be initialized; the proxy is the entry point.)
3. PactRegistry(agentNFT)
4. predictedEscrow = vm.computeCreateAddress(deployer, nonce + 2)
5. ReputationVault(predictedEscrow)
6. SlashingArbiter(registry, predictedEscrow, verifier, treasury)
7. PactEscrow(registry, verifier, vault, arbiter, treasury)
   require(address(escrow) == predictedEscrow, "deploy address mismatch")
8. agentNFT.grantMinterRole(pactRegistry)
```

**3-way immutable cycle.** PactEscrow has an immutable `arbiter`,
SlashingArbiter has an immutable `escrow`, and ReputationVault has an
immutable `escrow` — three forward references that must all resolve
to the *same* address before any of the three contracts can be
constructed. Setters would break the access-control story: if vault or
arbiter accepted a post-deploy `setEscrow(addr)` call, anyone who could
race the deployer's tx could redirect every settlement and slash. We
resolve the cycle deterministically by **predicting the PactEscrow
CREATE address** from the deployer's nonce *before* deploying vault or
arbiter, then asserting the prediction held when escrow lands at step
7. Vault and arbiter both reference the same `predictedEscrow`; escrow
references the just-deployed vault and arbiter directly. v0.2 may
revisit this with a one-shot setter guarded by a deploy-only key
(deployer-locked initializer pattern) for cleaner manifests, but v0.1
takes the immutable-only path because it's strictly safer and the
prediction overhead is one nonce read at deploy time.

Idempotent. Manifest written to `deployments/mainnet.json` carrying
all 5 contract addresses, the AgentNFT proxy + impl, deployer address
+ tx hashes, and the predicted-vs-actual escrow address (asserted
equal at step 7). Verified on chainscan.0g.ai. Addresses
re-propagated to `apps/web/src/config/contracts.ts` and
`packages/shared/contracts.ts` after each deploy.

---

## 17. Demo screenplay (3-minute video)

### Beat 0 (0:00–0:08) — Cold open

Black screen, white text fade in:
> **"AI agents are about to become the largest economic actors in Web3.**
> **Today, no one can prove what model they actually ran."**

Cut to PACT landing page.

### Beat 1 (0:08–0:35) — Marketplace

Screen recording: marketplace at `trypact.xyz/marketplace`. Filter by "code-review". Sort by reputation. Three real seller INFT cards, each with TEE-attested job history. VO: "Every seller is an INFT on 0G mainnet. Every reputation point comes from a TEE-attested job. Every attestation is a recoverable ECDSA signature. Click any job — verify the signing address yourself in your browser."

### Beat 2 (0:35–1:30) — The split-screen TEE moment ★

Two panes:

LEFT: buyer's view. Plaintext prompt: `"Review this Solidity contract for reentrancy: ..."`. Hits submit.

RIGHT: simulated provider node operator's terminal. Shows only ECIES ciphertext: `0x9f3c2a4b8e5d...`. Cannot see the prompt.

CENTER overlay: live state machine. PENDING → SEALED → ATTESTED → SETTLED. ATTESTED moment shows a popup: *"signing address recovered: `0x4C1b546f...` — matches registered key for provider `0xd9966e13...` ✓"*. Real chainscan.0g.ai tx links on each transition.

VO: "Sealed. Routed through 0G Compute Direct. TEE-signed attestation fetched from `/signature/{chatId}`. ECDSA-recovered on-chain in one block. Settled. Eight seconds, end-to-end, on 0G mainnet."

### Beat 3 (1:30–2:15) — Reputation-is-the-INFT moment

Click on the seller INFT we just paid. Page: 47 jobs, $234 lifetime volume, weighted score 89/100. Below: scrollable list of every job, each with attestation hash. Click one from 8 days ago — verify signature in-browser. Green check. VO: "Reputation isn't a star rating. It's an on-chain chain of TEE-signed attestations. Try to fake it — you can't. Try to transfer it — you can. Sell the agent, sell its reputation. INFTs become economic instruments."

### Beat 4 (2:15–2:50) — Integration shot

IDE. Three lines:

```typescript
const pact = new PactClient({ rpcUrl: 'https://evmrpc.0g.ai', signer });
const result = await pact.inference({ capability: 'code-review', input: prompt, maxFee });
console.log(result.output);
```

VO: "Three lines. Any developer on 0G plugs in. Sellers fork our reference agent. The marketplace bootstraps itself."

### Beat 5 (2:50–3:00) — Close

Single line, Instrument Serif:
> **"PACT. Trust the math. Pay the agent."**

Below, mono small print: `trypact.xyz · github.com/winsznx/pact · 0G APAC Hackathon · Track 3`.

End.

### Production notes

- 1080p60, OBS Studio
- VO: ElevenLabs studio quality
- Music: ambient, low, copyright-safe
- Every chainscan.0g.ai link in the video is a real verifiable mainnet tx

---

## 18. Submission checklist

- [ ] Project: PACT — Provable Agent-to-Agent Compute Trust
- [ ] One-liner (≤30 words): *"Settlement protocol for AI-as-a-Service on 0G — buyers pay sellers for inference with cryptographic guarantee of model and execution, settled on-chain."*
- [ ] Summary (problem / solution / 0G components used)
- [ ] GitHub: `github.com/winsznx/pact`, public, MIT, ≥80 commits
- [ ] 0G mainnet contract addresses + chainscan.0g.ai links (5 contracts)
- [ ] Explorer link to a real settled job
- [ ] Demo video (≤3 min, YouTube unlisted)
- [ ] README (overview, architecture diagram, 0G modules, deployment steps, faucet/reviewer notes)
- [ ] X post live with required hashtags + tags

### 18.1 X post template

```
PACT — Provable Agent-to-Agent Compute Trust

The settlement protocol every 0G agent project will need.

· Sellers mint Agent INFTs (ERC-7857)
· Buyers pay per inference, with TEE-attested model+output proof
  recoverable on-chain in one block via standard ECDSA
· Reputation accrues to the INFT itself — transferable
· 5/5 0G primitives load-bearing (Chain · Compute Direct · Storage ·
  INFT · DA)

Live on 0G mainnet → trypact.xyz

[demo clip showing the split-screen TEE moment — 30 seconds]

#0GHackathon #BuildOn0G
@0G_labs @0g_CN @0g_Eco @HackQuest_
```

---

## 19. Risk register (Phase 0 updated)

| # | Risk | v0.1 status | Current status |
|---|---|---|---|
| 1 | TEE attestation extractable | Open | **RESOLVED** — Direct path returns full ECDSA payload (G5 PASS, 2026-05-07). |
| 2 | On-chain ECDSA verify works on 0G | Open | **RESOLVED** — both honest and adversarial paths verified with captured G5 bytes. `test_submitAttestation_validG5Fixture_settles` and `test_arbitrate_invalidSignature_slashes_70_20_10` drive the full positive and negative pipelines. |
| 3 | $0G mainnet token acquisition | Open | **RESOLVED** — KuCoin path worked, 6.46 $0G acquired |
| 4 | 0G mainnet RPC unstable | Open | Low — `evmrpc.0g.ai` stable across all 7 Phase 0 calls |
| 5 | Indexer can't keep up | Architectural | Low — hackathon volume |
| 6 | Foundry can't deploy 0.8.24+cancun | Open | **RESOLVED** — G7 confirmed clean compile of full `0g-agent-nft@b86e108a`; Phase 1 Step 2A re-confirmed against the minimal closure forked into `src/inft/`. |
| 7 | INFT reference contract has bugs | Open | **RESOLVED** — 11-file minimal closure compiles clean, integrated cleanly through Steps 2B–2D. ERC-7857 transfer + ownership transfer + reputation portability all green via `test_reputationTransfersWithINFT`. |
| 8 | Domain `pact.xyz` taken | Open | **RESOLVED** — using `trypact.xyz`. |
| 9 | No buyers on launch | Med | Demo uses our own buyer + seller; real bootstrap is post-hack |
| 10 | Demo video runs over | Med | T-72hr code freeze leaves 48hr |
| 11 | **NEW**: TeeML signature payload differs from TeeTLS | New | **PARKED (v0.3)** — not architecturally required after pre-flight registry discovery (G5-inspect confirmed `signingAddress` lives at `listService()` index 9 for both modes). Verifier contract is unchanged across modes. Run the funded G8 probe for video narrative only — clean TeeTLS vs TeeML trust-ladder contrast in the 3-min demo. |
| 12 | **NEW**: SDK content/usage canonicalization recipe unknown | New | **Open Phase 1.5** — extract from SDK source, 1-hour spike. Affects buyer-side dispute trigger, not on-chain verifier. Phase 1 contracts shipped without it. |
| 13 | **NEW**: Provider count = 1 per model in catalog | New | Low — Sybil resistance for attestation depends on 0G's allowlist of signing keys, not provider diversity. Honest framing in §4.2 + §14. |
| 14 | **NEW (v0.4)**: rotate-during-dispute-window slashes retroactively | New | **DOCUMENTED** in §5.5 — `arbitrate()` compares to *current* `signingAddress`, so a seller who rotates while a job is in the dispute window will be slashed even on an honest rotation. Mitigation in v0.1: explicit operator instruction ("don't rotate during the 24h post-Settled window"). Risk for the demo: low — the demo seller doesn't rotate during the 14-day demo window. Phase 2 fix: per-service `signingAddress[]` history so the arbiter can match against the key that was current at attestation time, distinguishing rotation from revocation. |
| 15 | **NEW (Phase 1 EXIT.1)**: MIN_BOND set for demo economics, not production sybil resistance | New | **DOCUMENTED** in §5.5 — v0.1 sets `MIN_BOND = 5 $0G` (was 100 $0G in v0.3). The 100 $0G value was over-spec'd for hackathon mainnet, where the only seller is the demo seller; sybil resistance against a populated provider set didn't apply. Phase 2 fix: calibrate MIN_BOND from real attestation cost data once 0G has multiple providers and we know the actual cost-of-attack curve. Risk for v0.1: a malicious actor could stake 5 $0G, settle a fraudulent job worth ≤ ~3.5 $0G after the 5% protocol fee, and break even minus gas — not a meaningful threat at hackathon scale. |

### 19.4 Pivot fallback

Track 5 retained — only triggered if a Phase 1 finding fundamentally breaks the dispute model (unlikely; verifier is fully verified). Same architecture, different framing: *"Sealed Intent Trade Markets — MEV-resistant DEX where intents are TEE-encrypted and solvers compete inside sealed enclaves."* ~2 day cost. Not expected.

---

## 20. Context budget per Claude Code phase

| Phase | Est. tokens | Sessions |
|---|---|---|
| Phase 0 | 30k | DONE (1 session) |
| Phase 1 (contracts) | 200k | 4–6 |
| Phase 1.5 (SDK source spike + TeeML probe) | 30k | 1 |
| Phase 2 (Buyer SDK) | 80k | 2–3 |
| Phase 3 (Indexer + API) | 80k | 2–3 |
| Phase 4 (Seller agent) | 60k | 2 |
| Phase 5 (Frontend) | 250k | 6–8 |
| Phase 6 (Submission) | 40k | 1–2 |

Total ~770k across 18–26 Claude Code sessions. Within Claude Max budget over 14 days.

---

## 21. Day 0 validation gates — RESULTS

| Gate | Spec | Result | Key fact |
|---|---|---|---|
| G1 | Acquire ≥10 $0G mainnet | PASS (6.46 acquired, sufficient) | KuCoin → mainnet wallet |
| G2 | Deploy hello-world via Foundry | PASS | Verified on chainscan |
| G3 | Router /chat/completions live | PASS (after `max_tokens` fix) | 7-model catalog, all `tee_attested: true` (TDX + dstack), `verifiability` ∈ {TeeTLS, TeeML} |
| G4 | Router signature inspection | PASS | Confirmed: no per-call signature on Router → Direct path required |
| G5 | Direct broker inference + signature | PASS | `{text, signature, signing_address: 0x4c1b546f..., signing_algo: ecdsa}`. EIP-191 recovery validates against captured payload. **Phase 1 verifier is unblocked.** |
| G6 | Storage roundtrip | PASS | rootHash `0x31f1dbc6...` matches bytes-for-bytes, 1KB roundtrip 20s |
| G7 | INFT reference compile | PASS | `0g-agent-nft@b86e108a` compiles clean under 0.8.24+cancun via Hardhat→Foundry remap |
| Sigverify | Hash scheme empirical test | PASS | EIP-191 personal_sign confirmed, recovery returns expected `signing_address` |
| G5-inspect | Read-only `listService()` dump for G5 provider | PASS | `signingAddress` confirmed at index 9 for the TargetSeparated:true (TeeTLS-semantic) provider; `verifiability` label is unreliable; `additionalInfo.TargetSeparated` is canonical. Registration can be seeded from one `listService()` read. |

---

## Document control

This PRD is **canonical and locked at v0.4**. Amendments only via signed markdown PRs to `/docs/MASTER_PRD.md` with version bump and changelog entry. Drift between PRD and implementation = stop coding, decide which to update.

Frontend PRD is the next deliverable, separate document at `/docs/FRONTEND_PRD.md`.

— Locked at v0.3 by Tim (winsznx) on Phase 0 EXIT signoff. Bumped to v0.4 on Phase 1 contracts EXIT (2026-05-07, 5/5 contracts, 55/55 tests). Step 2F (deploy script) commences.