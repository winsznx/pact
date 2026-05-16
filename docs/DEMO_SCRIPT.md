# PACT — 3-minute demo screencast script

Recording target: **3:00 ± :10**. Resolution 1920×1080, 60fps.
VO either live or ElevenLabs studio. Music: ambient bed, low.

Pre-flight checklist:
- [ ] Burner wallet `0xbF7EF900E2dB365455B91Fb133f78Fc70114Bf31` funded (≥6 $0G — verified via `cast balance --rpc-url $RPC_URL`)
- [ ] Seller agent running: `pnpm --filter @pact/seller-reference run run` (terminal pane visible)
- [ ] Frontend reachable at `https://trypact.xyz` (production) — fall back to `pnpm --filter @pact/web dev` + `localhost:3001` only if Vercel is down on recording day
- [ ] Wallet (MetaMask or Rabby) configured with 0G mainnet, signed in, locked
- [ ] `/jobs/N` polling confirmed working (open any past jobId)
- [ ] Browser zoom 110% so all text is legible at 1080p
- [ ] OBS scene: Browser (main) + Terminal (PiP bottom-right for the watcher log)

---

## Beat 0 — Cold open (0:00–0:15)

**On screen**: Landing page hero at `https://trypact.xyz`. The upright display headline fills the viewport.

**Narration (12s)**:
> "AI agents are about to become the largest economic actors in Web3. Today, no one can prove what model they actually ran. PACT solves that."

**Action**: Hold on the hero for ~3 seconds after the narration ends. Then click **Marketplace** in the nav.

---

## Beat 1 — Marketplace browse (0:15–0:45)

**On screen**: `https://trypact.xyz/marketplace` — Verifiable AI services header, filter row, Service 1 card + "Become a seller" tile.

**Narration (28s)**:
> "Every service registered in PACT is a row in PactRegistry on 0G mainnet. Every reputation point comes from a TEE-attested job. This is Service 1 — a Solidity audit agent backed by 0G Compute, model zai-org/GLM-5-FP8. One $0G of one-thousandth per call. Let's hire it."

**Action**:
- 0:15 → page load, cursor hovers Service 1 card (subtle scale-up)
- 0:25 → click Service 1 → navigate to `/marketplace/1`
- 0:32 → scroll past the on-chain identity card (signing address, INFT tokenId, registered date)
- 0:40 → cursor lands on chartreuse **Run an inference →** button
- 0:45 → click it

---

## Beat 2 — Buyer flow + state machine (0:45–1:45)

**On screen**: `/jobs/new?serviceId=1` form.

**Narration (60s)**:
> "Connect a wallet. Paste a prompt. Submit. The transaction signs `createJob` on PactEscrow — one-thousandth of a $0G locked in escrow, the commitment hash of our prompt anchored on-chain. Wait twelve seconds for confirmation. We land on the job page with the state machine live — Pending. In the background, the seller agent's polling loop sees the new job, calls into 0G Compute, gets back the inference, and fetches the TEE-attested signature. Forty-five seconds end to end on 0G mainnet."

**Action**:
- 0:45 → cursor pastes prompt: "Audit this Solidity contract for reentrancy vulnerabilities"
- 0:52 → commitment hash appears below textarea (chartreuse-prefixed)
- 0:55 → click **Submit job · 0.001 $0G** — MetaMask popup, sign
- 1:05 → tx hash appears with chainscan link; click the link briefly in a new tab to show it confirmed
- 1:10 → return; redirected to `/jobs/3` (or whatever new jobId)
- 1:15 → cursor circles the chartreuse **Pending** node in the JobStateMachine
- 1:25 → cut to terminal pane briefly — the watcher log shows `watcher.newJob` → `inference.request` → `inference.response` → `attestation.localVerifyOk` → `attestation.tx.sent`
- 1:35 → back to browser; the state has flipped to **Settled** (chartreuse), three nodes filled in
- 1:42 → emphasis hold on `Settled` for 2 seconds

---

## Beat 3 — The MOAT moment (1:45–2:30)

**On screen**: Scroll down to the TeeMoment section on `/jobs/3`. ECDSARecoveryViz visible.

**Narration (40s)**:
> "Now the moat. The TEE signed a five-field canonical text — content hash, usage hash, provider type, provider identity, TLS cert fingerprint. We wrap it in EIP-191. Hash with keccak256. Recover the signing address from the signature using ECDSA secp256k1. In your browser. Right now. The address we recover matches the address PactRegistry returns for Service 1's registered signer. Exact match. The contract just ran the same primitive on-chain in our AttestationVerifier. The fraud surface area is the signing key itself — nothing else."

**Action**:
- 1:45 → click **Verify attestation →** chartreuse button on the recovery viz
- 1:48 → animation step 1: each field of the canonical text pulses chartreuse (~1s)
- 1:52 → step 2: EIP-191 prefix wraps the text
- 1:56 → step 3: keccak256 hash appears
- 2:00 → step 4: "ECDSA secp256k1 recover" line in
- 2:05 → step 5: recovered address fades in: `0x4C1b546f…7ee8`
- 2:10 → step 6: comparison row shows `0x4C1b546f…7ee8 == 0x4C1b546f…7ee8` + chartreuse **✓ MATCH** badge
- 2:18 → hold on the MATCH badge for 5 seconds
- 2:25 → scroll up briefly to the chainscan link in the provenance row

---

## Beat 4 — Reputation is the INFT (2:30–2:50)

**On screen**: Navigate back to `/marketplace/1`. Scroll to ReputationINFT card / on-chain identity card.

**Narration (18s)**:
> "Plus one settled job. The weighted score increments. But the reputation isn't a star rating. It's anchored to the seller's ERC-7857 INFT — a transferable token. Sell the agent, sell the reputation. The agent IS its reputation, not the wallet holding it."

**Action**:
- 2:30 → navigate to `/marketplace/1`
- 2:35 → scroll to the "On-chain identity" card — INFT tokenId line glows briefly
- 2:42 → cursor hovers the chainscan link for AgentNFT proxy
- 2:48 → cut

---

## Beat 5 — Close (2:50–3:00)

**On screen**: Landing page final section. Fade to a single line of Instrument Serif italic centered:
> *"PACT. Trust the math. Pay the agent."*

**Narration (8s)**:
> "PACT. Trust the math. Pay the agent. Live on 0G mainnet. Forty-three lines of TypeScript on the buyer side. Github dot com slash winsznx slash pact."

**Action**:
- 2:50 → close shot: chainscan link briefly visible top-right corner
- 2:54 → mono bottom line: `trypact.xyz · github.com/winsznx/pact · 0G APAC Hackathon · Track 3`
- 3:00 → fade out

---

## Production notes

- OBS scene-switch between the browser cut and the watcher-terminal cut at 1:25 should be a 200ms fade, not a hard cut.
- The ECDSA recovery animation runs ~2.5s. If video editing wants it slower for emphasis, use `/verify/3?autoplay=1` and screen-record the standalone viz at half-speed playback — the visual story holds.
- Highlight the **MATCH** badge by lifting the music briefly at 2:18.
- If the actual e2e takes longer than 45s on demo day (network congestion on 0G), pre-record the buyer transaction and cut to a follow-up shot of the settled state. The state machine flip is the visual payoff — its timing doesn't have to be live.
