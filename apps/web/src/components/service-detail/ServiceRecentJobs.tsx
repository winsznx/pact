"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { RecentJobsTable } from "@/components/seller/RecentJobsTable";
import type { SellerJob } from "@/lib/useSellerProfile";

const INDEXER_BASE = "https://api.trypact.xyz";

/**
 * Recent jobs scoped to one service, rendered via the same RecentJobsTable
 * the seller dashboard uses. Pulls from the public indexer at
 * api.trypact.xyz/v1/jobs and filters client-side by serviceId.
 *
 * Indexer returns bigints as decimal strings (JSON-safe), so this hydrates
 * them back to bigint before passing to RecentJobsTable.
 */
interface ServiceRecentJobsProps {
  serviceId: bigint;
}

interface IndexerJob {
  jobId: string;
  serviceId: string;
  buyer: `0x${string}`;
  seller: `0x${string}`;
  state: number;
  amount: string;
  protocolFee?: string;
  createdAt: string;
  settledAt?: string | null;
}

export function ServiceRecentJobs({ serviceId }: ServiceRecentJobsProps) {
  const [jobs, setJobs] = useState<SellerJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`${INDEXER_BASE}/v1/jobs?limit=50`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`indexer ${res.status}`);
        const body = (await res.json()) as { jobs: IndexerJob[] };
        if (cancelled) return;
        const sid = serviceId.toString();
        const filtered = body.jobs
          .filter((j) => j.serviceId === sid)
          .map<SellerJob>((j) => {
            const amount = BigInt(j.amount);
            const fee = j.protocolFee ? BigInt(j.protocolFee) : 0n;
            return {
              jobId: BigInt(j.jobId),
              serviceId: BigInt(j.serviceId),
              buyer: j.buyer,
              state: j.state,
              amountWei: amount,
              paidToSellerWei: j.state === 3 ? amount - fee : 0n,
              createdAt: Number(j.createdAt),
              ...(j.settledAt
                ? { settledAt: Number(j.settledAt) }
                : {}),
            };
          });
        setJobs(filtered);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "fetch failed");
        }
      }
    }
    void load();
    const id = window.setInterval(load, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [serviceId]);

  if (error) {
    return (
      <Card variant="section" className="px-32 py-32 text-center">
        <p className="text-body leading-body tracking-body text-midnight-navy">
          Couldn&apos;t reach the indexer ({error}). Browse jobs directly on{" "}
          <a
            href="https://chainscan.0g.ai/address/0xB2b762Df53294923d3eaD00d8118AD37388dD4aA"
            target="_blank"
            rel="noreferrer"
            className="text-midnight-navy underline decoration-fog-border underline-offset-4 hover:decoration-midnight-navy"
          >
            PactEscrow on chainscan
          </a>
          .
        </p>
      </Card>
    );
  }

  if (jobs === null) {
    return (
      <Card variant="section" className="px-32 py-32 text-center">
        <p className="font-mono text-caption tracking-caption text-slate-ink">
          Loading recent jobs from api.trypact.xyz…
        </p>
      </Card>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card variant="section" className="px-32 py-56 text-center">
        <p className="text-body leading-body tracking-body text-midnight-navy">
          No jobs settled yet on this service. Be the first.
        </p>
        <Link
          href={`/jobs/new?serviceId=${serviceId.toString()}`}
          className="mt-20 inline-block font-mono text-caption tracking-caption text-midnight-navy hover:text-chartreuse-pulse transition-colors"
        >
          Run an inference →
        </Link>
      </Card>
    );
  }

  return <RecentJobsTable jobs={jobs} firstServiceId={serviceId} />;
}
