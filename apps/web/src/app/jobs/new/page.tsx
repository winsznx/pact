"use client";

// CHUNK 4 — first chunk that transacts on 0G mainnet.
//
// v0.1 SIMPLIFICATION: prompts go in plaintext. inputCommitment is just
// keccak256(toBytes(prompt)) — no ECIES wrapping. The seller agent
// (Phase 4) reads the plaintext from localStorage under
// `pact:prompt:${jobId}`.
//
// v0.2 will replace the localStorage handoff with an ECIES wrapping
// keyed off the seller's pubkey from PactRegistry, plus a Supabase
// queue for delivery. The component surface won't need to change —
// only the commitment derivation and the side-channel write call.

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { JobForm } from "@/components/jobs/JobForm";
import { JobActionPanel } from "@/components/jobs/JobActionPanel";
import { Breadcrumb } from "@/components/service-detail/Breadcrumb";
import { useService } from "@/lib/wagmi";

export default function NewJobPage() {
  // useSearchParams must be inside a Suspense boundary in App Router.
  return (
    <Suspense fallback={null}>
      <NewJobInner />
    </Suspense>
  );
}

function NewJobInner() {
  const searchParams = useSearchParams();
  const serviceIdRaw = searchParams.get("serviceId") ?? "1";
  const serviceId = BigInt(/^\d+$/.test(serviceIdRaw) ? serviceIdRaw : "1");

  const { data: service, isLoading } = useService(serviceId);
  const [prompt, setPrompt] = useState("");

  return (
    <>
      <Breadcrumb current={`Service #${serviceId.toString()} · New job`} />

      <section className="bg-ghost-canvas">
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-72">
          <div className="text-caption uppercase tracking-uppercase text-slate-ink font-mono">
            Create job · service #{serviceId.toString()}
          </div>
          <h1 className="mt-16 font-display font-normal text-display leading-display tracking-display text-midnight-navy text-balance">
            Run an inference
          </h1>
          <div className="mt-20 font-mono text-caption tracking-caption text-slate-ink">
            {isLoading
              ? "Loading service…"
              : service
                ? `Service #${serviceId.toString()} · ${service.modelId}`
                : "Service not available"}
          </div>
        </div>
      </section>

      {service && service.active ? (
        <section className="bg-ghost-canvas">
          <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 pb-72">
            <div className="grid gap-24 lg:grid-cols-[3fr_2fr] lg:items-start">
              <JobForm
                prompt={prompt}
                setPrompt={setPrompt}
                pricePerCallWei={service.pricePerCall}
              />
              <JobActionPanel
                prompt={prompt}
                serviceId={serviceId}
                pricePerCallWei={service.pricePerCall}
              />
            </div>
          </div>
        </section>
      ) : !isLoading ? (
        <section className="bg-ghost-canvas">
          <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 pb-72 text-center">
            <p className="text-body leading-body tracking-body text-storm-gray">
              Service not available. It may have been paused or never registered.
            </p>
            <Link
              href="/marketplace"
              className="mt-20 inline-block font-mono text-caption tracking-caption text-midnight-navy hover:text-chartreuse-pulse transition-colors"
            >
              ← Back to marketplace
            </Link>
          </div>
        </section>
      ) : null}
    </>
  );
}
