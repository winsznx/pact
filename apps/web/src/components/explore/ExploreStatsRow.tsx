"use client";

import { formatEther } from "viem";

import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
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
  const formatOg = (n: number): string => n.toFixed(3);

  const totalSettledOg =
    activity.isLoading || activity.data === undefined
      ? null
      : Number(formatEther(activity.data.totalSettledWei));

  const rows: Array<{
    key: string;
    value: number | undefined;
    placeholderValue?: string;
    label: string;
    isMonoValue?: boolean;
    formatter?: (n: number) => string;
  }> = [
    {
      key: "settled",
      value:
        stats.isLoading || stats.data?.jobsSettled === undefined
          ? undefined
          : stats.data.jobsSettled,
      label: "Jobs settled",
    },
    {
      key: "wei",
      value: totalSettledOg ?? undefined,
      label: "Total $0G settled",
      isMonoValue: true,
      formatter: formatOg,
    },
    {
      key: "sigs",
      value:
        activity.isLoading || activity.data === undefined
          ? undefined
          : activity.data.signaturesRecovered,
      label: "Signatures recovered on-chain",
    },
    {
      key: "sellers",
      value:
        stats.isLoading || stats.data?.bondedSellers === undefined
          ? undefined
          : stats.data.bondedSellers,
      label: "Bonded sellers",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-32 lg:grid-cols-4">
      {rows.map((r) => (
        <div key={r.key} className="text-center">
          <StatNumber
            size="md"
            className={
              r.isMonoValue
                ? "block text-midnight-navy font-mono"
                : "block text-midnight-navy"
            }
          >
            {r.value === undefined ? (
              placeholder
            ) : (
              <AnimatedNumber value={r.value} formatter={r.formatter} />
            )}
          </StatNumber>
          <div className="mt-12 font-mono text-caption tracking-uppercase uppercase text-slate-ink">
            {r.label}
          </div>
        </div>
      ))}
    </div>
  );
}
