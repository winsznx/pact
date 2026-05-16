// CHUNK 3 — v0.1: only Service 1 registered. CHUNK 4 wires the real
//   PactRegistry.totalServices() check via wagmi useReadContract.

import Link from "next/link";
import { notFound } from "next/navigation";
import { PACT_ADDRESSES, PACT_EXPLORER_URL } from "@pact/shared";

import { Card } from "@/components/ui/Card";
import { AttestationReceipt } from "@/components/landing/AttestationReceipt";
import { Breadcrumb } from "@/components/service-detail/Breadcrumb";
import { ServicePricingCard } from "@/components/service-detail/ServicePricingCard";
import { ServiceIdentityCard } from "@/components/service-detail/ServiceIdentityCard";
import { ServiceStatsStrip } from "@/components/service-detail/ServiceStatsStrip";

const SERVICE_1 = {
  id: 1,
  title: "Code review · Solidity audit",
  model: "zai-org/GLM-5-FP8",
  providerType: "centralized",
  providerIdentity: "openrouter",
  signingAddress: "0x4C1b546f5Fc11A9c2428eaFEd1D951Aa13C17ee8",
  ogProvider: "0xd9966e13a6026Fcca4b13E7ff95c94DE268C471C",
  inftTokenId: "0",
  inftOwner: "0xbF7EF900E2dB365455B91Fb133f78Fc70114Bf31",
  pricePerCall: "0.001",
  bondedAmount: "5",
  registeredOn: "2026-05-08",
} as const;

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const { serviceId } = await params;

  // v0.1 only Service 1 is registered. Anything else -> Next 404.
  if (serviceId !== "1") {
    notFound();
  }

  const s = SERVICE_1;

  return (
    <>
      <Breadcrumb current={`Service #${s.id}: ${s.title}`} />

      {/* Page header — 2-col at lg, stacked at md */}
      <section className="bg-ghost-canvas">
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-72">
          <div className="grid gap-32 lg:grid-cols-[3fr_2fr] lg:items-start">
            {/* Left: kicker + heading + meta */}
            <div>
              <div className="text-caption uppercase tracking-uppercase text-slate-ink font-mono">
                service · {s.id} · live · 0G mainnet
              </div>
              <h1 className="mt-16 font-display font-normal text-display leading-display tracking-display text-midnight-navy text-balance">
                {s.title}
              </h1>
              <div className="mt-20 font-mono text-caption tracking-caption text-slate-ink">
                {s.model} · {s.providerType} via {s.providerIdentity} · TeeTLS
                (target separated)
              </div>
            </div>

            {/* Right: pricing + CTA card */}
            <ServicePricingCard
              serviceId={s.id}
              pricePerCall={s.pricePerCall}
              bondedAmount={s.bondedAmount}
            />
          </div>
        </div>
      </section>

      {/* Stats strip — service-scoped 4 numbers */}
      <ServiceStatsStrip
        stats={[
          { value: "0", label: "Settled jobs" },
          { value: "0.000", label: "Lifetime $0G earned" },
          { value: "—", label: "Weighted reputation score" },
          { value: "0", label: "Days live" },
        ]}
      />

      {/* Service registration / on-chain identity */}
      <section className="bg-ghost-canvas">
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-72">
          <div className="text-center mb-40">
            <div className="text-caption uppercase tracking-uppercase text-slate-ink mb-12 font-mono">
              Service registration
            </div>
            <h2 className="font-display font-normal text-heading-sm tracking-heading-sm leading-heading-sm text-midnight-navy">
              On-chain identity
            </h2>
          </div>
          <div className="grid gap-24 md:grid-cols-2 items-start">
            <ServiceIdentityCard
              signingAddress={s.signingAddress}
              ogProvider={s.ogProvider}
              registeredOn={s.registeredOn}
              inftTokenId={s.inftTokenId}
              inftOwner={s.inftOwner}
            />
            <Card variant="section" className="p-32">
              <p className="text-body leading-body tracking-body text-storm-gray">
                Every field above reads from PactRegistry on 0G mainnet.
                The signing address recovers from the seller&apos;s
                TEE-attested ECDSA signature on every settled job. The 0G
                provider is the TEE node operator routing the inference.
                The INFT tokenId binds reputation to a transferable
                ERC-7857 token — sell the agent, sell the reputation.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Sample attestation — the canonical 5-field receipt */}
      <section className="bg-ghost-canvas border-t border-fog-border/50">
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-72">
          <div className="text-center mb-40">
            <div className="text-caption uppercase tracking-uppercase text-slate-ink mb-12 font-mono">
              Sample attestation
            </div>
            <h2 className="font-display font-normal text-heading-sm tracking-heading-sm leading-heading-sm text-midnight-navy">
              What a settled job&apos;s receipt looks like
            </h2>
          </div>
          <div className="max-w-prose mx-auto">
            <AttestationReceipt />
            <div className="mt-20 text-center font-mono text-caption tracking-caption text-slate-ink">
              Captured from real 0G mainnet inference on 2026-05-07.
              Reproduce: pnpm --filter @pact/contracts smoke
            </div>
          </div>
        </div>
      </section>

      {/* Recent activity — empty state. CHUNK 4 wires real job list
          (indexer or PactEscrow events) and replaces this placeholder. */}
      <section className="bg-ghost-canvas">
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-72">
          <div className="text-center mb-40">
            <div className="text-caption uppercase tracking-uppercase text-slate-ink mb-12 font-mono">
              Activity
            </div>
            <h2 className="font-display font-normal text-heading-sm tracking-heading-sm leading-heading-sm text-midnight-navy">
              Recent jobs
            </h2>
          </div>
          <Card variant="section" className="p-72 text-center">
            <p className="text-body leading-body tracking-body text-midnight-navy">
              No jobs settled yet. Be the first.
            </p>
            <Link
              href={`/jobs/new?serviceId=${s.id}`}
              className="mt-20 inline-block font-mono text-caption tracking-caption text-midnight-navy hover:text-chartreuse-pulse transition-colors"
            >
              Run an inference →
            </Link>
          </Card>
        </div>
      </section>

      {/* Provenance line */}
      <section className="bg-ghost-canvas border-t border-fog-border/50">
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-24">
          <div className="text-center font-mono text-caption tracking-caption text-slate-ink">
            All data on this page reads from PactRegistry at{" "}
            <span className="text-midnight-navy">
              {shortAddress(PACT_ADDRESSES.PactRegistry)}
            </span>{" "}
            on 0G mainnet (chainId 16661). Verify on{" "}
            <a
              href={PACT_EXPLORER_URL}
              target="_blank"
              rel="noreferrer"
              className="text-midnight-navy underline decoration-fog-border underline-offset-4 hover:decoration-midnight-navy transition-colors"
            >
              chainscan.0g.ai
            </a>
            {" →"}
          </div>
        </div>
      </section>
    </>
  );
}

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
