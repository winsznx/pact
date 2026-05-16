# PACT — 5-minute demo screencast script

Recording target: **5:00 ± :15**. Resolution 1920×1080, 60fps.
VO either live or ElevenLabs studio. Music: ambient bed, low.

The 5-min version (vs the older 3-min) adds three beats for the post-MOAT
tooling we shipped: the **hosted MCP server** (the agentic-economy
moneyshot), the **indexer REST API**, and the **buyer SDK**. The narrative
arc is now: *protocol works → moat is real → agents can call it → devs
can build on it*.

---

## Pre-flight checklist

- [ ] Burner wallet `0xbF7EF900E2dB365455B91Fb133f78Fc70114Bf31` funded (≥6 $0G — `cast balance --rpc-url $RPC_URL`)
- [ ] Seller agent running: `pnpm --filter @pact/seller-reference run run` (terminal pane visible)
- [ ] Frontend reachable at `https://trypact.xyz` (production). Fallback `pnpm --filter @pact/web dev` → `localhost:3001`
- [ ] Wallet (MetaMask or Rabby) configured with 0G mainnet, signed in, locked
- [ ] `/jobs/N` polling confirmed working (open any past jobId)
- [ ] Browser zoom 110% so all text is legible at 1080p
- [ ] **For Beat 5 (MCP)**: Claude Desktop running with `~/Library/Application Support/Claude/claude_desktop_config.json` containing exactly:
      ```jsonc
      { "mcpServers": { "trypact": { "url": "https://mcp.trypact.xyz/mcp" } } }
      ```
      Claude restarted after the config save. Verify `trypact` namespace appears in the MCP tools panel BEFORE recording.
- [ ] **For Beat 6 (API)**: `https://api.trypact.xyz/v1/jobs` opens in a clean browser tab with JSON pretty-printer (e.g. Chrome's default formatting)
- [ ] OBS scenes prepped:
      - `BROWSER` (full screen, main)
      - `BROWSER+TERMINAL` (PiP terminal bottom-right for the watcher log)
      - `CLAUDE` (full-screen Claude Desktop window)
      - `EDITOR` (full-screen VS Code with `examples/buyer-quickstart.ts` open)

---

## Beat 0 — Cold open (0:00–0:15)

**Scene**: `BROWSER`. Landing page hero at `https://trypact.xyz`. Upright display headline fills the viewport.

**Narration (12s)**:
> "AI agents are about to become the largest economic actors in Web3. Today, no one can prove what model they actually ran. PACT solves that."

**Action**: Hold on the hero ~3s after the narration ends. Click **Marketplace** in the nav.

---

## Beat 1 — Marketplace browse (0:15–0:45)

**Scene**: `BROWSER`. `https://trypact.xyz/marketplace` — Verifiable AI services header, filter row, Service 1 card + "Become a seller" tile.

**Narration (28s)**:
> "Every service registered in PACT is a row in PactRegistry on 0G mainnet. Every reputation point comes from a TEE-attested job. This is Service 1 — a Solidity audit agent backed by 0G Compute, model zai-org/GLM-5-FP8. One-thousandth of a $0G per call. Let's hire it."

**Action**:
- 0:15 → page load, cursor hovers Service 1 card (subtle scale-up)
- 0:25 → click Service 1 → navigate to `/marketplace/1`
- 0:32 → scroll past the on-chain identity card (signing address, INFT tokenId, registered date)
- 0:40 → cursor lands on chartreuse **Run an inference →** button
- 0:45 → click it

---

## Beat 2 — Buyer flow + state machine (0:45–1:45)

**Scene**: `BROWSER+TERMINAL`. `/jobs/new?serviceId=1` form on browser; seller watcher log visible in terminal PiP.

**Narration (60s)**:
> "Connect a wallet. Paste a prompt. Submit. The transaction signs `createJob` on PactEscrow — one-thousandth of a $0G locked in escrow, the commitment hash of our prompt anchored on-chain. Wait twelve seconds for confirmation. We land on the job page with the state machine live — Pending. In the background, the seller agent's polling loop sees the new job, calls into 0G Compute, gets back the inference, and fetches the TEE-attested signature. Forty-five seconds end to end on 0G mainnet."

**Action**:
- 0:45 → cursor pastes prompt: "Audit this Solidity contract for reentrancy vulnerabilities"
- 0:52 → commitment hash appears below textarea (chartreuse-prefixed)
- 0:55 → click **Submit job · 0.001 $0G** — MetaMask popup, sign
- 1:05 → tx hash appears with chainscan link; click it briefly in a new tab to show confirmed
- 1:10 → return; redirected to `/jobs/3` (or whatever new jobId)
- 1:15 → cursor circles the chartreuse **Pending** node in the JobStateMachine
- 1:25 → cut to terminal pane briefly — watcher log shows `watcher.newJob` → `inference.request` → `inference.response` → `attestation.localVerifyOk` → `attestation.tx.sent`
- 1:35 → back to browser; state flips to **Settled** (chartreuse), three nodes filled in
- 1:42 → emphasis hold on `Settled` for 2 seconds

---

## Beat 3 — The MOAT moment (1:45–2:30)

**Scene**: `BROWSER`. Scroll down to the TeeMoment section on `/jobs/3`. ECDSARecoveryViz visible. Alternatively, navigate to `/verify/3?autoplay=1` for a clean standalone visual.

**Narration (40s)**:
> "Now the moat. The TEE signed a five-field canonical text — content hash, usage hash, provider type, provider identity, TLS cert fingerprint. We wrap it in EIP-191. Hash with keccak256. Recover the signing address from the signature using ECDSA secp256k1. In your browser. Right now. The address we recover matches the address PactRegistry returns for Service 1's registered signer. Exact match. The contract just ran the same primitive on-chain in our AttestationVerifier. The fraud surface area is the signing key itself — nothing else."

**Action**:
- 1:45 → click **Verify attestation →** chartreuse button on the recovery viz
- 1:48 → step 1: each field of the canonical text pulses chartreuse (~1s)
- 1:52 → step 2: EIP-191 prefix wraps the text
- 1:56 → step 3: keccak256 hash appears
- 2:00 → step 4: "ECDSA secp256k1 recover" line in
- 2:05 → step 5: recovered address fades in: `0x4C1b546f…7ee8`
- 2:10 → step 6: comparison row shows `0x4C1b546f…7ee8 == 0x4C1b546f…7ee8` + chartreuse **✓ MATCH** badge
- 2:18 → hold on MATCH for 5s
- 2:25 → scroll up briefly to the chainscan link in the provenance row

---

## Beat 4 — Reputation is the INFT (2:30–2:50)

**Scene**: `BROWSER`. Navigate back to `/marketplace/1`. Scroll to ReputationINFT card / on-chain identity card.

**Narration (18s)**:
> "Plus one settled job. The weighted score increments. But the reputation isn't a star rating. It's anchored to the seller's ERC-7857 INFT — a transferable token. Sell the agent, sell the reputation. The agent IS its reputation, not the wallet holding it."

**Action**:
- 2:30 → navigate to `/marketplace/1`
- 2:35 → scroll to "On-chain identity" card — INFT tokenId line glows briefly
- 2:42 → cursor hovers the chainscan link for AgentNFT proxy
- 2:48 → cut

---

## Beat 5 — Agents can call PACT (MCP) (2:50–3:50) **NEW**

**Scene**: `CLAUDE`. Claude Desktop full-screen. The MCP tools panel (small icon) visible so the `trypact` namespace is provably loaded — no terminal sleight-of-hand.

**Narration (58s)**:
> "Same primitive, but now your AI agent calls it directly. One line of MCP config — a single URL, no install — and Claude or Cursor or any MCP-compatible agent gets four tools: list services, get service, get job, verify attestation. All hitting 0G mainnet through the same SDK the website uses. Watch."

**Action**:
- 2:50 → in Claude Desktop, type into chat: **"List every PACT service on 0G mainnet and verify the latest settled job."**
- 2:55 → Claude's tool-use panel expands: `trypact.list_services` is called
- 3:00 → tool result renders inline: Service 1 (zai-org/GLM-5-FP8), 0.001 $0G/call, signing address `0x4C1b…7ee8`
- 3:10 → Claude announces it will verify the latest job
- 3:12 → tool-use panel: `trypact.verify_attestation` with `jobId: "3"`
- 3:18 → tool result: `{ "ok": true, "recoveredSigner": "0x4C1b…7ee8", "expectedSigner": "0x4C1b…7ee8", "note": "Signature recovered to the same address PactRegistry.getService returns. Attestation is authentic." }`
- 3:25 → Claude summarises in plain English: "Yes — job 3 is authentic. The TEE-bound signing key recovered from the signature matches the one PactRegistry registered for Service 1."
- 3:30 → cursor highlights the MCP tools panel so viewers see the four tools listed under `trypact`
- 3:38 → narration overlay (no VO needed, just on-screen text): `~/.claude/mcp.json → { "url": "https://mcp.trypact.xyz/mcp" }` — held for 8s so a viewer can pause and copy
- 3:46 → fade

**Narration coda (4s, after the on-screen config)**:
> "That's the agentic economy primitive — agents transacting with cryptographic proof, no human in the loop."

---

## Beat 6 — Devs can build on it (Indexer + SDK) (3:50–4:30) **NEW**

**Scene split**: Two micro-scenes inside one beat.

### 6a — Indexer REST API (3:50–4:10)

**Scene**: `BROWSER`. Open `https://api.trypact.xyz/v1/jobs` in a clean tab. Browser pretty-prints the JSON.

**Narration (18s)**:
> "Every settled job, every service, every seller — exposed as a public REST cache at api.trypact.xyz. No auth, no SDK required. The contract is the source of truth; the indexer is just the read layer."

**Action**:
- 3:50 → URL bar transition: type `api.trypact.xyz/v1/jobs` and Enter
- 3:55 → JSON renders — first job entry visible at top with `jobId: 3`, `state: 3`, `attestationSignature: "0x99..."`
- 4:02 → cursor hovers `state: 3` value, brief tooltip from on-screen text overlay: `Settled`
- 4:08 → cut

### 6b — Buyer SDK quickstart (4:10–4:30)

**Scene**: `EDITOR`. VS Code full-screen with a fresh file `examples/buyer-quickstart.ts` open. Code is the 25-line snippet from the README's *Integrate in 25 lines* section. Cursor at top.

**Narration (18s)**:
> "Or skip the indexer and use the buyer SDK directly. Twenty-five lines of TypeScript. Escrow funds, watch settlement, verify the TEE attestation, return the output. `pnpm add @trypact/sdk viem`. Published on npm tonight."

**Action**:
- 4:10 → editor focus on line 1; cursor scrolls slowly through `import` block, then to the `pact.run({...})` call
- 4:18 → cursor highlights the `result.verified.ok` line
- 4:22 → terminal at bottom of editor briefly shows: `$ pnpm add @trypact/sdk viem` (no need to actually run — pre-typed)
- 4:28 → cut

---

## Beat 7 — Close (4:30–5:00) **NEW (extended from 3-min close)**

**Scene**: `BROWSER`. Landing page final section. Slow fade to a single line of Instrument Serif italic centered:
> *"PACT. Trust the math. Pay the agent."*

**Narration (25s)**:
> "PACT. Trust the math. Pay the agent. Seven mainnet contracts on 0G, fifty-six of fifty-six Foundry tests passing, a published SDK, a hosted MCP server, a public indexer. Real product, live today on chainId 16661. Github dot com slash winsznx slash pact. Trypact dot xyz."

**Action**:
- 4:30 → close shot: chainscan link briefly visible top-right corner
- 4:38 → mono bottom line fades in:
       `trypact.xyz · mcp.trypact.xyz · api.trypact.xyz · github.com/winsznx/pact · 0G APAC Hackathon · Track 3`
- 4:50 → hold the mono line for 7s — long enough to read
- 4:58 → fade out
- 5:00 → black

---

## Production notes

- OBS scene-switch between the browser cut and the watcher-terminal cut at 1:25 should be a 200ms fade, not a hard cut.
- Beat 5 (Claude) is the most fragile shot. **Rehearse the prompt 3x before recording.** If Claude hallucinates a tool call or freezes, restart Claude Desktop and try again — the recording is cheap, the trust loss from a glitchy MCP demo is expensive.
- For Beat 5 specifically, if Claude's UI changes between rehearsal and recording (Anthropic ships updates frequently), the visual will still work — what judges need to see is: the prompt → the tool name `trypact.list_services` → the JSON result inline. Frame around that.
- The ECDSA recovery animation runs ~2.5s. If video editing wants it slower for emphasis, use `/verify/3?autoplay=1` and screen-record the standalone viz at half-speed playback — the visual story holds.
- Lift the music bed briefly at three moments: 2:18 (MATCH badge), 3:18 (Claude's `ok: true` tool result), and 4:38 (the final mono URL line).
- If the actual e2e in Beat 2 takes longer than 45s on demo day (network congestion on 0G), pre-record the buyer transaction and cut to a follow-up shot of the settled state. The state-machine flip is the visual payoff — its timing doesn't have to be live.
- The MCP tool result in Beat 5 should NOT be pre-recorded. The whole point is "real agent, real call, real on-chain answer." If it fails live, fall back to a screenshot but show the `mcp.trypact.xyz/healthz` response in a side tab so viewers can verify the endpoint is live and the failure was incidental.

---

## Two ways to deliver

| Mode | When |
|---|---|
| Live VO, recorded once end-to-end | If you can keep the takes tight and want the authentic feel |
| Screen-record silent → ElevenLabs VO + edit | If you want production polish or need to retake one beat without redoing the whole video |

ElevenLabs voice profile: `Sam` (calm-confident, neutral US). Stem export per beat for easier editing.
