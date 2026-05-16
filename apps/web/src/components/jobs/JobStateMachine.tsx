"use client";

import { JobState, JobStateLabel, type JobStateValue } from "@/lib/wagmi";

/**
 * Horizontal flow diagram of the job state machine. 4 happy-path nodes
 * (Pending → Sealed → Attested → Settled). Terminal alt states (Expired,
 * Disputed, Slashed) are rendered as a single trailing chip when the
 * job lands there.
 *
 * Each node has 3 visual states:
 *   - past (settled or earlier)   → midnight-navy fill, frost-white text
 *   - active (current state)      → chartreuse fill + ring, midnight-navy text
 *   - future (not yet reached)    → ghost-canvas + fog-border ring
 *
 * Pure HTML/CSS — no library dependencies.
 *
 * All sizing/spacing/color resolves to design tokens.
 */
const HAPPY_PATH: ReadonlyArray<JobStateValue> = [
  JobState.Pending,
  JobState.Sealed,
  JobState.Attested,
  JobState.Settled,
];

const TERMINAL_ALT: ReadonlyArray<JobStateValue> = [
  JobState.Expired,
  JobState.Disputed,
  JobState.Slashed,
];

export function JobStateMachine({ state }: { state: JobStateValue }) {
  const inAlt = TERMINAL_ALT.includes(state);
  const happyIdx = HAPPY_PATH.indexOf(state);

  return (
    <section className="bg-ghost-canvas border-t border-fog-border/50 border-b">
      <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-40">
        <div className="flex items-center justify-center gap-12 flex-wrap">
          {HAPPY_PATH.map((node, i) => {
            const status: "past" | "active" | "future" = inAlt
              ? "past"
              : i < happyIdx
                ? "past"
                : i === happyIdx
                  ? "active"
                  : "future";
            return (
              <NodeWithConnector
                key={node}
                label={JobStateLabel[node]}
                status={status}
                isLast={i === HAPPY_PATH.length - 1 && !inAlt}
              />
            );
          })}
          {inAlt ? (
            <>
              <Connector />
              <Node label={JobStateLabel[state]} status="alt" />
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function NodeWithConnector({
  label,
  status,
  isLast,
}: {
  label: string;
  status: "past" | "active" | "future";
  isLast: boolean;
}) {
  return (
    <>
      <Node label={label} status={status} />
      {!isLast ? <Connector /> : null}
    </>
  );
}

function Node({
  label,
  status,
}: {
  label: string;
  status: "past" | "active" | "future" | "alt";
}) {
  const styles =
    status === "active"
      ? "bg-chartreuse-pulse text-midnight-navy ring-2 ring-chartreuse-pulse/40 pact-match-pop"
      : status === "past"
        ? "bg-midnight-navy text-frost-white"
        : status === "alt"
          ? "bg-midnight-navy text-frost-white"
          : "bg-ghost-canvas text-slate-ink border border-fog-border/50";
  return (
    <div
      key={`${label}-${status}`}
      className={`inline-flex items-center justify-center px-20 py-12 rounded-buttons font-mono text-caption tracking-caption transition-colors duration-500 ease-out ${styles}`}
    >
      {label}
    </div>
  );
}

function Connector() {
  return (
    <span aria-hidden className="text-slate-ink font-mono text-caption transition-colors duration-500">
      →
    </span>
  );
}
