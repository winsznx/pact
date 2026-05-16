"use client";

import Link from "next/link";
import { formatEther } from "viem";

import { Card } from "@/components/ui/Card";

/**
 * Shown only when state === Settled. Splits the escrow into the
 * seller payout and the protocol fee, plus a one-line note about
 * the reputation increment landing on the seller's INFT.
 *
 * All sizing/spacing/color resolves to design tokens.
 */
interface SettlementSectionProps {
  serviceId: bigint;
  amountWei: bigint;
  protocolFeeWei: bigint;
}

export function SettlementSection({
  serviceId,
  amountWei,
  protocolFeeWei,
}: SettlementSectionProps) {
  const sellerPayoutWei = amountWei - protocolFeeWei;
  return (
    <section className="bg-ghost-canvas border-t border-fog-border/50">
      <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-72">
        <div className="text-center mb-40">
          <div className="text-caption uppercase tracking-uppercase text-slate-ink mb-12 font-mono">
            Settlement
          </div>
          <h2 className="font-display font-normal text-heading-sm tracking-heading-sm leading-heading-sm text-midnight-navy">
            Funds split, reputation incremented
          </h2>
        </div>
        <div className="grid gap-24 md:grid-cols-2 items-stretch">
          <Card variant="elevated" className="p-32">
            <div className="text-caption uppercase tracking-uppercase text-slate-ink font-mono">
              Amount to seller
            </div>
            <div className="mt-12 font-mono text-heading tracking-heading text-midnight-navy">
              {formatEther(sellerPayoutWei)} $0G
            </div>
            <div className="mt-8 font-mono text-caption tracking-caption text-slate-ink">
              95% of escrow
            </div>
          </Card>
          <Card variant="elevated" className="p-32">
            <div className="text-caption uppercase tracking-uppercase text-slate-ink font-mono">
              Protocol fee
            </div>
            <div className="mt-12 font-mono text-heading tracking-heading text-midnight-navy">
              {formatEther(protocolFeeWei)} $0G
            </div>
            <div className="mt-8 font-mono text-caption tracking-caption text-slate-ink">
              5% of escrow · routed to PACT treasury
            </div>
          </Card>
        </div>
        <div className="mt-32 text-center">
          <p className="text-body leading-body tracking-body text-storm-gray max-w-prose mx-auto">
            +1 settled job · weighted score incremented by sqrt(your total
            volume + this job).
          </p>
          <Link
            href={`/marketplace/${serviceId.toString()}`}
            className="mt-20 inline-block font-mono text-caption tracking-caption text-midnight-navy hover:text-chartreuse-pulse transition-colors"
          >
            View Service #{serviceId.toString()} reputation →
          </Link>
        </div>
      </div>
    </section>
  );
}
