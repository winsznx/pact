"use client";

// CHUNK 4 — state-aware job detail. Polls PactEscrow.getJob(jobId)
// every 3s via useJob() hook. WebSocket subscription is v0.2.

import { use, useMemo } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { type Hex } from "viem";
import { PACT_ADDRESSES, PACT_EXPLORER_URL } from "@pact/shared";

import { Breadcrumb } from "@/components/service-detail/Breadcrumb";
import { JobStateMachine } from "@/components/jobs/JobStateMachine";
import { JobDetailsCard } from "@/components/jobs/JobDetailsCard";
import { JobStatePanel } from "@/components/jobs/JobStatePanel";
import { SettlementSection } from "@/components/jobs/SettlementSection";
import { TeeMoment } from "@/components/jobs/TeeMoment";
import {
  JobState,
  JobStateLabel,
  type JobStateValue,
  useJob,
  useService,
} from "@/lib/wagmi";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Service-1 captured fixture — used as fallback for the recovered signer
// rendering when an Attested job's signature can't be re-recovered
// in-browser (the contract already verified it; we display the registered
// signer alongside for visual confirmation).
const SERVICE_1_REGISTERED_SIGNER =
  "0x4C1b546f5Fc11A9c2428eaFEd1D951Aa13C17ee8" as const;

export default function JobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  // App Router 15: params is a Promise. `use()` unwraps it on the client.
  const { jobId: jobIdRaw } = use(params);

  if (!/^\d+$/.test(jobIdRaw)) {
    notFound();
  }

  const jobId = BigInt(jobIdRaw);
  const { data: job, isLoading, isError } = useJob(jobId);

  const serviceIdForRead =
    job && job.serviceId > 0n ? job.serviceId : 0n;
  const { data: service } = useService(serviceIdForRead);

  // All hooks must run on every render — declare attestationText
  // unconditionally before any early returns. The empty-string fallback
  // covers both the loading state and any job in pre-Attested states.
  const attestationTextHex = (job?.attestationText ?? "0x") as Hex;
  const attestationText = useMemo(() => {
    if (!attestationTextHex || attestationTextHex === "0x") return "";
    try {
      const bytes = hexToBytes(attestationTextHex);
      return new TextDecoder().decode(bytes);
    } catch {
      return attestationTextHex;
    }
  }, [attestationTextHex]);

  if (isLoading) {
    return (
      <section className="bg-ghost-canvas">
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-72 text-center">
          <p className="font-mono text-caption tracking-caption text-slate-ink">
            Loading job #{jobId.toString()}…
          </p>
        </div>
      </section>
    );
  }

  if (isError || !job || job.buyer === ZERO_ADDRESS) {
    notFound();
  }

  const state = Number(job.state) as JobStateValue;

  return (
    <>
      <Breadcrumb
        current={`Service #${job.serviceId.toString()} · Job #${jobId.toString()}`}
      />

      {/* Page header */}
      <section className="bg-ghost-canvas">
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-72">
          <div className="text-caption uppercase tracking-uppercase text-slate-ink font-mono">
            Job · #{jobId.toString()} · service #{job.serviceId.toString()}
          </div>
          <h1 className="mt-16 font-display font-normal text-display leading-display tracking-display text-midnight-navy text-balance">
            {headlineForState(state)}
          </h1>
          <div className="mt-20 font-mono text-caption tracking-caption text-slate-ink">
            State: {JobStateLabel[state]} · Polling every 3s
          </div>
        </div>
      </section>

      <JobStateMachine state={state} />

      {/* Two-column body — details (left) + state panel (right) */}
      <section className="bg-ghost-canvas">
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-72">
          <div className="grid gap-24 lg:grid-cols-2 items-start">
            <JobDetailsCard
              jobId={jobId}
              serviceId={job.serviceId}
              buyer={job.buyer}
              amountWei={job.amount}
              inputCommitment={
                ("0x" + job.inputCommitment.slice(2).padStart(64, "0")) as Hex
              }
              createdAt={job.createdAt}
              state={state}
            />
            <JobStatePanel
              jobId={jobId}
              state={state}
              createdAt={job.createdAt}
              timeout={job.timeout}
            />
          </div>
        </div>
      </section>

      {/* Settlement details */}
      {state === JobState.Settled ? (
        <SettlementSection
          serviceId={job.serviceId}
          amountWei={job.amount}
          protocolFeeWei={job.protocolFee}
        />
      ) : null}

      {/* The TEE moment — only when attestation has been submitted */}
      {(state === JobState.Attested || state === JobState.Settled) &&
      attestationText ? (
        <TeeMoment
          jobId={jobId}
          attestationText={attestationText}
          attestationTextHex={attestationTextHex}
          signature={job.attestationSignature as Hex}
          registeredSigner={
            (service?.signingAddress ?? SERVICE_1_REGISTERED_SIGNER) as `0x${string}`
          }
          outputRootHash={job.outputRootHash as Hex}
        />
      ) : null}

      {/* Provenance line */}
      <section className="bg-ghost-canvas border-t border-fog-border/50">
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-24">
          <div className="text-center font-mono text-caption tracking-caption text-slate-ink">
            Reading from PactEscrow at{" "}
            <span className="text-midnight-navy">
              {shortAddress(PACT_ADDRESSES.PactEscrow)}
            </span>
            . Verify on{" "}
            <Link
              href={`${PACT_EXPLORER_URL}/address/${PACT_ADDRESSES.PactEscrow}`}
              target="_blank"
              className="text-midnight-navy underline decoration-fog-border underline-offset-4 hover:decoration-midnight-navy transition-colors"
            >
              chainscan.0g.ai
            </Link>
            .
          </div>
        </div>
      </section>
    </>
  );
}

function headlineForState(state: JobStateValue): string {
  switch (state) {
    case JobState.Pending:
      return "Job created. Awaiting attestation.";
    case JobState.Sealed:
      return "Sealed. Awaiting attestation.";
    case JobState.Attested:
      return "Attestation received. Settling…";
    case JobState.Settled:
      return "Job settled.";
    case JobState.Expired:
      return "Job expired.";
    case JobState.Disputed:
      return "Job in dispute.";
    case JobState.Slashed:
      return "Slash executed.";
    default:
      return "Job";
  }
}

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function hexToBytes(hex: Hex): Uint8Array {
  const stripped = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(stripped.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(stripped.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
