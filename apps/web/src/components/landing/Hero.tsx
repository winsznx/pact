import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

/**
 * Hero, centered single-column per DESIGN.md "Layout":
 *   "headline and CTA are centered over the dot-globe illustration."
 *
 * Full-bleed gradient (deep-cosmos → electric blue → cyan) carries the
 * single dark band of the page — DESIGN.md is explicit:
 *   "do not add additional dark bands."
 *
 * The dot-pattern + soft blue radial substitutes for the dot-globe
 * illustration ("evokes network topology without lifestyle imagery").
 *
 * One chartreuse primary CTA per DESIGN.md
 *   "Reserve chartreuse exclusively for the primary CTA fill."
 * Plus one dark-ghost secondary for the seller path.
 *
 * The product showcase cards (ServiceCard / AttestationReceipt /
 * ReputationINFT) live in a separate light-canvas section below the hero
 * — they're "Feature Card (Elevated)" surfaces, not hero ornaments.
 */
export function Hero() {
  return (
    <section
      className="relative w-full overflow-hidden"
      style={{ background: "var(--gradient-hero)" }}
    >
      {/* Dot-grid overlay — Antimetal's "abstract network topology" cue.
          rgba below is a decorative atmospheric effect, not a theme color. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.18] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.55) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      {/* Soft blue radial bleed under the headline — atmospheric depth.
          rgba below is a decorative atmospheric effect, not a theme color. */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-[640px] w-[920px] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          background:
            "radial-gradient(50% 50%, rgba(95,189,247,0.40) 0%, rgba(0,128,248,0.18) 40%, rgba(248,249,252,0) 100%)",
          filter: "blur(72px)",
        }}
      />

      <div className="relative mx-auto w-full max-w-[var(--page-max-width)] px-24 py-96 text-center sm:py-120 lg:py-120">
        {/* Announcement Banner Pill, centered above the headline per
            DESIGN.md component spec. Inner content keeps the 14px Badge
            default — no text-size override (which previously made the pill
            look 60% smaller than spec). */}
        <div className="flex justify-center">
          <Badge variant="neutral" className="mb-28">
            <span className="inline-flex items-center gap-8 font-mono tracking-uppercase">
              <span
                aria-hidden
                className="inline-block w-6 h-6 rounded-buttons bg-chartreuse-pulse pact-live-pulse"
              />
              live · 0G mainnet · 7 contracts deployed
            </span>
          </Badge>
        </div>

        {/* `text-balance` alone — no `max-w-[Nch]` constraint. The earlier
            combo forced 4 cramped lines because max-w gave balance no room
            to optimize. Removing it lets the browser fall to the natural
            container width and balance distributes across 2-3 lines. */}
        <h1 className="font-display font-normal text-heading sm:text-heading-lg lg:text-display leading-display tracking-display text-frost-white text-balance mx-auto">
          AI agents are about to become the largest economic actors in Web3.
        </h1>

        <p className="mt-24 text-lead leading-lead tracking-lead text-ice-veil max-w-[42ch] mx-auto">
          Today, no one can prove what model they ran.
        </p>
        <p className="mt-12 text-body leading-body tracking-body text-ice-veil/75 max-w-[60ch] mx-auto">
          PACT is the settlement layer for verifiable AI-as-a-service. Every
          inference produces a TEE-attested ECDSA signature recoverable
          on-chain. Sellers mint Agent INFTs, buyers pay per call, reputation
          travels with the token.
        </p>

        <div className="mt-40 flex flex-wrap items-center justify-center gap-12">
          <Link href="/marketplace">
            <Button variant="chartreuse" size="xl">
              Start as Buyer
            </Button>
          </Link>
          <Link href="/seller">
            <Button variant="darkGhost" size="xl">
              Become a Seller
            </Button>
          </Link>
        </div>

        {/* Tertiary text link — DESIGN.md keeps "secondary actions on dark
            hero" minimal; making "Read the protocol" a quiet underlined
            link instead of a third pill avoids button-soup. */}
        <div className="mt-24">
          <a
            href="https://github.com/winsznx/pact/blob/main/docs/MASTER_PRD.md"
            target="_blank"
            rel="noreferrer"
            className="text-body text-ice-veil/80 hover:text-frost-white underline decoration-ice-veil/30 underline-offset-4 hover:decoration-ice-veil/80 tracking-body"
          >
            Read the protocol ↗
          </a>
        </div>
      </div>
    </section>
  );
}
