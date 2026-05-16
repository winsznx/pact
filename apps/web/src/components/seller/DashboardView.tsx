"use client";

import Link from "next/link";
import { formatEther } from "viem";

import { Hash } from "@/components/ui/Hash";
import { StatNumber } from "@/components/ui/StatNumber";
import { SellerServiceCard } from "./SellerServiceCard";
import { RecentJobsTable } from "./RecentJobsTable";
import type { SellerProfile } from "@/lib/useSellerProfile";
import { formatReputationIndex, REPUTATION_TOOLTIP } from "@/lib/reputation";
import { PACT_EXPLORER_URL } from "@pact/shared";

/**
 * Seller dashboard. Sits above the OnboardingFlow once a seller has at
 * least one registered service. Four panels:
 *   1. Hero (kicker + heading + chainscan link)
 *   2. Aggregate 4-stat row
 *   3. "Your services" grid with bond manager inline
 *   4. Recent jobs across all services
 *
 * All sizing/spacing/color resolves to design tokens.
 */
interface DashboardViewProps {
  address: `0x${string}`;
  profile: SellerProfile;
  onRefetch: () => void;
}

export function DashboardView({
  address,
  profile,
  onRefetch,
}: DashboardViewProps) {
  const truncated = `${address.slice(0, 6)}…${address.slice(-4)}`;
  const serviceCount = profile.services.length;
  const earnings = formatEther(profile.totalEarningsWei);
  const bonded = formatEther(profile.totalBondedWei);
  const reputationLabel = formatReputationIndex(profile.totalReputation);
  const firstServiceId = profile.services[0]?.id;

  return (
    <>
      {/* Hero */}
      <section className="bg-ghost-canvas">
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 pt-72 pb-40">
          <div className="text-caption uppercase tracking-uppercase text-slate-ink mb-12 font-mono">
            Seller dashboard · {truncated}
          </div>
          <h1 className="font-display font-normal text-heading-lg tracking-heading-lg leading-heading-lg text-midnight-navy">
            {serviceCount} {serviceCount === 1 ? "service" : "services"} ·{" "}
            {earnings} $0G earned
          </h1>
          <div className="mt-20 font-mono text-caption tracking-caption text-slate-ink">
            <Hash value={address} kind="address" head={10} tail={8} />{" "}
            <a
              href={`${PACT_EXPLORER_URL}/address/${address}`}
              target="_blank"
              rel="noreferrer"
              className="text-midnight-navy hover:text-chartreuse-pulse transition-colors"
            >
              view wallet on chainscan ↗
            </a>
          </div>
        </div>
      </section>

      {/* Aggregate stats */}
      <section className="bg-ghost-canvas border-t border-fog-border/50 border-b">
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-40">
          <div className="grid grid-cols-2 gap-32 lg:grid-cols-4">
            <Stat
              value={serviceCount.toString()}
              label="Total services"
            />
            <Stat value={earnings} label="Total $0G earned" mono />
            <Stat value={bonded} label="Total bonded" mono />
            <Stat
              value={reputationLabel}
              label="Reputation index"
              mono
              tooltip={REPUTATION_TOOLTIP}
            />
          </div>
        </div>
      </section>

      {/* Your services */}
      <section className="bg-ghost-canvas">
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-40">
          <div className="flex items-center justify-between gap-12 mb-20">
            <h2 className="text-heading-sm tracking-heading-sm leading-heading-sm font-medium text-midnight-navy">
              Your services
            </h2>
            <Link
              href="/seller?action=register"
              className="font-mono text-caption tracking-caption text-midnight-navy hover:text-chartreuse-pulse transition-colors"
            >
              + Register another service
            </Link>
          </div>
          <div className="grid gap-24 md:grid-cols-1 lg:grid-cols-2 items-start">
            {profile.services.map((svc) => (
              <SellerServiceCard
                key={svc.id.toString()}
                service={svc}
                bond={profile.bonds.get(svc.id.toString())}
                inft={profile.infts.get(svc.id.toString())}
                jobs={profile.recentJobs}
                onRefetch={onRefetch}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Recent jobs */}
      <section className="bg-ghost-canvas">
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-40 pb-72">
          <h2 className="mb-20 text-heading-sm tracking-heading-sm leading-heading-sm font-medium text-midnight-navy">
            Recent jobs
          </h2>
          <RecentJobsTable
            jobs={profile.recentJobs}
            firstServiceId={firstServiceId}
          />
        </div>
      </section>
    </>
  );
}

function Stat({
  value,
  label,
  mono,
  tooltip,
}: {
  value: string;
  label: string;
  mono?: boolean;
  tooltip?: string;
}) {
  return (
    <div className="text-center">
      <StatNumber
        size="md"
        className={mono ? "block text-midnight-navy font-mono" : "block text-midnight-navy"}
      >
        {value}
      </StatNumber>
      <div
        title={tooltip}
        className={
          "mt-12 font-mono text-caption tracking-uppercase uppercase text-slate-ink" +
          (tooltip ? " cursor-help" : "")
        }
      >
        {label}
      </div>
    </div>
  );
}
