import { Hero } from "@/components/landing/Hero";
import { StatsStrip } from "@/components/landing/StatsStrip";
import { ServiceCard } from "@/components/landing/ServiceCard";
import { AttestationReceipt } from "@/components/landing/AttestationReceipt";
import { ReputationINFT } from "@/components/landing/ReputationINFT";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { IntegrationSnippet } from "@/components/landing/IntegrationSnippet";
import { Card } from "@/components/ui/Card";

export default function HomePage() {
  return (
    <>
      <Hero />

      {/* Live mainnet stats strip — first beat after the hero, anchors the
          "real numbers on real chain" claim before any other content. */}
      <StatsStrip />

      {/* "Live on 0G mainnet" showcase — three Feature Card (Elevated)
          surfaces on the ghost-canvas, exactly the pattern DESIGN.md spells
          out: dark hero → sustained light product canvas with white cards.
          Each card is real on-chain data (ServiceId 1, captured G5
          attestation, INFT #0). 3-up at lg, stacked on mobile. */}
      <section className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-96">
        <div className="text-center mb-56 mx-auto">
          <div className="text-caption uppercase tracking-uppercase text-slate-ink mb-16 font-mono">
            Live on 0G mainnet
          </div>
          <h2 className="font-display font-normal text-heading-lg tracking-heading-lg leading-heading-lg text-midnight-navy text-balance">
            Real seller. Real attestation. Real settlement.
          </h2>
          <p className="mt-20 text-body leading-body tracking-body text-storm-gray">
            Every contract on this page is verifiable on{" "}
            <a
              href="https://chainscan.0g.ai"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-fog-border underline-offset-4 hover:decoration-midnight-navy"
            >
              chainscan.0g.ai
            </a>
            . No screenshots — these are live reads.
          </p>
        </div>

        <div className="grid gap-24 md:grid-cols-3 items-start">
          <ServiceCard />
          <AttestationReceipt />
          <ReputationINFT />
        </div>
      </section>

      {/* "How a PACT job settles" — 3-step state-machine cards. Sits between
          the showcase and the conceptual feature columns so the reader sees
          *what* exists, then *how it flows*, then *why it matters*. */}
      <HowItWorks />

      {/* Three feature columns — the demo screenplay's three beats, on the
          same ghost canvas. No 1px outer ring, no boxed callouts; pure type
          per Antimetal's text-driven feature pattern. */}
      <section className="mx-auto w-full max-w-[var(--page-max-width)] px-24 pb-96">
        <div className="grid gap-40 md:grid-cols-3 md:gap-32">
          <FeatureColumn
            kicker="Cryptographic settlement"
            title="ECDSA-recoverable TEE attestations"
            body="Each inference returns a 5-field colon-separated text signed
              by the provider's TEE-bound key. We recover the signer on-chain
              with EIP-191 personal_sign — same primitive Ethereum has used
              for ten years."
          />
          <FeatureColumn
            kicker="INFT-bound reputation"
            title="Reputation travels with the token"
            body="Settled jobs increment a sybil-discounted weighted score
              against the seller's ERC-7857 INFT. Sell the agent, sell the
              reputation. Reputation is never wallet-bound — it's a
              transferable economic instrument."
          />
          <FeatureColumn
            kicker="Bond + slash"
            title="Slashable bond gates the moat"
            body="Sellers stake a bond at registration. Disputes re-run the
              attestation against the current signing key; on signer mismatch
              the bond is slashed 70% to the disputer, 20% to the protocol,
              the remainder burned. Loser pays."
          />
        </div>
      </section>

      {/* "Three lines to verifiable inference" — dark code panel showing
          the @pact/sdk surface. Brief deep-cosmos rhyme back to the hero
          before the page closes on the provenance line + footer. */}
      <IntegrationSnippet />

      {/* Provenance — Section Background Card (radius 16px, ghost-canvas
          fill, no shadow per DESIGN.md). Reads as a quiet authority callout
          rather than a sales line. */}
      <section className="mx-auto w-full max-w-[var(--page-max-width)] px-24 pb-96">
        <Card variant="section" className="px-32 py-40">
          <div className="text-caption uppercase tracking-uppercase text-slate-ink mb-12 font-mono">
            Provenance
          </div>
          <p className="text-subheading leading-subheading tracking-subheading text-midnight-navy max-w-3xl">
            Captured on 0G mainnet on{" "}
            <span className="font-mono text-body">2026-05-07</span>: a real
            inference returns a real ECDSA signature recovering to{" "}
            <span className="font-mono text-button text-deep-cosmos">
              0x4C1b546f…7ee8
            </span>
            . Reproduce the run with{" "}
            <span className="font-mono text-sm">
              pnpm --filter @pact/contracts smoke
            </span>
            .
          </p>
        </Card>
      </section>
    </>
  );
}

function FeatureColumn({
  kicker,
  title,
  body,
}: {
  kicker: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div className="text-caption uppercase tracking-uppercase text-slate-ink font-mono">
        {kicker}
      </div>
      <h3 className="mt-12 text-heading tracking-heading font-medium text-midnight-navy leading-heading">
        {title}
      </h3>
      <p className="mt-12 text-button leading-button tracking-button text-storm-gray">
        {body}
      </p>
    </div>
  );
}
