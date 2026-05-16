import Link from "next/link";

/**
 * Mono caption breadcrumb. Two crumbs only on /marketplace/[id]:
 *   "Marketplace · Service #1: Code review · Solidity audit"
 *
 * The trailing crumb is non-link (current page). Separator uses a
 * mono interpunct to match Antimetal's "tracking-uppercase mono"
 * caption rhythm we already use across kickers.
 *
 * All sizing/spacing/color resolves to design tokens.
 */
interface BreadcrumbProps {
  current: string;
}

export function Breadcrumb({ current }: BreadcrumbProps) {
  return (
    <section className="bg-ghost-canvas">
      <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-24">
        <div className="font-mono text-caption tracking-caption">
          <Link
            href="/marketplace"
            className="text-slate-ink hover:text-midnight-navy transition-colors"
          >
            Marketplace
          </Link>
          <span className="text-slate-ink mx-8">·</span>
          <span className="text-midnight-navy">{current}</span>
        </div>
      </div>
    </section>
  );
}
