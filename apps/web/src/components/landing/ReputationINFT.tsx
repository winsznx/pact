"use client";

import { formatEther } from "viem";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatNumber } from "@/components/ui/StatNumber";
import { Hash } from "@/components/ui/Hash";
import { useReputation, useService } from "@/lib/wagmi";
import { formatReputationIndex } from "@/lib/reputation";

/**
 * Reputation-as-INFT preview. Reads Service 1 live from
 * PactRegistry + ReputationVault on 0G mainnet. The moat narrative is
 * the *transferability*: sell the INFT, sell the reputation. That's what
 * the bottom-row callout communicates.
 */
const SERVICE_ID = 1n;

export function ReputationINFT() {
  const { data: service } = useService(SERVICE_ID);
  const { data: reputation } = useReputation(SERVICE_ID);

  const owner = service?.seller ?? "0x0000000000000000000000000000000000000000";
  const tokenId = service ? service.inftTokenId.toString() : "—";
  const settledJobs = reputation ? Number(reputation.totalJobs).toString() : "0";
  const lifetime = reputation
    ? Number(formatEther(reputation.totalVolume)).toFixed(3)
    : "0.000";
  const score = reputation
    ? formatReputationIndex(reputation.weightedScore)
    : "—";

  return (
    <Card variant="elevated" className="p-20">
      <div className="flex items-start justify-between gap-12">
        <div>
          <div className="flex items-center gap-8 text-caption text-slate-ink">
            <span className="font-mono">INFT #{tokenId}</span>
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
            <Hash value={owner} kind="address" />
          </div>
        </div>
      </div>

      <div className="mt-20 grid grid-cols-3 gap-12 text-center">
        <Stat label="settled jobs" value={settledJobs} />
        <Stat label="lifetime $0G" value={lifetime} />
        <Stat label="weighted score" value={score} />
      </div>

      <div className="mt-20 text-caption text-slate-ink leading-caption tracking-caption">
        Try to fake this, you can&apos;t. Try to transfer it, you can. Sell
        the agent, sell its reputation. INFTs become economic instruments.
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
