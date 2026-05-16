import { Card } from "@/components/ui/Card";
import { Hash } from "@/components/ui/Hash";

/**
 * Full on-chain identity grid for a service. Same elevated-card surface
 * as ServiceCard (landing showcase), but extends the row set with
 * registration timestamp + INFT tokenId + INFT owner — fields the
 * marketplace browse doesn't need but the detail page does.
 *
 * Kept as a separate component (not a `showInftOwner` prop on
 * ServiceCard) because the row structure differs enough that mixing
 * them would force conditional layouts on every cell.
 *
 * All sizing/spacing/color resolves to design tokens.
 */
interface ServiceIdentityCardProps {
  signingAddress: `0x${string}`;
  ogProvider: `0x${string}`;
  registeredOn: string;
  inftTokenId: string;
  inftOwner: `0x${string}`;
}

export function ServiceIdentityCard({
  signingAddress,
  ogProvider,
  registeredOn,
  inftTokenId,
  inftOwner,
}: ServiceIdentityCardProps) {
  return (
    <Card variant="elevated" className="p-32">
      <div className="grid grid-cols-[auto_1fr] gap-x-24 gap-y-16 text-caption items-center">
        <div className="text-slate-ink">signing address</div>
        <div className="text-right">
          <Hash value={signingAddress} kind="address" />
        </div>

        <div className="text-slate-ink">0G provider</div>
        <div className="text-right">
          <Hash value={ogProvider} kind="address" />
        </div>

        <div className="text-slate-ink">target separated</div>
        <div className="text-right font-mono text-caption text-midnight-navy">
          true · TeeTLS
        </div>

        <div className="text-slate-ink">registered on</div>
        <div className="text-right font-mono text-caption text-midnight-navy">
          {registeredOn}
        </div>

        <div className="text-slate-ink">INFT tokenId</div>
        <div className="text-right font-mono text-caption text-midnight-navy">
          #{inftTokenId} · ERC-7857
        </div>

        <div className="text-slate-ink">INFT owner</div>
        <div className="text-right">
          <Hash value={inftOwner} kind="address" />
        </div>
      </div>
    </Card>
  );
}
