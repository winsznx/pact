#!/usr/bin/env bash
# Orchestrates the full Phase 4 end-to-end test:
#   1. Spawn the watcher in background, log to /tmp/pact-watcher.log
#   2. Wait until "watcher.start" appears in the log
#   3. Run the buyer test-e2e against the same chain
#   4. Dump watcher log tail so the inference + attestation flow is visible
#   5. Verify final on-chain state via cast (CLAUDE.md broadcast rule:
#      verify post-tx state via on-chain reads, never trust receipt parsers alone)
#   6. Print full result summary
#
# Exit code 0 = e2e PASS, non-zero = FAIL.

set -u

# Resolve to repo root so the script works no matter where it's invoked from.
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../../.." && pwd)"
WATCHER_LOG="/tmp/pact-watcher.log"
ESCROW_ADDR="0xB2b762Df53294923d3eaD00d8118AD37388dD4aA"
RPC_URL="https://evmrpc.0g.ai"

cd "$REPO_ROOT"

# Clean prior log.
: > "$WATCHER_LOG"

echo "[e2e] starting watcher → $WATCHER_LOG"
pnpm --filter @pact/seller-reference run run >>"$WATCHER_LOG" 2>&1 &
WATCHER_PID=$!
trap 'kill $WATCHER_PID 2>/dev/null; wait 2>/dev/null' EXIT INT TERM

# Wait for boot — up to 30s. The "watcher.start" line is what we wait on.
echo "[e2e] waiting for watcher.start…"
for i in $(seq 1 30); do
  if grep -q '"event":"watcher.start"' "$WATCHER_LOG" 2>/dev/null; then
    break
  fi
  sleep 1
done
if ! grep -q '"event":"watcher.start"' "$WATCHER_LOG"; then
  echo "[e2e] FAIL: watcher did not start within 30s"
  tail -40 "$WATCHER_LOG"
  exit 1
fi
echo "[e2e] watcher up. running buyer test…"

# Run the buyer-side e2e. tee for visibility + capture for reporting.
BUYER_LOG="/tmp/pact-buyer-e2e.log"
: > "$BUYER_LOG"
pnpm --filter @pact/seller-reference test-e2e 2>&1 | tee "$BUYER_LOG"
BUYER_EXIT=${PIPESTATUS[0]}

echo ""
echo "[e2e] --- watcher log tail (last 60 lines) ---"
tail -60 "$WATCHER_LOG"
echo "[e2e] --- end watcher tail ---"

if [ "$BUYER_EXIT" -ne 0 ]; then
  echo "[e2e] FAIL: buyer test exited $BUYER_EXIT"
  exit "$BUYER_EXIT"
fi

# Extract jobId + tx hash from buyer log.
JOB_ID="$(grep -oE '"jobId":"[0-9]+"' "$BUYER_LOG" | tail -1 | sed -E 's/.*"jobId":"([0-9]+)".*/\1/')"
CREATE_TX="$(grep -oE '"createJobTx":"0x[a-fA-F0-9]+"' "$BUYER_LOG" | head -1 | sed -E 's/.*"createJobTx":"(0x[a-fA-F0-9]+)".*/\1/')"

if [ -z "$JOB_ID" ]; then
  echo "[e2e] FAIL: could not extract jobId from buyer log"
  exit 1
fi

echo ""
echo "[e2e] on-chain verification via cast"
echo "[e2e] cast call $ESCROW_ADDR \"getJob(uint256)((...))\" $JOB_ID"
JOB_OUTPUT="$(cast call "$ESCROW_ADDR" "getJob(uint256)((uint256,address,address,uint128,uint128,uint64,uint64,uint8,bytes32,bytes32,bytes32,bytes,bytes))" "$JOB_ID" --rpc-url "$RPC_URL" 2>&1)"
echo "$JOB_OUTPUT"

# Parse the state field — 8th element in the tuple (0-indexed: 7). cast prints
# the tuple as a single parenthesised line; pull the 8th comma-separated.
STATE="$(echo "$JOB_OUTPUT" | tr -d '()' | awk -F', ' '{print $8}')"
if [ "$STATE" != "3" ]; then
  echo "[e2e] FAIL: on-chain state is $STATE, expected 3 (Settled)"
  exit 1
fi

# Extract submitAttestation tx hash from watcher log.
SUBMIT_TX="$(grep -oE '"event":"attestation.tx.sent"[^}]*"txHash":"0x[a-fA-F0-9]+"' "$WATCHER_LOG" | tail -1 | sed -E 's/.*"txHash":"(0x[a-fA-F0-9]+)".*/\1/')"

echo ""
echo "==============================================================="
echo "[e2e] PASS — Phase 4 end-to-end on 0G mainnet"
echo "  jobId:            $JOB_ID"
echo "  createJob tx:     $CREATE_TX"
echo "  submitAttest tx:  $SUBMIT_TX"
echo "  final state:      $STATE (Settled)"
echo "  explorer (create):  https://chainscan.0g.ai/tx/$CREATE_TX"
echo "  explorer (settle):  https://chainscan.0g.ai/tx/$SUBMIT_TX"
echo "==============================================================="
exit 0
