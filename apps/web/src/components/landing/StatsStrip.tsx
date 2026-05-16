"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { StatNumber } from "@/components/ui/StatNumber";
import { usePactStats } from "@/lib/usePactStats";

/**
 * Live mainnet stats strip — sits immediately after the hero on the
 * ghost-canvas surface. Establishes the "real on-chain numbers" beat
 * before the showcase cards.
 *
 * Each number is a live read off 0G mainnet via `usePactStats` (15s
 * polling). On loading or read failure a single em-dash placeholder
 * stands in — never a "0" that could mislead a viewer into thinking
 * a fetch failure is a confident zero count.
 *
 * Layout: 4 stats centered in a row at lg, 2x2 grid on mobile. Big
 * upright serif numerals (StatNumber size="lg" = --text-display, 46px),
 * caption-mono labels below in slate-ink.
 *
 * All sizing/spacing/color resolves to design tokens.
 */

export function StatsStrip() {
  const { data, isLoading } = usePactStats();

  const stats = [
    { value: data?.contractsDeployed, label: "Contracts deployed" },
    { value: data?.servicesLive, label: "Services live" },
    { value: data?.jobsSettled, label: "Jobs settled" },
    { value: data?.bondedSellers, label: "Bonded sellers" },
  ];

  return (
    <section className="bg-ghost-canvas">
      <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-72">
        <div className="text-center mb-40">
          <span className="font-mono text-caption tracking-uppercase uppercase text-slate-ink">
            PACT on 0G mainnet · chainId 16661
          </span>
        </div>
        <div className="grid grid-cols-2 gap-32 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              {isLoading || s.value === undefined ? (
                // Geometry-matched skeleton: same height as StatNumber `lg`
                // (text-display = 46px) so swap-in causes zero layout shift.
                <Skeleton className="h-48 w-32 mx-auto" />
              ) : (
                <StatNumber size="lg" className="block text-midnight-navy">
                  {s.value.toString()}
                </StatNumber>
              )}
              <div className="mt-12 font-mono text-caption tracking-uppercase uppercase text-slate-ink">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
