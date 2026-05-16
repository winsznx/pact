"use client";

import Link from "next/link";
import { formatEther } from "viem";

import { Card } from "@/components/ui/Card";
import { Hash } from "@/components/ui/Hash";
import { JobStateLabel, type JobStateValue } from "@/lib/wagmi";

/**
 * Left column of /jobs/[jobId] — static facts about the job pulled from
 * PactEscrow.getJob(). Layout mirrors ServiceIdentityCard so the two
 * pages feel like siblings.
 *
 * All sizing/spacing/color resolves to design tokens.
 */
interface JobDetailsCardProps {
  jobId: bigint;
  serviceId: bigint;
  buyer: `0x${string}`;
  amountWei: bigint;
  inputCommitment: `0x${string}`;
  createdAt: bigint;
  state: JobStateValue;
}

export function JobDetailsCard({
  jobId,
  serviceId,
  buyer,
  amountWei,
  inputCommitment,
  createdAt,
  state,
}: JobDetailsCardProps) {
  const createdIso = new Date(Number(createdAt) * 1000).toISOString();

  return (
    <Card variant="elevated" className="p-32">
      <div className="grid grid-cols-[auto_1fr] gap-x-24 gap-y-16 text-caption items-center">
        <div className="text-slate-ink">job id</div>
        <div className="text-right font-mono text-caption text-midnight-navy">
          #{jobId.toString()}
        </div>

        <div className="text-slate-ink">service</div>
        <div className="text-right">
          <Link
            href={`/marketplace/${serviceId.toString()}`}
            className="font-mono text-caption text-midnight-navy hover:text-chartreuse-pulse transition-colors"
          >
            #{serviceId.toString()} →
          </Link>
        </div>

        <div className="text-slate-ink">buyer</div>
        <div className="text-right">
          <Hash value={buyer} kind="address" />
        </div>

        <div className="text-slate-ink">amount escrowed</div>
        <div className="text-right font-mono text-caption text-midnight-navy">
          {formatEther(amountWei)} $0G
        </div>

        <div className="text-slate-ink">input commitment</div>
        <div className="text-right">
          <Hash value={inputCommitment} kind="tx" head={8} tail={6} />
        </div>

        <div className="text-slate-ink">created</div>
        <div className="text-right font-mono text-caption text-midnight-navy">
          {createdIso}
        </div>

        <div className="text-slate-ink">state</div>
        <div className="text-right font-mono text-caption text-midnight-navy">
          {JobStateLabel[state]}
        </div>
      </div>
    </Card>
  );
}
