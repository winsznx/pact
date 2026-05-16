// CHUNK 2 — v0.1 hardcodes Service 1 from packages/shared.
//   CHUNK 4 swaps to wagmi useReadContract calls against
//   PactRegistry.totalServices() + getService(i).

import Link from "next/link";
import { ServiceCard } from "@/components/landing/ServiceCard";
import { FilterRow } from "@/components/marketplace/FilterRow";
import { SellerCTACard } from "@/components/marketplace/SellerCTACard";
import { SellerCallout } from "@/components/marketplace/SellerCallout";

/**
 * /marketplace — service browse page. Light canvas throughout (the dark
 * band is the landing hero only, per DESIGN.md "do not add additional
 * dark bands"). Three regions: page header → filter strip → service
 * grid → seller callout.
 *
 * v0.1: only Service 1 exists. Filter pills are inert (CHUNK 2.5 wires
 * real filtering once 2+ services register). The "Become a seller" tile
 * sits in the second grid slot to keep the row visually balanced.
 *
 * All sizing/spacing/color resolves to design tokens.
 */
export default function MarketplacePage() {
  return (
    <>
      {/* Page header */}
      <section className="bg-ghost-canvas">
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 pt-120 pb-72 text-center">
          <div className="text-caption uppercase tracking-uppercase text-slate-ink mb-16 font-mono">
            Marketplace · 0G mainnet
          </div>
          <h1 className="font-display font-normal text-display leading-display tracking-display text-midnight-navy text-balance">
            Verifiable AI services
          </h1>
          <p className="mt-24 text-lead leading-lead tracking-lead text-storm-gray max-w-prose mx-auto">
            Every service registered in PactRegistry. Every attestation
            verified on-chain. Browse below.
          </p>
        </div>
      </section>

      <FilterRow />

      {/* Service grid */}
      <section className="bg-ghost-canvas">
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-72">
          <div className="grid gap-24 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 items-stretch">
            <Link
              href="/marketplace/1"
              className="group block cursor-pointer transition-all duration-300 hover:scale-[1.015] hover:[box-shadow:var(--shadow-cta-pill)]"
            >
              <ServiceCard variant="compact" />
            </Link>
            <SellerCTACard />
          </div>
        </div>
      </section>

      <SellerCallout />
    </>
  );
}
