import { StatNumber } from "@/components/ui/StatNumber";

/**
 * Service-scoped variant of the landing StatsStrip. Same visual treatment
 * (StatNumber size="lg" upright serif + caption-mono uppercase labels in
 * slate-ink), but the four stats describe a single service rather than
 * the whole protocol.
 *
 * Stats are passed in so this component is reusable for CHUNK 4's chain
 * reads — the visual layout never has to know whether the numbers are
 * hardcoded or fetched.
 *
 * All sizing/spacing/color resolves to design tokens.
 */
interface ServiceStatsStripProps {
  stats: ReadonlyArray<{ value: string; label: string }>;
}

export function ServiceStatsStrip({ stats }: ServiceStatsStripProps) {
  return (
    <section className="bg-ghost-canvas border-t border-fog-border/50 border-b">
      <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-72">
        <div className="grid grid-cols-2 gap-32 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <StatNumber size="lg" className="block text-midnight-navy">
                {s.value}
              </StatNumber>
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
