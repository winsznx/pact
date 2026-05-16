"use client";

// CHUNK 7 — live protocol heartbeat. Replaces CHUNK 6's placeholder.
//
// Three regions: compact hero with live pulse dot → compact stats row →
// combined activity feed (top 20 events across all 4 contracts). Below
// the feed: "Surfaces ready" cards for event types that haven't fired
// yet, so the surface area is visible even when the happy path
// dominates.

import { Card } from "@/components/ui/Card";
import { ActivityFeed } from "@/components/explore/ActivityFeed";
import { ExploreStatsRow } from "@/components/explore/ExploreStatsRow";
import { LivePulseDot } from "@/components/explore/LivePulseDot";
import { useProtocolActivity } from "@/lib/useProtocolActivity";

export default function ExplorePage() {
  const activity = useProtocolActivity();
  const lastFetched =
    activity.dataUpdatedAt > 0
      ? Math.max(0, Math.floor((Date.now() - activity.dataUpdatedAt) / 1000))
      : null;

  // Counts for the "Surfaces ready" cards — derive from the entry feed
  // we already have so we don't make extra requests.
  const slashCount =
    activity.data?.entries.filter((e) => e.type === "SLASH_EXECUTED").length ??
    0;
  const expiredCount =
    activity.data?.entries.filter((e) => e.type === "JOB_RECLAIMED").length ??
    0;
  const disputeCount = 0; // surfaced separately when the indexer joins disputes

  return (
    <>
      {/* Compact hero — data page, not a marketing page */}
      <section className="bg-ghost-canvas">
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 pt-72 pb-40">
          <div className="text-caption uppercase tracking-uppercase text-slate-ink mb-12 font-mono">
            PACT activity · 0G mainnet · chainId 16661
          </div>
          <h1 className="font-display font-normal text-heading-lg tracking-heading-lg leading-heading-lg text-midnight-navy">
            Live protocol heartbeat
          </h1>
          <p className="mt-20 text-body leading-body tracking-body text-storm-gray max-w-prose">
            Every settlement, every attestation, every reputation update —
            verifiable on-chain.
          </p>
          <div className="mt-20 flex items-center gap-12">
            <LivePulseDot isRefetching={activity.isFetching} />
            <span className="font-mono text-caption tracking-caption text-slate-ink">
              {activity.isFetching
                ? "fetching…"
                : lastFetched !== null
                  ? `last refresh: ${lastFetched}s ago`
                  : "polling every 10s"}
            </span>
          </div>
        </div>
      </section>

      {/* Stats row */}
      <section className="bg-ghost-canvas border-t border-fog-border/50 border-b">
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-40">
          <ExploreStatsRow />
        </div>
      </section>

      {/* Combined activity feed */}
      <section className="bg-ghost-canvas">
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-40">
          <div className="mb-20 flex items-center justify-between">
            <h2 className="text-heading-sm tracking-heading-sm leading-heading-sm font-medium text-midnight-navy">
              Recent activity
            </h2>
            <span className="font-mono text-caption tracking-caption text-slate-ink">
              top {activity.data?.entries.length ?? 0} · newest first
            </span>
          </div>
          <ActivityFeed />
        </div>
      </section>

      {/* Surfaces ready — adversarial paths the protocol supports */}
      <section className="bg-ghost-canvas">
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-72">
          <div className="text-center mb-32">
            <div className="text-caption uppercase tracking-uppercase text-slate-ink mb-12 font-mono">
              Surfaces ready
            </div>
            <h2 className="text-heading-sm tracking-heading-sm leading-heading-sm font-medium text-midnight-navy">
              Adversarial paths supported but not yet fired
            </h2>
          </div>
          <div className="grid gap-24 md:grid-cols-3">
            <SurfaceCard
              kicker="Slashes"
              count={slashCount}
              body="0 to date — the bond pattern is holding. First adversarial seller triggers a 5 $0G redistribution: 70% disputer, 20% protocol, remainder burned."
            />
            <SurfaceCard
              kicker="Disputes opened"
              count={disputeCount}
              body="0 to date. Buyers can challenge any attestation by posting a 0.001 $0G dispute bond. Verifier re-runs ECDSA recovery against the current signing key."
            />
            <SurfaceCard
              kicker="Jobs expired"
              count={expiredCount}
              body="0 to date. If a seller doesn't submit attestation before the timeout, the buyer reclaims the full escrow. No oracle, no off-chain arbiter."
            />
          </div>
        </div>
      </section>
    </>
  );
}

function SurfaceCard({
  kicker,
  count,
  body,
}: {
  kicker: string;
  count: number;
  body: string;
}) {
  return (
    <Card variant="elevated" className="p-32">
      <div className="text-caption uppercase tracking-uppercase text-slate-ink mb-12 font-mono">
        {kicker}
      </div>
      <div className="font-mono text-heading tracking-heading leading-heading text-midnight-navy">
        {count}
      </div>
      <p className="mt-16 text-body leading-body tracking-body text-storm-gray">
        {body}
      </p>
    </Card>
  );
}
