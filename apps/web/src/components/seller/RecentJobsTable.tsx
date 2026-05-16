"use client";

import Link from "next/link";
import { formatEther } from "viem";

import { Card } from "@/components/ui/Card";
import { JobStateLabel, type JobStateValue } from "@/lib/wagmi";
import type { SellerJob } from "@/lib/useSellerProfile";

/**
 * 10 most recent jobs across all services, newest first. Token-compliant
 * table (no <table>, just CSS grid rows) for hover and link affordance.
 *
 * All sizing/spacing/color resolves to design tokens.
 */
export function RecentJobsTable({
  jobs,
  firstServiceId,
}: {
  jobs: SellerJob[];
  firstServiceId: bigint | undefined;
}) {
  if (jobs.length === 0) {
    return (
      <Card variant="section" className="px-32 py-56 text-center">
        <p className="text-body leading-body tracking-body text-midnight-navy">
          No jobs serviced yet. Your service is listed at{" "}
          <Link
            href={`/marketplace/${(firstServiceId ?? 1n).toString()}`}
            className="font-mono text-midnight-navy underline decoration-fog-border underline-offset-4 hover:decoration-midnight-navy"
          >
            /marketplace/{(firstServiceId ?? 1n).toString()}
          </Link>
          .
        </p>
      </Card>
    );
  }

  return (
    <Card variant="section" className="overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <Header />
          <div role="list">
            {jobs.map((j) => (
              <Row key={j.jobId.toString()} job={j} />
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function Header() {
  return (
    <div className="grid grid-cols-[auto_auto_1fr_auto_auto_auto_auto] gap-x-16 px-16 py-12 border-b border-fog-border/50 font-mono text-caption tracking-uppercase uppercase text-slate-ink">
      <span>Job</span>
      <span>Service</span>
      <span>Buyer</span>
      <span>State</span>
      <span className="text-right">Amount</span>
      <span className="text-right">Paid</span>
      <span className="text-right">Date</span>
    </div>
  );
}

function Row({ job }: { job: SellerJob }) {
  return (
    <Link
      href={`/jobs/${job.jobId.toString()}`}
      className="grid grid-cols-[auto_auto_1fr_auto_auto_auto_auto] gap-x-16 items-center px-16 py-16 border-b border-fog-border/50 hover:bg-pure-surface transition-colors text-caption text-midnight-navy"
    >
      <span className="font-mono">#{job.jobId.toString()}</span>
      <span className="font-mono">#{job.serviceId.toString()}</span>
      <span className="font-mono text-slate-ink">
        {short(job.buyer)}
      </span>
      <span>
        <StatePill state={job.state as JobStateValue} />
      </span>
      <span className="font-mono text-right">
        {formatEther(job.amountWei)} $0G
      </span>
      <span className="font-mono text-right">
        {job.paidToSellerWei > 0n
          ? `${formatEther(job.paidToSellerWei)} $0G`
          : "—"}
      </span>
      <span className="font-mono text-slate-ink text-right">
        {fmtDate(job.createdAt)}
      </span>
    </Link>
  );
}

function StatePill({ state }: { state: JobStateValue }) {
  const label = JobStateLabel[state] ?? "—";
  const isSettled = state === 3;
  return (
    <span
      className={
        "inline-flex items-center px-8 py-4 rounded-badges font-mono text-caption tracking-uppercase uppercase " +
        (isSettled
          ? "bg-chartreuse-pulse text-midnight-navy font-medium"
          : "bg-pure-surface text-slate-ink border border-fog-border")
      }
    >
      {label}
    </span>
  );
}

function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmtDate(unix: number): string {
  if (!unix) return "—";
  const d = new Date(unix * 1000);
  return d.toISOString().slice(0, 10);
}
