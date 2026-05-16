"use client";

// CHUNK 5 — focused verification page. Strips the broader buyer-flow
// chrome and shows ONLY the cryptographic verification + chainscan
// links. Linkable from external sources (X, README) so judges can hit
// the moat in 30 seconds.
//
// Mock state: when NEXT_PUBLIC_DEMO_MOCK === "1" AND ?mockState=settled
// is in the URL, render the captured G5 fixture as if the job were
// Settled. Used for dev verification of the viz without waiting for
// Phase 4's seller agent. Never enabled in production builds.

import { Suspense, use } from "react";
import { notFound, useSearchParams } from "next/navigation";
import Link from "next/link";
import { type Hex } from "viem";
import { PACT_ADDRESSES, PACT_EXPLORER_URL } from "@pact/shared";

import { Breadcrumb } from "@/components/service-detail/Breadcrumb";
import { ECDSARecoveryViz } from "@/components/jobs/ECDSARecoveryViz";
import { JobState, useJob, useService } from "@/lib/wagmi";

// G5 captured fixture — used for the mockState=settled path so dev
// can exercise the viz against the same canonical attestation that
// AttestationReceipt renders on the landing page showcase.
const G5_FIXTURE = {
  text: "df0870f9b6a0bafc8223cebee0581160c6ea69876e57be3fa4e412450cd0b88e:0a2d1a40916f10253302e59bd1f1ea7dca6616fe4e816e3cd683310c5711eed6:centralized:openrouter:84c05f5412b2f6357c22c1fd3f9d345b9ac02e99254491a05b589b46570d3ba9",
  signature:
    "0x99946cf42f441ae8756cc899f74054926c8b9d4ae5b570499783da23ae73393a647dc0f9a188159876d1ba52b42bdc0b837ccaaf0ccf79b93449a16b1f9fab831c",
  signingAddress: "0x4C1b546f5Fc11A9c2428eaFEd1D951Aa13C17ee8",
} as const;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export default function VerifyJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId: jobIdRaw } = use(params);
  if (!/^\d+$/.test(jobIdRaw)) notFound();

  return (
    <Suspense fallback={null}>
      <VerifyInner jobIdRaw={jobIdRaw} />
    </Suspense>
  );
}

function VerifyInner({ jobIdRaw }: { jobIdRaw: string }) {
  const jobId = BigInt(jobIdRaw);
  const searchParams = useSearchParams();
  const mockEnabled = process.env.NEXT_PUBLIC_DEMO_MOCK === "1";
  const mockState = mockEnabled ? searchParams.get("mockState") : null;
  const autoplay = searchParams.get("autoplay") === "1";

  const { data: job, isLoading } = useJob(jobId);
  const serviceIdForRead = job && job.serviceId > 0n ? job.serviceId : 0n;
  const { data: service } = useService(serviceIdForRead);

  // Decide what to render. Mock takes precedence when explicitly enabled.
  const shouldRenderViz =
    mockState === "settled" ||
    mockState === "attested" ||
    (job &&
      (Number(job.state) === JobState.Attested ||
        Number(job.state) === JobState.Settled) &&
      job.attestationText &&
      job.attestationText !== "0x");

  // Real-job display values; fallback to fixture when mocking.
  const attestationTextHex: Hex =
    mockState && (mockState === "settled" || mockState === "attested")
      ? (("0x" +
          Array.from(new TextEncoder().encode(G5_FIXTURE.text))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")) as Hex)
      : ((job?.attestationText ?? "0x") as Hex);

  const attestationText =
    mockState && (mockState === "settled" || mockState === "attested")
      ? G5_FIXTURE.text
      : decodeBytes(attestationTextHex);

  const signature: Hex =
    mockState && (mockState === "settled" || mockState === "attested")
      ? (G5_FIXTURE.signature as Hex)
      : ((job?.attestationSignature ?? "0x") as Hex);

  const registeredSigner =
    (service?.signingAddress ??
      G5_FIXTURE.signingAddress) as `0x${string}`;

  const showWaiting =
    !shouldRenderViz && !isLoading && (!job || job.buyer === ZERO_ADDRESS);

  return (
    <>
      <Breadcrumb current={`Verify · Job #${jobId.toString()}`} />

      <section className="bg-ghost-canvas">
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-72">
          <div className="text-caption uppercase tracking-uppercase text-slate-ink font-mono">
            Cryptographic verification
          </div>
          <h1 className="mt-16 font-display font-normal text-display leading-display tracking-display text-midnight-navy text-balance">
            Verify Job #{jobId.toString()}
          </h1>
          <p className="mt-20 text-lead leading-lead tracking-lead text-storm-gray max-w-prose">
            Recover the TEE-attested signature in your browser. Compare to
            the seller&apos;s registered signing address. The same primitive
            that runs on-chain in AttestationVerifier.sol.
          </p>
        </div>
      </section>

      {isLoading && !shouldRenderViz ? (
        <section className="bg-ghost-canvas">
          <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 pb-72 text-center">
            <p className="font-mono text-caption tracking-caption text-slate-ink">
              Loading job #{jobId.toString()} from 0G mainnet…
            </p>
          </div>
        </section>
      ) : showWaiting ? (
        <section className="bg-ghost-canvas">
          <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 pb-72 text-center">
            <p className="text-body leading-body tracking-body text-storm-gray">
              Job not found on chain.
            </p>
          </div>
        </section>
      ) : !shouldRenderViz ? (
        <section className="bg-ghost-canvas">
          <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 pb-72 text-center">
            <p className="text-body leading-body tracking-body text-storm-gray">
              This job hasn&apos;t been attested yet. Verification available
              once state ≥ Attested.
            </p>
            <p className="mt-12 font-mono text-caption tracking-caption text-slate-ink">
              Last polled: {new Date().toISOString()}
            </p>
            <Link
              href={`/jobs/${jobId.toString()}`}
              className="mt-20 inline-block font-mono text-caption tracking-caption text-midnight-navy hover:text-chartreuse-pulse transition-colors"
            >
              ← View live job state
            </Link>
          </div>
        </section>
      ) : (
        <section className="bg-ghost-canvas">
          <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 pb-72">
            <ECDSARecoveryViz
              attestationText={attestationText}
              attestationTextHex={attestationTextHex}
              signature={signature}
              registeredSigner={registeredSigner}
              autoplay={autoplay}
            />

            <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-24">
              <ChainscanLink
                label="PactEscrow contract"
                addr={PACT_ADDRESSES.PactEscrow}
              />
              <ChainscanLink
                label="PactRegistry contract"
                addr={PACT_ADDRESSES.PactRegistry}
              />
              <ChainscanLink
                label="AttestationVerifier contract"
                addr={PACT_ADDRESSES.AttestationVerifier}
              />
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function ChainscanLink({ label, addr }: { label: string; addr: string }) {
  return (
    <Link
      href={`${PACT_EXPLORER_URL}/address/${addr}`}
      target="_blank"
      className="block p-20 rounded-cardsmedium bg-ghost-canvas border border-fog-border/50 hover:border-midnight-navy transition-colors"
    >
      <div className="text-caption uppercase tracking-uppercase text-slate-ink font-mono">
        {label}
      </div>
      <div className="mt-8 font-mono text-caption tracking-caption text-midnight-navy">
        {addr.slice(0, 8)}…{addr.slice(-6)} ↗
      </div>
    </Link>
  );
}

function decodeBytes(hex: Hex): string {
  if (!hex || hex === "0x") return "";
  try {
    const stripped = hex.startsWith("0x") ? hex.slice(2) : hex;
    const bytes = new Uint8Array(stripped.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(stripped.slice(i * 2, i * 2 + 2), 16);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return hex;
  }
}
