"use client";

import Link from "next/link";
import { formatEther } from "viem";

import { Card } from "@/components/ui/Card";
import { Hash } from "@/components/ui/Hash";
import { BondManager } from "./BondManager";
import { formatReputationIndex, REPUTATION_TOOLTIP } from "@/lib/reputation";
import type {
  BondState,
  InftState,
  SellerJob,
  SellerService,
} from "@/lib/useSellerProfile";

/**
 * Per-service card on the seller dashboard. Shows service id + status
 * pill, bond row, INFT row, recent-jobs row, earnings row, and inline
 * BondManager. Distinct from `components/landing/ServiceCard` (which is
 * the BUYER view used on landing/marketplace).
 *
 * All sizing/spacing/color resolves to design tokens.
 */
interface SellerServiceCardProps {
  service: SellerService;
  bond: BondState | undefined;
  inft: InftState | undefined;
  jobs: SellerJob[];
  onRefetch: () => void;
}

export function SellerServiceCard({
  service,
  bond,
  inft,
  jobs,
  onRefetch,
}: SellerServiceCardProps) {
  const earningsWei = jobs
    .filter((j) => j.serviceId === service.id)
    .reduce((acc, j) => acc + j.paidToSellerWei, 0n);
  const settledCount = jobs.filter(
    (j) => j.serviceId === service.id && j.state === 3,
  ).length;
  const totalForService = jobs.filter((j) => j.serviceId === service.id).length;

  return (
    <Card variant="elevated" className="p-32">
      <div className="flex items-start justify-between gap-16">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-8 text-caption text-slate-ink">
            <span className="font-mono">service #{service.id.toString()}</span>
            <StatusPill bond={bond} active={service.active} />
          </div>
          <div className="mt-8 text-heading-sm tracking-heading-sm leading-heading-sm font-medium text-midnight-navy">
            {service.modelId}
          </div>
        </div>
        <Link
          href={`/marketplace/${service.id.toString()}`}
          className="shrink-0 font-mono text-caption tracking-caption text-midnight-navy hover:text-chartreuse-pulse transition-colors"
        >
          View on marketplace →
        </Link>
      </div>

      <div className="mt-20 grid grid-cols-[auto_1fr] gap-x-24 gap-y-8 text-caption">
        <div className="text-slate-ink">price per call</div>
        <div className="text-right font-mono text-midnight-navy">
          {formatEther(service.pricePerCallWei)} $0G
        </div>
        <div className="text-slate-ink">signing address</div>
        <div className="text-right">
          <Hash value={service.signingAddress} kind="address" />
        </div>
        <div className="text-slate-ink">INFT</div>
        <div className="text-right font-mono text-midnight-navy">
          #{inft?.tokenId.toString() ?? "—"} · reputation{" "}
          <span
            className="text-chartreuse-pulse cursor-help"
            title={REPUTATION_TOOLTIP}
          >
            {formatReputationIndex(inft?.weightedScore)}
          </span>
        </div>
        <div className="text-slate-ink">jobs</div>
        <div className="text-right font-mono text-midnight-navy">
          {settledCount} settled / {totalForService} total
        </div>
        <div className="text-slate-ink">earned</div>
        <div className="text-right font-mono text-midnight-navy">
          {formatEther(earningsWei)} $0G
        </div>
      </div>

      {bond ? (
        <BondManager
          serviceId={service.id}
          bond={bond}
          onRefetch={onRefetch}
        />
      ) : null}
    </Card>
  );
}

function StatusPill({
  bond,
  active,
}: {
  bond: BondState | undefined;
  active: boolean;
}) {
  if (!active) {
    return (
      <span className="inline-flex items-center px-12 py-4 rounded-badges bg-pure-surface text-midnight-navy border border-midnight-navy font-mono text-caption tracking-uppercase uppercase font-medium">
        Suspended
      </span>
    );
  }
  if (!bond || bond.status === "withdrawn") {
    return (
      <span className="inline-flex items-center px-12 py-4 rounded-badges bg-pure-surface text-midnight-navy border border-fog-border font-mono text-caption tracking-uppercase uppercase">
        Unbonded
      </span>
    );
  }
  if (bond.status === "withdrawal_pending") {
    return (
      <span className="inline-flex items-center px-12 py-4 rounded-badges bg-pure-surface text-midnight-navy border border-fog-border font-mono text-caption tracking-uppercase uppercase">
        Bond cooldown
      </span>
    );
  }
  if (bond.status === "withdrawable") {
    return (
      <span className="inline-flex items-center px-12 py-4 rounded-badges bg-pure-surface text-midnight-navy border border-fog-border font-mono text-caption tracking-uppercase uppercase">
        Bond unlocked
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-12 py-4 rounded-badges bg-chartreuse-pulse text-midnight-navy font-mono text-caption tracking-uppercase uppercase font-medium">
      Active
    </span>
  );
}

