"use client";

import { useCallback, useEffect, useState } from "react";
import { hashMessage, recoverMessageAddress, type Hex } from "viem";

import { Card } from "@/components/ui/Card";
import { Hash } from "@/components/ui/Hash";

/**
 * Interactive ECDSA recovery visualisation. Mirrors AttestationVerifier.sol's
 * primitive verbatim:
 *   bytes32 digest = MessageHashUtils.toEthSignedMessageHash(attestationText);
 *   address signer = ECDSA.recover(digest, signature);
 *
 * On the client we use viem's `hashMessage({ raw })` (which produces the
 * exact EIP-191 prefixed keccak256 the OZ helper produces) and
 * `recoverMessageAddress({ message: { raw }, signature })` for the recovery.
 * If the recovered address matches the service's registered signing
 * address, the attestation is cryptographically valid.
 *
 * The animation reveals the cryptographic chain step-by-step so a non-
 * technical viewer can follow what's happening: 5-field text → EIP-191
 * wrap → keccak256 hash → ECDSA recovery → comparison.
 *
 * Animation timing is set in STEP_DELAYS_MS — total ~2.5s across 7 steps.
 *
 * `autoplay` (set via ?autoplay=1 on /verify routes) starts the animation
 * on mount instead of waiting for the user to click the CTA. Useful for
 * recording demo screenshots without manual interaction.
 *
 * All sizing/spacing/color resolves to design tokens.
 */

const FIELD_LABELS = [
  "contentHash",
  "usageHash",
  "providerType",
  "providerIdentity",
  "tlsCertFingerprint",
];

// ms offset from "verify clicked" for each step transition.
const STEP_DELAYS_MS = [0, 250, 800, 1200, 1700, 2100, 2500];

interface ECDSARecoveryVizProps {
  attestationText: string;
  attestationTextHex: Hex;
  signature: Hex;
  registeredSigner: `0x${string}`;
  autoplay?: boolean;
}

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function ECDSARecoveryViz({
  attestationText,
  attestationTextHex,
  signature,
  registeredSigner,
  autoplay = false,
}: ECDSARecoveryVizProps) {
  const [step, setStep] = useState<Step>(0);
  const [recovered, setRecovered] = useState<`0x${string}` | null>(null);
  const [recoverError, setRecoverError] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState(false);

  const fields = attestationText ? attestationText.split(":") : [];
  const prefixedHash = attestationTextHex
    ? hashMessage({ raw: attestationTextHex })
    : null;
  const matches =
    recovered !== null &&
    recovered.toLowerCase() === registeredSigner.toLowerCase();

  const start = useCallback(() => {
    if (step > 0) return;
    setStep(1);
    // Run the actual recovery in parallel with the animation reveal so
    // the recovered address is ready by the time step 5 fades it in.
    recoverMessageAddress({
      message: { raw: attestationTextHex },
      signature,
    })
      .then((addr) => setRecovered(addr))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "recovery failed";
        setRecoverError(msg.slice(0, 200));
      });
    // Schedule the visual step transitions.
    STEP_DELAYS_MS.slice(1).forEach((ms, i) => {
      window.setTimeout(() => setStep((i + 1) as Step), ms);
    });
  }, [step, attestationTextHex, signature]);

  useEffect(() => {
    if (autoplay) start();
  }, [autoplay, start]);

  return (
    <Card variant="elevated" className="p-32">
      <div className="flex items-center justify-between gap-12 flex-wrap">
        <div>
          <div className="text-caption uppercase tracking-uppercase text-slate-ink font-mono">
            TEE attestation
          </div>
          <h3 className="mt-8 text-heading-sm tracking-heading-sm leading-heading-sm font-medium text-midnight-navy">
            ECDSA recovery
          </h3>
        </div>
        {step === 0 ? (
          <button
            type="button"
            onClick={start}
            className="inline-flex items-center justify-center h-40 px-24 rounded-buttons bg-chartreuse-pulse text-midnight-navy text-button tracking-button font-medium [box-shadow:var(--shadow-cta-pill)] hover:brightness-[1.02] active:translate-y-[1px] transition-transform"
          >
            Verify attestation →
          </button>
        ) : null}
      </div>

      {/* Step 1 — 5-field canonical text with sequential field highlight */}
      <div className="mt-20">
        <StepLabel index={1} step={step}>
          Canonical 5-field text (highlighting input fields)
        </StepLabel>
        <div className="mt-8 font-mono text-caption leading-subheading tracking-caption text-midnight-navy bg-data-chip rounded-cardssmall p-16 break-all">
          {fields.length > 0 ? (
            fields.map((f, i, arr) => (
              <span
                key={i}
                className={
                  step >= 1 && step >= i + 1
                    ? "text-chartreuse-pulse"
                    : "text-midnight-navy"
                }
              >
                {f}
                {i < arr.length - 1 ? (
                  <span className="text-chartreuse-pulse mx-0.5">:</span>
                ) : null}
              </span>
            ))
          ) : (
            <span className="text-slate-ink">No attestation text yet.</span>
          )}
        </div>
        <div className="mt-8 grid grid-cols-5 gap-4 font-mono text-caption tracking-caption text-slate-ink">
          {FIELD_LABELS.map((label, i) => (
            <span
              key={label}
              className={
                step >= i + 1 ? "text-chartreuse-pulse" : "text-slate-ink"
              }
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Step 2 — EIP-191 prefix wrap */}
      <Reveal active={step >= 2} className="mt-20">
        <StepLabel index={2} step={step}>
          EIP-191 prefix wrap
        </StepLabel>
        <div className="mt-8 font-mono text-caption leading-subheading tracking-caption text-midnight-navy bg-data-chip rounded-cardssmall p-16 break-all">
          <span className="text-chartreuse-pulse">{`\\x19Ethereum Signed Message:\\n${attestationText.length}`}</span>
          {attestationText}
        </div>
      </Reveal>

      {/* Step 3 — keccak256 prefixed digest */}
      <Reveal active={step >= 3} className="mt-20">
        <StepLabel index={3} step={step}>
          keccak256 of prefixed message
        </StepLabel>
        <div className="mt-8">
          {prefixedHash ? (
            <Hash value={prefixedHash} kind="tx" head={10} tail={8} />
          ) : (
            <span className="font-mono text-caption tracking-caption text-slate-ink">
              hash unavailable
            </span>
          )}
        </div>
      </Reveal>

      {/* Step 4 — ECDSA recovery in flight */}
      <Reveal active={step >= 4} className="mt-20">
        <StepLabel index={4} step={step}>
          ECDSA secp256k1 recover (signature → address)
        </StepLabel>
        <div className="mt-8 font-mono text-caption tracking-caption text-slate-ink">
          recoverMessageAddress(message, signature)
        </div>
      </Reveal>

      {/* Step 5 — recovered address fade-in */}
      <Reveal active={step >= 5} className="mt-20">
        <StepLabel index={5} step={step}>
          Recovered address
        </StepLabel>
        <div className="mt-8">
          {recoverError ? (
            <span className="font-mono text-caption tracking-caption text-midnight-navy">
              {recoverError}
            </span>
          ) : recovered ? (
            <Hash value={recovered} kind="address" />
          ) : (
            <span className="font-mono text-caption tracking-caption text-slate-ink">
              recovering…
            </span>
          )}
        </div>
      </Reveal>

      {/* Step 6 — comparison + match badge */}
      <Reveal active={step >= 6} className="mt-20">
        <StepLabel index={6} step={step}>
          Comparison vs registered signer
        </StepLabel>
        <div className="mt-12 grid grid-cols-[1fr_auto_1fr] items-center gap-16">
          <div className="text-right">
            {recovered ? (
              <Hash value={recovered} kind="address" />
            ) : (
              <span className="font-mono text-caption tracking-caption text-slate-ink">
                —
              </span>
            )}
          </div>
          <span
            className={
              matches
                ? "font-mono text-heading-sm text-chartreuse-pulse"
                : recovered
                  ? "font-mono text-heading-sm text-midnight-navy"
                  : "font-mono text-heading-sm text-slate-ink"
            }
          >
            {recovered ? (matches ? "==" : "≠") : "?"}
          </span>
          <div className="text-left">
            <Hash value={registeredSigner} kind="address" />
          </div>
        </div>
        {recovered ? (
          <div className="mt-16 flex justify-center">
            <span
              className={
                matches
                  ? "inline-flex items-center gap-8 rounded-badges px-16 py-8 bg-chartreuse-pulse text-midnight-navy text-button tracking-button font-medium"
                  : "inline-flex items-center gap-8 rounded-badges px-16 py-8 bg-pure-surface text-midnight-navy text-button tracking-button font-medium [box-shadow:var(--shadow-md)]"
              }
            >
              {matches ? "✓ MATCH" : "✗ MISMATCH"}
            </span>
          </div>
        ) : null}
        {matches ? (
          <p className="mt-20 text-body leading-body tracking-body text-storm-gray text-center max-w-prose mx-auto">
            Signature recovered to the same address PactRegistry
            .getService() returns. The attestation is cryptographically
            verified to come from the enclave that ran the inference.
          </p>
        ) : null}
      </Reveal>

      {/* Why this matters — collapsed by default, expandable */}
      <div className="mt-32 pt-20 border-t border-fog-border/50">
        <button
          type="button"
          onClick={() => setShowWhy((v) => !v)}
          className="font-mono text-caption tracking-caption text-midnight-navy hover:text-chartreuse-pulse transition-colors"
        >
          {showWhy ? "− Hide why this matters" : "+ Why this matters"}
        </button>
        {showWhy ? (
          <p className="mt-12 text-body leading-body tracking-body text-storm-gray max-w-prose">
            This recovery runs in your browser using the same cryptographic
            primitive (EIP-191 personal_sign + ECDSA secp256k1 recover) that
            PACT&apos;s AttestationVerifier contract uses on-chain. If the
            recovered address matches the service&apos;s registered
            signingAddress, the attestation is authentic. If they differ —
            slash.
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function StepLabel({
  index,
  step,
  children,
}: {
  index: number;
  step: Step;
  children: React.ReactNode;
}) {
  const reached = step >= index;
  return (
    <div className="font-mono text-caption tracking-caption">
      <span
        className={
          reached ? "text-chartreuse-pulse" : "text-slate-ink"
        }
      >
        {index}.
      </span>{" "}
      <span
        className={reached ? "text-midnight-navy" : "text-slate-ink"}
      >
        {children}
      </span>
    </div>
  );
}

function Reveal({
  active,
  className = "",
  children,
}: {
  active: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${className} transition-opacity duration-500 ${
        active ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      aria-hidden={!active}
    >
      {children}
    </div>
  );
}
