"use client";

import { useEffect, useState } from "react";

import { Card } from "@/components/ui/Card";
import { ECDSARecoveryViz } from "@/components/jobs/ECDSARecoveryViz";
import type { Hex } from "viem";

/**
 * The "split-screen TEE moment" from PRD §17 demo screenplay (Beat 2).
 * Three panes:
 *   LEFT   — buyer's plaintext prompt (pulled from localStorage)
 *   CENTER — interactive ECDSA recovery viz (animated step-by-step
 *            mirror of AttestationVerifier.sol's recover primitive)
 *   RIGHT  — seller's plaintext output (pulled from localStorage)
 *
 * This is the loudest section on the job page. Sized accordingly:
 * larger horizontal padding, taller cards, stronger shadow.
 *
 * v0.2: prompt + output flow through ECIES + indexer instead of
 * localStorage. The component surface stays identical.
 *
 * All sizing/spacing/color resolves to design tokens.
 */
interface TeeMomentProps {
  jobId: bigint;
  attestationText: string;
  attestationTextHex: Hex;
  signature: Hex;
  registeredSigner: `0x${string}`;
}

export function TeeMoment({
  jobId,
  attestationText,
  attestationTextHex,
  signature,
  registeredSigner,
}: TeeMomentProps) {
  const [prompt, setPrompt] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPrompt(window.localStorage.getItem(`pact:prompt:${jobId.toString()}`));
    setOutput(window.localStorage.getItem(`pact:output:${jobId.toString()}`));
  }, [jobId]);

  return (
    <section className="bg-ghost-canvas border-t border-fog-border/50">
      <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-72">
        <div className="text-center mb-40">
          <div className="text-caption uppercase tracking-uppercase text-slate-ink mb-12 font-mono">
            Verifiable inference
          </div>
          <h2 className="font-display font-normal text-heading-lg tracking-heading-lg leading-heading-lg text-midnight-navy text-balance">
            Buyer prompt → TEE → seller output, every step proven on-chain
          </h2>
        </div>
        <div className="grid gap-24 lg:grid-cols-3 items-start">
          {/* LEFT — buyer prompt */}
          <Card variant="elevated" className="p-32">
            <div className="text-caption uppercase tracking-uppercase text-slate-ink font-mono mb-16">
              Your prompt
            </div>
            {prompt ? (
              <div className="font-mono text-caption leading-subheading tracking-caption text-midnight-navy bg-data-chip rounded-cardssmall p-16 whitespace-pre-wrap break-words">
                {prompt}
              </div>
            ) : (
              <div className="font-mono text-caption tracking-caption text-slate-ink">
                Prompt not stored locally. v0.2 reads from indexer.
              </div>
            )}
          </Card>

          {/* CENTER — interactive ECDSA recovery viz */}
          <ECDSARecoveryViz
            attestationText={attestationText}
            attestationTextHex={attestationTextHex}
            signature={signature}
            registeredSigner={registeredSigner}
          />

          {/* RIGHT — seller output */}
          <Card variant="elevated" className="p-32">
            <div className="text-caption uppercase tracking-uppercase text-slate-ink font-mono mb-16">
              Seller&apos;s output
            </div>
            {output ? (
              <div className="font-mono text-caption leading-subheading tracking-caption text-midnight-navy bg-data-chip rounded-cardssmall p-16 whitespace-pre-wrap break-words">
                {output}
              </div>
            ) : (
              <div className="font-mono text-caption tracking-caption text-slate-ink">
                Output pending. v0.2 reads ECIES-decrypted output from indexer.
              </div>
            )}
          </Card>
        </div>
      </div>
    </section>
  );
}
