/**
 * Marketplace filter + sort strip.
 *
 * v0.1: filter pills are inert (we only have Service 1 — nothing to filter
 * against). Hover state still wired so the row reads as interactive.
 * Sort is a styled button with a chevron rather than a native <select>
 * (DESIGN.md §"Components" — Antimetal styles every interactive element
 * as a pill or pill-button, never raw form controls).
 *
 * Filter logic ships in CHUNK 2.5 once 2+ services register.
 *
 * All sizing/spacing/color resolves to design tokens.
 */

const FILTERS: ReadonlyArray<{ label: string; count: number; active?: boolean }> = [
  { label: "code-review", count: 1, active: true },
  { label: "TeeTLS attested", count: 1 },
  { label: "≤ 0.01 $0G", count: 1 },
];

export function FilterRow() {
  return (
    <section className="bg-ghost-canvas border-b border-fog-border/50">
      <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-32">
        <div className="flex flex-wrap items-center justify-between gap-20">
          {/* Left: filter pills */}
          <div className="flex flex-wrap items-center gap-12">
            {FILTERS.map((f) => (
              <FilterPill key={f.label} label={f.label} count={f.count} active={f.active} />
            ))}
          </div>

          {/* Right: sort dropdown (button, no native select) */}
          <SortButton />
        </div>

        {/* Result count line */}
        <div className="mt-20 font-mono text-caption tracking-caption text-slate-ink">
          1 service · 0 settled jobs · network bonded total: 5 $0G
        </div>
      </div>
    </section>
  );
}

function FilterPill({
  label,
  count,
  active,
}: {
  label: string;
  count: number;
  active?: boolean;
}) {
  const base =
    "inline-flex items-center gap-8 rounded-badges px-16 py-8 text-label tracking-label font-medium " +
    "[box-shadow:var(--shadow-md)] transition-colors cursor-pointer";
  const colors = active
    ? "bg-pure-surface text-chartreuse-pulse"
    : "bg-pure-surface text-midnight-navy hover:text-chartreuse-pulse";
  return (
    <button type="button" className={`${base} ${colors}`}>
      <span>{label}</span>
      <span className="font-mono text-caption text-slate-ink">· {count}</span>
    </button>
  );
}

function SortButton() {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-8 rounded-buttons px-16 py-8 text-label tracking-label font-medium bg-pure-surface text-midnight-navy [box-shadow:var(--shadow-md)] hover:text-chartreuse-pulse transition-colors cursor-pointer"
    >
      <span>Sort by reputation</span>
      <span className="text-slate-ink">▾</span>
    </button>
  );
}
