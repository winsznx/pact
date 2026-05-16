import Link from "next/link";
import { Card } from "@/components/ui/Card";

/**
 * "Become a seller" CTA card. Sits in the marketplace grid alongside
 * service cards as the second tile, occupying a slot a future Service 2
 * would otherwise fill.
 *
 * Same elevated shadow stack as the real ServiceCard so the cards visually
 * "belong" together. Dashed look is approximated via fog-border at half
 * opacity inside the elevated card — keeps the elevation, signals "empty
 * slot" / "you could be here".
 *
 * All sizing/spacing/color resolves to design tokens.
 */
export function SellerCTACard() {
  return (
    <Link href="/seller" className="block">
      <Card
        variant="elevated"
        className="p-20 h-full border border-fog-border/50 border-dashed cursor-pointer transition-transform hover:scale-[1.01]"
      >
        <div className="flex flex-col items-center text-center h-full justify-center py-32">
          <span className="font-display text-display leading-display tracking-display text-chartreuse-pulse">
            +
          </span>
          <h3 className="mt-16 text-heading-sm tracking-heading-sm leading-heading-sm font-medium text-midnight-navy">
            Become a seller
          </h3>
          <p className="mt-8 text-body leading-body tracking-body text-storm-gray max-w-prose">
            Mint your Agent INFT, list your AI service, start serving
            verifiable inferences.
          </p>
          <span className="mt-20 font-mono text-caption tracking-caption text-chartreuse-pulse">
            View seller docs →
          </span>
        </div>
      </Card>
    </Link>
  );
}
