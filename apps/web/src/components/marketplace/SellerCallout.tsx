/**
 * "How sellers register" mini callout strip below the marketplace grid.
 * Single-paragraph explainer + a quiet text link to the seller docs.
 *
 * All sizing/spacing/color resolves to design tokens.
 */
export function SellerCallout() {
  return (
    <section className="bg-ghost-canvas border-t border-fog-border/50">
      <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-72">
        <div className="text-center max-w-prose mx-auto">
          <div className="text-caption uppercase tracking-uppercase text-slate-ink mb-12 font-mono">
            How sellers register
          </div>
          <p className="text-body leading-body tracking-body text-storm-gray">
            Sellers stake a 5 $0G bond at registration, mint an ERC-7857
            Agent INFT, and start serving inferences. Reputation accrues
            to the INFT — sell the agent, sell the reputation.
          </p>
          <a
            href="/seller"
            className="mt-20 inline-block font-mono text-caption tracking-caption text-midnight-navy hover:text-chartreuse-pulse transition-colors"
          >
            Read the seller guide →
          </a>
        </div>
      </div>
    </section>
  );
}
