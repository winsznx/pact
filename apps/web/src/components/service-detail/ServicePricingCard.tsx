import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { StatNumber } from "@/components/ui/StatNumber";

/**
 * Right-rail pricing + CTA card on /marketplace/[serviceId].
 *
 * Layout: PER CALL caption → big serif price + $0G unit → protocol fee
 * footnote → full-width chartreuse "Run an inference" pill →
 * "Connect wallet first" hint → bond-status row.
 *
 * v0.1: the wallet check is a hint, not enforced. CHUNK 4 wires the
 * actual connected-wallet gate via wagmi useAccount().
 *
 * All sizing/spacing/color resolves to design tokens.
 */
interface ServicePricingCardProps {
  serviceId: number;
  pricePerCall: string;
  bondedAmount: string;
}

export function ServicePricingCard({
  serviceId,
  pricePerCall,
  bondedAmount,
}: ServicePricingCardProps) {
  return (
    <Card variant="elevated" className="p-32">
      <div className="text-caption uppercase tracking-uppercase text-slate-ink font-mono">
        Per call
      </div>
      <div className="mt-12 flex items-baseline gap-12">
        <StatNumber size="lg" className="block text-midnight-navy">
          {pricePerCall}
        </StatNumber>
        <span className="font-mono text-body tracking-body text-slate-ink">
          $0G
        </span>
      </div>
      <div className="mt-8 font-mono text-caption tracking-caption text-slate-ink">
        + 5% protocol fee
      </div>

      <Link href={`/jobs/new?serviceId=${serviceId}`} className="block mt-32">
        <button
          type="button"
          className="w-full inline-flex items-center justify-center h-56 px-32 rounded-buttons bg-chartreuse-pulse text-midnight-navy text-body tracking-body font-medium [box-shadow:var(--shadow-cta-pill)] hover:brightness-[1.02] transition-transform active:translate-y-[1px]"
        >
          Run an inference →
        </button>
      </Link>

      <div className="mt-12 text-center font-mono text-caption tracking-caption text-slate-ink">
        Connect wallet first
      </div>

      <div className="mt-32 pt-20 border-t border-fog-border/50 flex items-center justify-between font-mono text-caption tracking-caption">
        <span className="text-slate-ink">Bonded</span>
        <span className="text-midnight-navy">
          {bondedAmount} $0G{" "}
          <span className="text-chartreuse-pulse">✓</span>
        </span>
      </div>
    </Card>
  );
}
