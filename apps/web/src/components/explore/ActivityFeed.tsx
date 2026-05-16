"use client";

import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ActivityRow } from "./ActivityRow";
import { useProtocolActivity } from "@/lib/useProtocolActivity";

/**
 * Combined activity feed. The Card is variant="section" (ghost-canvas
 * fill, no shadow) so the white pure-surface rows on hover float as
 * elevation cues. Loading + error + empty states are token-compliant
 * and never claim a confident "0 entries" when fetch failed.
 *
 * All sizing/spacing/color resolves to design tokens.
 */
export function ActivityFeed() {
  const { data, isLoading, isError } = useProtocolActivity();

  if (isLoading) {
    return (
      <Card variant="section" className="overflow-hidden">
        <div role="list">
          {Array.from({ length: 7 }, (_, i) => (
            <div
              key={i}
              className="flex items-center gap-16 px-16 py-16 border-b border-fog-border/50"
            >
              <Skeleton className="h-24 w-120" />
              <Skeleton className="flex-1 h-16" />
              <Skeleton className="hidden sm:block h-12 w-60" />
              <Skeleton className="h-12 w-12" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card variant="section" className="px-16 py-72 text-center">
        <p className="text-body leading-body tracking-body text-midnight-navy">
          Activity fetch failed. Retrying in 10s.
        </p>
      </Card>
    );
  }

  const entries = data?.entries ?? [];

  if (entries.length === 0) {
    return (
      <Card variant="section" className="px-16 py-72 text-center">
        <p className="text-body leading-body tracking-body text-midnight-navy">
          Quiet moment on the protocol.
        </p>
        <p className="mt-8 font-mono text-caption tracking-caption text-slate-ink">
          New activity refreshes every 10 seconds.
        </p>
      </Card>
    );
  }

  return (
    <Card variant="section" className="overflow-hidden">
      <div role="list">
        {entries.map((e) => (
          <ActivityRow key={e.id} entry={e} />
        ))}
      </div>
    </Card>
  );
}
