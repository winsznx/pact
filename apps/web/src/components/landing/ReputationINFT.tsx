import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatNumber } from "@/components/ui/StatNumber";
import { Hash } from "@/components/ui/Hash";

/**
 * Reputation-as-INFT preview. The numbers below are illustrative for CHUNK 1
 * (no chain reads yet) — they map to ReputationVault.getReputation(serviceId)
 * once the live read path lands. The moat narrative is the *transferability*:
 * sell the INFT, sell the reputation. That's what the bottom-row callout
 * communicates.
 */
const SELLER_ADDR = "0xbF7EF900E2dB365455B91Fb133f78Fc70114Bf31" as const;

export function ReputationINFT() {
  return (
    <Card variant="elevated" className="p-20">
      <div className="flex items-start justify-between gap-12">
        <div>
          <div className="flex items-center gap-8 text-caption text-slate-ink">
            <span className="font-mono">INFT #0</span>
            <Badge variant="neutral" className="text-caption px-8 py-4 leading-caption">
              ERC-7857 · transferable
            </Badge>
          </div>
          <div className="mt-8 text-heading-sm tracking-heading-sm font-medium text-midnight-navy">
            Reputation accrues to the token
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-caption uppercase tracking-uppercase text-slate-ink">
            owner
          </div>
          <div className="mt-4">
            <Hash value={SELLER_ADDR} kind="address" />
          </div>
        </div>
      </div>

      <div className="mt-20 grid grid-cols-3 gap-12 text-center">
        <Stat label="settled jobs" value="0" />
        <Stat label="lifetime $0G" value="0.000" />
        <Stat label="weighted score" value="—" />
      </div>

      <div className="mt-20 text-caption text-slate-ink leading-caption tracking-caption">
        Try to fake this — you can't. Try to transfer it — you can.
        Sell the agent, sell its reputation. INFTs become economic instruments.
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-cardsmedium bg-ghost-canvas px-12 py-12">
      <StatNumber size="md" className="block text-midnight-navy">
        {value}
      </StatNumber>
      <div className="mt-4 text-caption uppercase tracking-uppercase text-slate-ink">
        {label}
      </div>
    </div>
  );
}
