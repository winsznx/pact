"use client";

import { formatEther } from "viem";

import { StatNumber } from "@/components/ui/StatNumber";
import { usePactStats } from "@/lib/usePactStats";
import { useProtocolActivity } from "@/lib/useProtocolActivity";

/**
 * Compact stats row for /explore. Different from landing's StatsStrip:
 *   - Uses StatNumber size="md" (--text-heading-lg, 40px) instead of
 *     "lg" — this page is data-dense, the numbers shouldn't dominate.
 *   - 4 stats sourced from a mix of usePactStats (jobsSettled,
 *     bondedSellers) and useProtocolActivity (totalSettledWei,
 *     signaturesRecovered).
 *   - Em-dash placeholder while loading; never a misleading "0".
 *
 * All sizing/spacing/color resolves to design tokens.
 */
export function ExploreStatsRow() {
  const stats = usePactStats();
  const activity = useProtocolActivity();

  const placeholder = "—";
  const fmtCount = (n: number | undefined): string =>
    stats.isLoading || n === undefined ? placeholder : n.toString();

  const totalSettledOg =
    activity.isLoading || activity.data === undefined
      ? placeholder
      : formatEther(activity.data.totalSettledWei);
  const signaturesRecovered =
    activity.isLoading || activity.data === undefined
      ? placeholder
      : activity.data.signaturesRecovered.toString();

  const rows = [
    { value: fmtCount(stats.data?.jobsSettled), label: "Jobs settled" },
    { value: totalSettledOg, label: "Total $0G settled", isMonoValue: true },
    { value: signaturesRecovered, label: "Signatures recovered on-chain" },
    { value: fmtCount(stats.data?.bondedSellers), label: "Bonded sellers" },
  ];

  return (
    <div className="grid grid-cols-2 gap-32 lg:grid-cols-4">
      {rows.map((r) => (
        <div key={r.label} className="text-center">
          <StatNumber
            size="md"
            className={
              r.isMonoValue
                ? "block text-midnight-navy font-mono"
                : "block text-midnight-navy"
            }
          >
            {r.value}
          </StatNumber>
          <div className="mt-12 font-mono text-caption tracking-uppercase uppercase text-slate-ink">
            {r.label}
          </div>
        </div>
      ))}
    </div>
  );
}
