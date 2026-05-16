"use client";

import Link from "next/link";

import { EventTypePill } from "./EventTypePill";
import type { ActivityEntry } from "@/lib/useProtocolActivity";

/**
 * Single row in the explore feed. Wraps the whole row in a Link to the
 * relevant detail page (/jobs/N or /marketplace/N) for click affordance,
 * but the trailing ↗ chainscan icon-link `stopPropagation`s so it stays
 * a separate target without nested-anchor markup warnings.
 *
 * Hover state lifts the row onto pure-surface above the ghost-canvas
 * page background.
 *
 * All sizing/spacing/color resolves to design tokens.
 */
export function ActivityRow({ entry }: { entry: ActivityEntry }) {
  return (
    <Link
      href={entry.navHref}
      className="block border-b border-fog-border/50 hover:bg-pure-surface transition-colors"
    >
      <div className="flex items-center gap-16 px-16 py-16">
        <div className="shrink-0">
          <EventTypePill type={entry.type} />
        </div>
        <div className="flex-1 min-w-0 text-body leading-body tracking-body text-midnight-navy">
          {entry.primaryText}
        </div>
        <div className="hidden sm:block shrink-0 font-mono text-caption tracking-caption text-slate-ink">
          {formatRelative(entry.timestamp)}
        </div>
        <a
          href={entry.chainscanHref}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 font-mono text-caption tracking-caption text-slate-ink hover:text-chartreuse-pulse transition-colors"
          title="View transaction on chainscan.0g.ai"
        >
          ↗
        </a>
      </div>
    </Link>
  );
}

function formatRelative(unixSeconds: number): string {
  if (!unixSeconds) return "—";
  const nowSec = Math.floor(Date.now() / 1000);
  const delta = Math.max(0, nowSec - unixSeconds);
  if (delta < 60) return `${delta}s ago`;
  const m = Math.floor(delta / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
