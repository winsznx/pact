"use client";

import { formatEther } from "viem";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Hash } from "@/components/ui/Hash";
import { useReputation, useService } from "@/lib/wagmi";

/**
 * Live preview of Service 1. Reads from PactRegistry on 0G mainnet
 * (signing address, provider, price, model) and ReputationVault
 * (settled jobs, lifetime volume). Title is the only field that stays
 * in code because the contract doesn't store human-readable names.
 */
const SERVICE_ID = 1n;
const SERVICE_TITLE = "Code review · Solidity audit";

interface ServiceCardProps {
  /**
   * "detailed" (default): full attestation / provider breakdown grid.
   *   Used by the landing-page showcase row.
   * "compact": title + price block only, then a single footer line with
   *   reputation summary. Used in the marketplace grid.
   */
  variant?: "detailed" | "compact";
}

export function ServiceCard({ variant = "detailed" }: ServiceCardProps = {}) {
  const { data: service } = useService(SERVICE_ID);
  const { data: reputation } = useReputation(SERVICE_ID);

  const price = service ? formatEther(service.pricePerCall) : "0.001";
  const signer = service?.signingAddress ??
    "0x0000000000000000000000000000000000000000";
  const provider = service?.providerAddress ??
    "0x0000000000000000000000000000000000000000";
  const targetSeparated = service?.targetSeparated ?? true;
  const modelId = service?.modelId ?? "zai-org/GLM-5-FP8";

  const settledJobs = reputation ? Number(reputation.totalJobs) : 0;
  const lifetime = reputation
    ? Number(formatEther(reputation.totalVolume)).toFixed(3)
    : "0.000";

  return (
    <Card variant="elevated" className="p-20">
      <div className="flex items-start justify-between gap-12">
        <div>
          <div className="flex items-center gap-8 text-caption text-slate-ink">
            <span className="font-mono">service #1</span>
            <Badge variant="live" className="text-caption px-8 py-4 leading-caption">
              live · 0G mainnet
            </Badge>
          </div>
          <div className="mt-8 text-heading-sm tracking-heading-sm font-medium text-midnight-navy">
            {SERVICE_TITLE}
          </div>
          <div className="text-sm text-slate-ink mt-4">
            {modelId} · TEE-attested via 0G Compute
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-caption uppercase tracking-uppercase text-slate-ink">
            per call
          </div>
          <div className="font-display text-heading leading-heading mt-4 text-midnight-navy">
            {price}
          </div>
          <div className="text-caption text-slate-ink font-mono">$0G</div>
        </div>
      </div>

      {variant === "detailed" ? (
        <div className="mt-16 grid grid-cols-[auto_1fr] gap-x-16 gap-y-8 text-caption items-center">
          <div className="text-slate-ink">signing address</div>
          <div className="text-right">
            <Hash value={signer} kind="address" />
          </div>
          <div className="text-slate-ink">0G provider</div>
          <div className="text-right">
            <Hash value={provider} kind="address" />
          </div>
          <div className="text-slate-ink">target separated</div>
          <div className="text-right font-mono text-caption text-midnight-navy">
            {targetSeparated ? "true · TeeTLS" : "false"}
          </div>
          <div className="text-slate-ink">jobs settled</div>
          <div className="text-right font-mono text-caption text-midnight-navy">
            {settledJobs}
          </div>
        </div>
      ) : (
        <div className="mt-16 flex items-center justify-between font-mono text-caption tracking-caption text-slate-ink">
          <span>
            {settledJobs} {settledJobs === 1 ? "job" : "jobs"} settled · {lifetime}{" "}
            $0G volume
          </span>
          <span className="text-chartreuse-pulse inline-flex items-center gap-4 transition-transform duration-300 group-hover:translate-x-1">
            View <span aria-hidden>↗</span>
          </span>
        </div>
      )}
    </Card>
  );
}
