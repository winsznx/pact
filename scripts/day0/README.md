# PACT — Day 0 validation probes

Validation scripts for **MASTER_PRD §21** gates **G3..G7**. Each probe is a
single-purpose script that emits a one-line `PASS / FAIL / INCONCLUSIVE` to
stdout and a structured JSON dump to `output/<gate>.json`. Paste the JSON
back into chat after each run; that's the artifact subsequent Phase 1
decisions key off.

> **Out of scope here:** G1 (acquire $0G), G2 (deploy hello-world), G8
> (write the path decision doc). Those are manual / human-driven gates.

---

## ⚠️ PRD drift flagged during scaffold

The Day 0 librarian probe surfaced two npm package renames that the PRD
hasn't been amended for. The probes below use the **correct, currently
published** packages; please review and patch `MASTER_PRD.md` §6, §7.2, §11
before Phase 1 starts.

| MASTER_PRD says            | Reality (verified against upstream source)                    |
| -------------------------- | ------------------------------------------------------------- |
| `@0glabs/0g-serving-broker` | `@0gfoundation/0g-compute-ts-sdk` (v0.8.0)                    |
| `@0glabs/0g-ts-sdk`        | `@0gfoundation/0g-storage-ts-sdk` (v1.2.8)                    |

Plus two unverified items the PRD asserts but the SDK source does not back:

- **`https://router-api.0g.ai/v1`** as a live, publicly hosted Router. G3
  preflights `/models` so a misconfigured base URL fails fast.
- **`glm-5-fp8`** as the default model identifier — not present in any
  examined source. Override `PACT_ROUTER_MODEL` once the real catalog is
  known (G3 preflight reports the available list).

Drift entry recorded in `docs/AGENT_PROGRESS.md`.

---

## Prerequisites

| Tool          | Version                            | Why                                |
| ------------- | ---------------------------------- | ---------------------------------- |
| Node.js       | ≥ 20.18.0                          | Pinned in PACT stack (CLAUDE.md)   |
| pnpm          | ≥ 9.12.3                           | Workspace package manager          |
| Foundry       | latest stable                      | G7 uses `forge build`              |
| Python 3      | system                             | G7 uses `python3` for JSON quoting |
| `git`         | any                                | G7 clones `0g-agent-nft`           |

You also need (manual gates G1/G2):

- A 0G mainnet wallet **funded with ≥ 10 $0G** (G5, G6 will spend a few
  cents).
- An API key from the 0G Compute portal (PRD §21 references **`pc.0g.ai`**
  — verify URL with the 0G team) for G3/G4.

---

## Setup

```bash
cd scripts/day0
cp .env.example .env
# fill in PACT_PRIVATE_KEY (burner!), PACT_ROUTER_API_KEY, optionally PACT_ROUTER_MODEL
pnpm install
```

`.env` is in the repo `.gitignore`. The wallet you put here will sign on
0G mainnet — use a fresh burner with only enough $0G for the probes.

---

## Run order

The PRD checks are sequential and independent. Run in numeric order;
recommended cadence is **one gate, paste the JSON back, then proceed**.
Stop on a `FAIL` and consult before re-running.

```bash
pnpm g3   # Router inference
pnpm g4   # Router response — inspect for TEE signature material
pnpm g5   # Direct broker inference (the verifiable path)
pnpm g6   # 0G Storage upload + retrieve roundtrip
pnpm g7   # 0g-agent-nft compile under 0.8.24 + cancun
```

Or all at once (continues through individual failures, marks the run failed
overall): `pnpm all`.

Outputs land in `scripts/day0/output/<gate>.json`. `.cache/` holds the
cloned `0g-agent-nft` repo for G7; safe to delete to force a re-clone.

---

## What each gate proves (and what failure means)

### G3 — `g3-router-inference.ts`

Hits `${PACT_ROUTER_BASE_URL}/models` as preflight, then makes one chat
completion call via the OpenAI SDK pointed at the Router.

- **PASS:** the public Router is live for our key, returns a valid OpenAI-
  shaped completion. Phase 1 can rely on the Router path for buyer-side
  fanout.
- **FAIL on preflight:** Router base URL or API key wrong, or the public
  endpoint isn't actually hosted at `router-api.0g.ai`. Ask 0G for the
  correct URL or pivot to **Direct only** (path C of PRD §8.3).
- **FAIL on completion:** keys work but the model id is wrong; consult the
  preflight body in the JSON to pick a real model id and re-run.

### G4 — `g4-router-signature-inspect.ts`

Same call as G3, but raw `fetch` so we can see headers. Walks the body and
headers for any field whose name contains `signature`, `attestation`,
`tee`, `model_hash`, etc.

- **PASS + `signaturePresent: true`:** Router exposes a verifiable per-
  request signature. Path A of PRD §8.3 may be viable; capture exact field
  names and we register provider keys directly on `AttestationVerifier`.
- **PASS + `signaturePresent: false`:** Router responses are vanilla
  OpenAI shape (expected per librarian source review). Direct path
  (G5) is the canonical TEE-attested route. PRD §8.3 path B or C; G5
  proves which.

### G5 — `g5-direct-broker.ts`

Constructs `createZGComputeNetworkBroker(wallet)`, ensures the on-chain
ledger account exists (creates one with 0.05 $0G if missing), discovers
services, picks the first (or `PACT_BROKER_PROVIDER_ADDRESS` override),
acknowledges the provider signer, fetches metadata + auth headers, sends
a chat completion against `${endpoint}/v1/proxy/chat/completions`, then
calls `broker.inference.processResponse(...)` which fetches the TEE
signature from `${endpoint}/v1/proxy/signature/{chatId}` and verifies it
client-side.

- **PASS:** end-to-end Direct path with verified TEE signature. **This is
  the cryptographic spine of PACT.** Phase 1 attestation verifier targets
  this signature shape. Capture the provider address, model, and
  signature payload from the JSON for the on-chain registry bootstrap.
- **FAIL at `listService`:** no providers advertising on mainnet right
  now. Wait or ask 0G; pivot to Track 5 fallback (PRD §19.4) only after
  multiple retries.
- **FAIL at `processResponse`:** signature exists but verification fails.
  Critical — surface immediately.

### G6 — `g6-storage-roundtrip.ts`

Uploads a 1KB `MemData` blob via the storage indexer, asserts the upload
returned root matches the locally-computed merkle root, downloads to a
temp file with proof, byte-compares.

- **PASS:** Storage primitive is wired. Phase 1 output-blob plumbing can
  proceed.
- **FAIL on upload:** indexer URL wrong, RPC down, or wallet underfunded
  for the storage tx. Check `balanceWei` in the JSON.
- **FAIL on bytes mismatch:** SDK or indexer corruption — file an
  upstream issue before continuing.

### G7 — `g7-inft-compile.sh`

Clones (or updates) `https://github.com/0gfoundation/0g-agent-nft`,
detects whether the repo ships a Foundry or Hardhat layout, and runs
`forge build --use 0.8.24 --evm-version cancun` — either in-place
or into a synthesized scratch Foundry project that wraps the upstream
contracts.

- **PASS:** the ERC-7857 reference compiles under the PACT-pinned
  toolchain unmodified. PRD §13 Phase 0 last task is satisfied.
- **FAIL with hardhat-only layout:** scratch project copy succeeded but
  upstream uses solc features outside 0.8.24 — read
  `output/g7-inft-compile.build.log` and decide whether to pin a
  different solc, fork-and-patch, or accept the divergence in the PRD.
- **FAIL on missing `forge`:** install
  [Foundry](https://book.getfoundry.sh/getting-started/installation).

---

## Re-running and idempotency

- **G3, G4, G5:** every run consumes API quota / a few wei of gas. Avoid
  running in tight loops.
- **G5:** the first run of `addLedger` is on-chain; subsequent runs short-
  circuit via `getLedger`. `acknowledgeProviderSigner` is idempotent at
  the contract level (logged but doesn't fail the gate).
- **G6:** every run uploads new random bytes (different rootHash) and
  costs a tiny on-chain fee for the storage commitment.
- **G7:** clones once into `.cache/0g-agent-nft`, then `git fetch` +
  `git reset --hard origin/HEAD` on subsequent runs. Delete `.cache/` to
  force a fresh clone.

---

## Output JSON shape

Every gate writes `output/<gate>.json` in this shape:

```json
{
  "gate": "g3-router-inference",
  "status": "PASS" | "FAIL" | "INCONCLUSIVE",
  "summary": "one-line human summary",
  "startedAt": "2026-05-02T...Z",
  "finishedAt": "2026-05-02T...Z",
  "durationMs": 1234,
  "data": { /* gate-specific full payload */ },
  "error": { "name": "...", "message": "...", "stack": "..." }   // FAIL only
}
```

`bigint` values are stringified; `Uint8Array` becomes `0x…` hex. Safe to
paste back as-is.
