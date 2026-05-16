import type { ActivityType } from "@/lib/useProtocolActivity";

/**
 * Small caption-mono uppercase pill labelling each feed row's event type.
 *
 * Three colour intents:
 *   - "verify" (chartreuse-on-dark-navy fill) — the moat moment
 *   - "routine" (transparent w/ slate-ink border + slate-ink text)
 *   - "adversarial" (transparent w/ midnight-navy border + midnight-navy
 *     text) — slashes / disputes / expiries. We don't have a red token
 *     in the design system; midnight-navy w/ heavier weight reads as
 *     "consequence" without inventing a new colour.
 *
 * All sizing/spacing/color resolves to design tokens.
 */
const INTENTS: Record<
  ActivityType,
  { label: string; tone: "verify" | "routine" | "adversarial" }
> = {
  ATTESTATION_VERIFIED: { label: "ATTESTATION", tone: "verify" },
  JOB_CREATED: { label: "JOB CREATED", tone: "routine" },
  BOND_STAKED: { label: "BOND STAKED", tone: "routine" },
  SERVICE_REGISTERED: { label: "SERVICE REGISTERED", tone: "routine" },
  INFT_MINTED: { label: "INFT MINTED", tone: "routine" },
  REPUTATION_INCREMENT: { label: "REPUTATION +1", tone: "routine" },
  SLASH_EXECUTED: { label: "SLASH EXECUTED", tone: "adversarial" },
  JOB_RECLAIMED: { label: "JOB EXPIRED", tone: "adversarial" },
};

export function EventTypePill({ type }: { type: ActivityType }) {
  const intent = INTENTS[type];
  const tone =
    intent.tone === "verify"
      ? "bg-chartreuse-pulse text-midnight-navy"
      : intent.tone === "adversarial"
        ? "bg-pure-surface text-midnight-navy border border-midnight-navy font-medium"
        : "bg-pure-surface text-slate-ink border border-fog-border";

  return (
    <span
      className={
        "inline-flex items-center px-12 py-4 rounded-badges font-mono text-caption tracking-uppercase uppercase " +
        tone
      }
    >
      {intent.label}
    </span>
  );
}
