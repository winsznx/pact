"use client";

import { useEffect, useState } from "react";

import { Card } from "@/components/ui/Card";
import { AttestationReceipt } from "@/components/landing/AttestationReceipt";
import { JobState, type JobStateValue } from "@/lib/wagmi";

/**
 * Right column of /jobs/[jobId] — state-specific panel.
 *   - Pending      → "Waiting for seller…" + elapsed timer + reclaim CTA
 *                    (disabled until timeout passes)
 *   - Sealed       → same as Attested (the route doesn't visually
 *                    distinguish the intermediate Sealed state in v0.1)
 *   - Attested /
 *     Settled      → AttestationReceipt + "verified on-chain" badge
 *                    (Settled also shows the seller's plaintext output
 *                    underneath, pulled from localStorage)
 *   - Expired /
 *     Disputed /
 *     Slashed      → state-specific message
 *
 * v0.2 reads the seller's output from the indexer once Phase 4's
 * reference agent posts it. v0.1 looks for `pact:output:${jobId}` in
 * localStorage (the seller agent writes there during demo flow).
 *
 * All sizing/spacing/color resolves to design tokens.
 */
interface JobStatePanelProps {
  jobId: bigint;
  state: JobStateValue;
  createdAt: bigint;
  timeout: bigint;
}

export function JobStatePanel({
  jobId,
  state,
  createdAt,
  timeout,
}: JobStatePanelProps) {
  if (state === JobState.Pending || state === JobState.Sealed) {
    return (
      <PendingPanel jobId={jobId} createdAt={createdAt} timeout={timeout} />
    );
  }
  if (state === JobState.Attested || state === JobState.Settled) {
    return <AttestedPanel jobId={jobId} state={state} />;
  }
  if (state === JobState.Expired) {
    return (
      <Message
        kicker="Expired"
        body="The seller did not submit an attestation before the timeout. Funds are reclaimable by the buyer."
      />
    );
  }
  if (state === JobState.Disputed) {
    return (
      <Message
        kicker="Dispute open"
        body="A dispute has been opened against this job. SlashingArbiter is reviewing."
      />
    );
  }
  if (state === JobState.Slashed) {
    return (
      <Message
        kicker="Slash executed"
        body="Dispute upheld. The seller's bond was slashed; 70% to the disputer, 20% to the protocol, the remainder burned."
      />
    );
  }
  return null;
}

function PendingPanel({
  jobId,
  createdAt,
  timeout,
}: {
  jobId: bigint;
  createdAt: bigint;
  timeout: bigint;
}) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = window.setInterval(
      () => setNow(Math.floor(Date.now() / 1000)),
      1000,
    );
    return () => window.clearInterval(t);
  }, []);

  // PactEscrow stores `job.timeout` as the ABSOLUTE Unix expiry
  // timestamp (PactEscrow.sol:148 — `job.timeout = expiresAt` where
  // expiresAt = block.timestamp + the duration arg passed to createJob).
  // The createJob input is a duration; the storage field is resolved.
  // Treat it directly as an absolute expiry below.
  const elapsed = Math.max(0, now - Number(createdAt));
  const expiresAt = Number(timeout);
  const remaining = Math.max(0, expiresAt - now);
  const expired = remaining === 0;
  const expiredAgo = expired ? Math.max(0, now - expiresAt) : 0;

  return (
    <Card variant="elevated" className="p-32">
      <div className="text-caption uppercase tracking-uppercase text-slate-ink font-mono">
        Pending
      </div>
      <h3 className="mt-12 text-heading-sm tracking-heading-sm leading-heading-sm font-medium text-midnight-navy">
        Waiting for seller…
      </h3>
      <div className="mt-20 grid grid-cols-[auto_1fr] gap-x-24 gap-y-8 font-mono text-caption tracking-caption">
        <span className="text-slate-ink">elapsed</span>
        <span className="text-right text-midnight-navy">{formatDuration(elapsed)}</span>
        <span className="text-slate-ink">{expired ? "expired" : "timeout in"}</span>
        <span className="text-right text-midnight-navy">
          {expired
            ? `${formatDuration(expiredAgo)} ago`
            : formatDuration(remaining)}
        </span>
      </div>
      <button
        type="button"
        disabled={!expired}
        className="mt-32 w-full inline-flex items-center justify-center h-56 px-32 rounded-buttons bg-pure-surface border border-fog-border text-midnight-navy text-body tracking-body font-medium [box-shadow:var(--shadow-md)] disabled:opacity-50 disabled:pointer-events-none hover:text-chartreuse-pulse transition-colors"
      >
        Reclaim escrow
      </button>
      <div className="mt-12 text-center font-mono text-caption tracking-caption text-slate-ink">
        Job #{jobId.toString()} · reclaim available after timeout
      </div>
    </Card>
  );
}

function AttestedPanel({
  jobId,
  state,
}: {
  jobId: bigint;
  state: JobStateValue;
}) {
  const [output, setOutput] = useState<string | null>(null);
  useEffect(() => {
    if (state !== JobState.Settled || typeof window === "undefined") return;
    const stored = window.localStorage.getItem(`pact:output:${jobId.toString()}`);
    if (stored) setOutput(stored);
  }, [jobId, state]);

  return (
    <Card variant="elevated" className="p-32">
      <div className="flex items-center gap-12">
        <div className="text-caption uppercase tracking-uppercase text-slate-ink font-mono">
          {state === JobState.Settled ? "Settled" : "Attested"}
        </div>
        <span className="font-mono text-caption tracking-caption text-chartreuse-pulse">
          ✓ verified on-chain
        </span>
      </div>
      <div className="mt-20">
        <AttestationReceipt />
      </div>
      {state === JobState.Settled && output ? (
        <div className="mt-32 pt-24 border-t border-fog-border/50">
          <div className="text-caption uppercase tracking-uppercase text-slate-ink font-mono mb-12">
            Seller&apos;s output
          </div>
          <div className="font-mono text-caption leading-subheading tracking-caption text-midnight-navy bg-data-chip rounded-cardssmall p-16 whitespace-pre-wrap break-words">
            {output}
          </div>
          <div className="mt-12 font-mono text-caption tracking-caption text-slate-ink">
            v0.2 reads ECIES-decrypted output from indexer.
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function Message({ kicker, body }: { kicker: string; body: string }) {
  return (
    <Card variant="elevated" className="p-32">
      <div className="text-caption uppercase tracking-uppercase text-slate-ink font-mono">
        {kicker}
      </div>
      <p className="mt-16 text-body leading-body tracking-body text-storm-gray">
        {body}
      </p>
    </Card>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}
