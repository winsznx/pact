"use client";

import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatEther } from "viem";
import { PACT_ADDRESSES, PACT_EXPLORER_URL } from "@pact/shared";

import { Card } from "@/components/ui/Card";
import { AttestationReceipt } from "@/components/landing/AttestationReceipt";
import { Breadcrumb } from "@/components/service-detail/Breadcrumb";
import { ServicePricingCard } from "@/components/service-detail/ServicePricingCard";
import { ServiceIdentityCard } from "@/components/service-detail/ServiceIdentityCard";
import { ServiceStatsStrip } from "@/components/service-detail/ServiceStatsStrip";
import { ServiceRecentJobs } from "@/components/service-detail/ServiceRecentJobs";
import { useService, useReputation, useBond } from "@/lib/wagmi";
import { formatReputationIndex } from "@/lib/reputation";

/**
 * Service detail page. Every visible value reads from PACT contracts on
 * 0G mainnet. No hardcoded stubs, no mock data.
 *
 * Reads:
 *   - PactRegistry.getService(serviceId)        → seller, model, signing address,
 *                                                 provider, price, registeredAt
 *   - ReputationVault.getReputation(serviceId)  → totalJobs, totalVolume,
 *                                                 weightedScore, lastJobAt
 *   - SlashingArbiter.getBond(serviceId)        → bonded wei
 *
 * Human-readable title stays in code since the contract doesn't store one.
 * Everything else (model, provider, signing address, prices, dates, stats)
 * is on chain.
 */

const SERVICE_TITLES: Record<string, string> = {
  "1": "Code review · Solidity audit",
};

export default function ServiceDetailPage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const { serviceId: serviceIdRaw } = use(params);
  if (!/^\d+$/.test(serviceIdRaw)) notFound();
  const serviceId = BigInt(serviceIdRaw);

  const { data: service, isLoading: serviceLoading } = useService(serviceId);
  const { data: reputation } = useReputation(serviceId);
  const { data: bond } = useBond(serviceId);

  if (serviceLoading && !service) {
    return (
      <section className="bg-ghost-canvas">
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-72 text-center">
          <p className="font-mono text-caption tracking-caption text-slate-ink">
            Loading service #{serviceIdRaw} from 0G mainnet…
          </p>
        </div>
      </section>
    );
  }

  if (
    !service ||
    service.seller === "0x0000000000000000000000000000000000000000"
  ) {
    notFound();
  }

  const title = SERVICE_TITLES[serviceIdRaw] ?? `Service #${serviceIdRaw}`;
  const pricePerCall = formatEther(service.pricePerCall);
  const bondedFormatted = bond !== undefined ? formatEther(bond[0]) : "—";
  const registeredOnISO = new Date(
    Number(service.registeredAt) * 1000,
  ).toISOString();
  const registeredOnDay = registeredOnISO.slice(0, 10);

  const settledJobs = reputation ? Number(reputation.totalJobs) : 0;
  const lifetimeEarned = reputation
    ? formatEther(reputation.totalVolume)
    : "0";
  const weightedScore = reputation
    ? formatReputationIndex(reputation.weightedScore)
    : "—";
  const daysLive = Math.max(
    0,
    Math.floor(
      (Date.now() / 1000 - Number(service.registeredAt)) / 86400,
    ),
  );

  return (
    <>
      <Breadcrumb current={`Service #${serviceIdRaw}: ${title}`} />

      {/* Page header */}
      <section className="bg-ghost-canvas">
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-72">
          <div className="grid gap-32 lg:grid-cols-[3fr_2fr] lg:items-start">
            <div>
              <div className="text-caption uppercase tracking-uppercase text-slate-ink font-mono">
                service · {serviceIdRaw} · live · 0G mainnet
              </div>
              <h1 className="mt-16 font-display font-normal text-display leading-display tracking-display text-midnight-navy text-balance">
                {title}
              </h1>
              <div className="mt-20 font-mono text-caption tracking-caption text-slate-ink">
                {service.modelId} · {service.providerType} via{" "}
                {service.providerIdentity}
                {service.targetSeparated ? " · TeeTLS (target separated)" : ""}
              </div>
            </div>

            <ServicePricingCard
              serviceId={Number(serviceId)}
              pricePerCall={pricePerCall}
              bondedAmount={bondedFormatted}
            />
          </div>
        </div>
      </section>

      <ServiceStatsStrip
        stats={[
          { value: settledJobs.toString(), label: "Settled jobs" },
          {
            value: Number(lifetimeEarned).toFixed(3),
            label: "Lifetime $0G earned",
          },
          { value: weightedScore, label: "Weighted reputation score" },
          { value: daysLive.toString(), label: "Days live" },
        ]}
      />

      {/* Service registration / on-chain identity */}
      <section className="bg-ghost-canvas">
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-72">
          <div className="text-center mb-40">
            <div className="text-caption uppercase tracking-uppercase text-slate-ink mb-12 font-mono">
              Service registration
            </div>
            <h2 className="font-display font-normal text-heading-sm tracking-heading-sm leading-heading-sm text-midnight-navy">
              On-chain identity
            </h2>
          </div>
          <div className="grid gap-24 md:grid-cols-2 items-start">
            <ServiceIdentityCard
              signingAddress={service.signingAddress}
              ogProvider={service.providerAddress}
              registeredOn={registeredOnDay}
              inftTokenId={service.inftTokenId.toString()}
              inftOwner={service.seller}
            />
            <Card variant="section" className="p-32">
              <p className="text-body leading-body tracking-body text-storm-gray">
                Every field above reads from PactRegistry on 0G mainnet. The
                signing address recovers from the seller&apos;s TEE-attested
                ECDSA signature on every settled job. The 0G provider is the
                TEE node operator routing the inference. The INFT tokenId
                binds reputation to a transferable ERC-7857 token. Sell the
                agent, sell the reputation.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Sample attestation */}
      <section className="bg-ghost-canvas border-t border-fog-border/50">
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-72">
          <div className="text-center mb-40">
            <div className="text-caption uppercase tracking-uppercase text-slate-ink mb-12 font-mono">
              Sample attestation
            </div>
            <h2 className="font-display font-normal text-heading-sm tracking-heading-sm leading-heading-sm text-midnight-navy">
              What a settled job&apos;s receipt looks like
            </h2>
          </div>
          <div className="max-w-prose mx-auto">
            <AttestationReceipt />
            <div className="mt-20 text-center font-mono text-caption tracking-caption text-slate-ink">
              Real captured 0G Compute attestation. Recover the signer in your
              browser at{" "}
              <Link
                href="/verify/2?autoplay=1"
                className="text-midnight-navy underline decoration-fog-border underline-offset-4 hover:text-chartreuse-pulse hover:decoration-chartreuse-pulse transition-colors"
              >
                /verify/2
              </Link>
              .
            </div>
          </div>
        </div>
      </section>

      {/* Recent activity */}
      <section className="bg-ghost-canvas">
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-72">
          <div className="text-center mb-40">
            <div className="text-caption uppercase tracking-uppercase text-slate-ink mb-12 font-mono">
              Activity
            </div>
            <h2 className="font-display font-normal text-heading-sm tracking-heading-sm leading-heading-sm text-midnight-navy">
              Recent jobs
            </h2>
          </div>
          <ServiceRecentJobs serviceId={serviceId} />
          <div className="mt-16 text-center font-mono text-caption tracking-caption text-slate-ink">
            Reading from{" "}
            <a
              href="https://api.trypact.xyz/v1/jobs"
              target="_blank"
              rel="noreferrer"
              className="text-midnight-navy hover:text-chartreuse-pulse transition-colors"
            >
              api.trypact.xyz/v1/jobs
            </a>
            . Refreshes every 10s.
          </div>
        </div>
      </section>

      {/* Integrate snippet */}
      <section className="bg-ghost-canvas border-t border-fog-border/50">
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-72">
          <div className="text-center mb-40">
            <div className="text-caption uppercase tracking-uppercase text-slate-ink mb-12 font-mono">
              For developers
            </div>
            <h2 className="font-display font-normal text-heading-sm tracking-heading-sm leading-heading-sm text-midnight-navy">
              Integrate this service in 25 lines
            </h2>
            <p className="mt-12 text-body leading-body tracking-body text-storm-gray max-w-prose mx-auto">
              Buyer SDK via npm. Typed TypeScript, viem as the only peer
              dependency. ~50&nbsp;KB ESM bundle. Local ECDSA verify with no
              RPC.
            </p>
          </div>
          <Card variant="elevated" className="p-0 overflow-hidden">
            <div className="bg-midnight-navy text-frost-white font-mono text-caption leading-subheading tracking-caption p-24 overflow-x-auto">
              <pre className="whitespace-pre">
                <code>{integrateSnippet(Number(serviceId))}</code>
              </pre>
            </div>
          </Card>
          <div className="mt-20 text-center font-mono text-caption tracking-caption text-slate-ink">
            <code className="bg-data-chip text-midnight-navy px-12 py-4 rounded-cardssmall">
              pnpm add @trypact/sdk viem
            </code>
            {" · "}
            <a
              href="https://www.npmjs.com/package/@trypact/sdk"
              target="_blank"
              rel="noreferrer"
              className="text-midnight-navy underline decoration-fog-border underline-offset-4 hover:text-chartreuse-pulse hover:decoration-chartreuse-pulse transition-colors"
            >
              npmjs.com/package/@trypact/sdk ↗
            </a>
          </div>
        </div>
      </section>

      {/* Provenance line */}
      <section className="bg-ghost-canvas border-t border-fog-border/50">
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-24">
          <div className="text-center font-mono text-caption tracking-caption text-slate-ink">
            Reading from PactRegistry at{" "}
            <a
              href={`${PACT_EXPLORER_URL}/address/${PACT_ADDRESSES.PactRegistry}`}
              target="_blank"
              rel="noreferrer"
              className="text-midnight-navy hover:text-chartreuse-pulse transition-colors"
            >
              {PACT_ADDRESSES.PactRegistry.slice(0, 8)}…
              {PACT_ADDRESSES.PactRegistry.slice(-6)} ↗
            </a>
            . Verify on chainscan.0g.ai.
          </div>
        </div>
      </section>
    </>
  );
}

function integrateSnippet(serviceId: number): string {
  return `import { PactClient } from "@trypact/sdk";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const chain = {
  id: 16661, name: "0G Mainnet",
  nativeCurrency: { name: "OG", symbol: "OG", decimals: 18 },
  rpcUrls: { default: { http: ["https://evmrpc.0g.ai"] } },
} as const;

const account = privateKeyToAccount(process.env.BUYER_KEY as \`0x\${string}\`);
const pact = new PactClient({
  publicClient: createPublicClient({ chain, transport: http() }),
  walletClient: createWalletClient({ account, chain, transport: http() }),
});

const result = await pact.run({
  serviceId: ${serviceId}n,
  prompt: "Audit this Solidity contract for reentrancy vulnerabilities",
});

console.log(result.verified.ok);                  // true on authentic attestation
console.log(result.verified.recoveredSigner);     // matches service.signingAddress
console.log(result.txHashes.createJob);           // chainscan it`;
}
