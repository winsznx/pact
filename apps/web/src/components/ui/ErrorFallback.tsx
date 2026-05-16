"use client";

import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { PACT_EXPLORER_URL } from "@pact/shared";

/**
 * Shared fallback UI for Next 15 `error.tsx` boundaries. Renders a
 * token-compliant card with:
 *   - Heading: "Something broke"
 *   - Subhead: short generic message
 *   - Mono caption with error class name (NOT the full stack —
 *     stack leakage risk in client bundles)
 *   - Two CTAs: [Try again] (resets boundary), [View on chainscan]
 *     (when the caller route ships a `chainscanHash`)
 *
 * Centralised so per-route error.tsx files stay one-liners.
 *
 * All sizing/spacing/color resolves to design tokens.
 */
interface ErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
  routeLabel?: string;
  chainscanHash?: string;
}

export function ErrorFallback({
  error,
  reset,
  routeLabel = "page",
  chainscanHash,
}: ErrorFallbackProps) {
  const isChainMismatch = /chain|network|unsupported/i.test(error.message);
  const errorName = error.name || "Error";

  return (
    <section className="bg-ghost-canvas">
      <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-72">
        <Card variant="elevated" className="p-32 max-w-prose mx-auto">
          <div className="text-caption uppercase tracking-uppercase text-slate-ink font-mono mb-12">
            {routeLabel} · error
          </div>
          <h1 className="font-display font-normal text-heading-lg leading-heading-lg tracking-heading-lg text-midnight-navy">
            Something broke
          </h1>
          <p className="mt-20 text-body leading-body tracking-body text-storm-gray">
            {isChainMismatch
              ? "Looks like a chain-mismatch error. Switch your wallet to 0G mainnet and retry."
              : "This page hit an error rendering on-chain state. The protocol contracts are unaffected — only this view crashed."}
          </p>
          <div className="mt-16 font-mono text-caption tracking-caption text-slate-ink">
            {errorName}
            {error.digest ? <span> · digest {error.digest}</span> : null}
          </div>
          <div className="mt-32 flex flex-wrap items-center gap-12">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center justify-center h-40 px-20 rounded-buttons bg-chartreuse-pulse text-midnight-navy text-button tracking-button font-medium [box-shadow:var(--shadow-cta-pill)] hover:brightness-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chartreuse-pulse focus-visible:ring-offset-2 focus-visible:ring-offset-pure-surface transition-transform"
            >
              Try again
            </button>
            {chainscanHash ? (
              <a
                href={`${PACT_EXPLORER_URL}/tx/${chainscanHash}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-caption tracking-caption text-midnight-navy hover:text-chartreuse-pulse transition-colors"
              >
                View on chainscan ↗
              </a>
            ) : null}
            <Link
              href="/"
              className="font-mono text-caption tracking-caption text-slate-ink hover:text-midnight-navy transition-colors"
            >
              ← Back to landing
            </Link>
          </div>
        </Card>
      </div>
    </section>
  );
}
