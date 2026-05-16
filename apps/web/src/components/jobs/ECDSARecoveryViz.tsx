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
 * On the client we use viem's `hashMessage({ raw })` (same EIP-191 prefix
 * + keccak256 the OZ helper produces) and `recoverMessageAddress`. If the
 * recovered address matches the service's registered signing address, the
 * attestation is cryptographically valid.
 *
 * Each step is enhanced with a microinteraction that makes the math
 * feel alive rather than fading in as inert text:
 *   - Step 1: sequential chartreuse pulse along the 5 colon-separated fields
 *   - Step 3: hash cascade — characters cycle through random hex digits
 *             before locking, slot-machine-style
 *   - Step 4: secp256k1 curve renders by drawing its stroke in
 *   - Step 5: recovered-point drops onto the curve, address pulses chartreuse
 *   - Step 6: MATCH badge scale-pops in with cubic-bezier overshoot
 *
 * `autoplay` (set via ?autoplay=1 on /verify routes) starts the reveal
 * on mount — used in the demo screencast.
 *
 * Timing is dialed via STEP_DELAYS_MS — total ~3.0s across 7 steps.
 */

const FIELD_LABELS = [
  "contentHash",
  "usageHash",
  "providerType",
  "providerIdentity",
  "tlsCertFingerprint",
];

const STEP_DELAYS_MS = [0, 300, 950, 1500, 2200, 2700, 3050];

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
    recoverMessageAddress({
      message: { raw: attestationTextHex },
      signature,
    })
      .then((addr) => setRecovered(addr))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "recovery failed";
        setRecoverError(msg.slice(0, 200));
      });
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
                    ? "text-chartreuse-pulse transition-colors duration-300"
                    : "text-midnight-navy transition-colors duration-300"
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
        <ol className="mt-12 space-y-4 font-mono text-caption tracking-caption">
          {FIELD_LABELS.map((label, i) => {
            const active = step >= i + 1;
            return (
              <li
                key={label}
                className={
                  "flex items-center gap-8 transition-colors duration-300 " +
                  (active ? "text-chartreuse-pulse" : "text-slate-ink")
                }
              >
                <span
                  aria-hidden
                  className={
                    "inline-flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-buttons text-[10px] leading-none transition-colors duration-300 " +
                    (active
                      ? "bg-chartreuse-pulse text-midnight-navy"
                      : "bg-fog-border/40 text-slate-ink")
                  }
                >
                  {i + 1}
                </span>
                <span className="break-all">{label}</span>
              </li>
            );
          })}
        </ol>
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

      {/* Step 3 — keccak256 prefixed digest with slot-machine cascade */}
      <Reveal active={step >= 3} className="mt-20">
        <StepLabel index={3} step={step}>
          keccak256 of prefixed message
        </StepLabel>
        <div className="mt-8">
          {prefixedHash ? (
            <HashCascade hash={prefixedHash} active={step >= 3} />
          ) : (
            <span className="font-mono text-caption tracking-caption text-slate-ink">
              hash unavailable
            </span>
          )}
        </div>
      </Reveal>

      {/* Step 4 — ECDSA recovery, depicted as a curve being drawn */}
      <Reveal active={step >= 4} className="mt-20">
        <StepLabel index={4} step={step}>
          ECDSA secp256k1 recover (signature → address)
        </StepLabel>
        <div className="mt-12 rounded-cardssmall bg-data-chip p-16">
          <Secp256k1Curve
            curveActive={step >= 4}
            pointActive={step >= 5 && recovered !== null}
          />
          <div className="mt-12 font-mono text-caption tracking-caption text-slate-ink text-center">
            y² = x³ + 7 &nbsp;·&nbsp; signature → point on the curve → address
          </div>
        </div>
      </Reveal>

      {/* Step 5 — recovered address with chartreuse glow flourish */}
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
            <span
              key={recovered}
              className="inline-block rounded-cardssmall pact-recovered-glow"
            >
              <Hash value={recovered} kind="address" />
            </span>
          ) : (
            <span className="font-mono text-caption tracking-caption text-slate-ink">
              recovering…
            </span>
          )}
        </div>
      </Reveal>

      {/* Step 6 — comparison + match badge with scale-pop entrance */}
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
              key={`${matches}-${recovered}`}
              className={
                matches
                  ? "pact-match-pop inline-flex items-center gap-8 rounded-badges px-16 py-8 bg-chartreuse-pulse text-midnight-navy text-button tracking-button font-medium"
                  : "pact-match-pop inline-flex items-center gap-8 rounded-badges px-16 py-8 bg-pure-surface text-midnight-navy text-button tracking-button font-medium [box-shadow:var(--shadow-md)]"
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

      {/* Why this matters — collapsed by default */}
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

/**
 * Slot-machine character cascade for a hex hash. Each char cycles through
 * random hex digits over ~750ms, then locks to its final value at a
 * staggered offset so the eye reads "computing → done" left-to-right.
 */
function HashCascade({ hash, active }: { hash: string; active: boolean }) {
  const [display, setDisplay] = useState<string>(() => hash);
  useEffect(() => {
    if (!active) {
      setDisplay(hash);
      return;
    }
    const chars = hash.split("");
    const totalFrames = 45; // ~720ms at 16ms per frame
    let frame = 0;
    const hex = "0123456789abcdef";
    const id = window.setInterval(() => {
      frame += 1;
      const ratio = frame / totalFrames;
      const next = chars.map((c, i) => {
        // Skip the "0x" prefix — settle it immediately.
        if (i < 2) return c;
        // Each char settles at a different t. Staggered left → right.
        const settleAt = 0.25 + ((i - 2) / Math.max(chars.length - 2, 1)) * 0.65;
        if (ratio < settleAt) {
          return hex[Math.floor(Math.random() * 16)] ?? c;
        }
        return c;
      });
      setDisplay(next.join(""));
      if (frame >= totalFrames) window.clearInterval(id);
    }, 16);
    return () => window.clearInterval(id);
  }, [hash, active]);

  return (
    <span className="font-mono text-caption tracking-caption text-chartreuse-pulse bg-data-chip rounded-cardssmall px-12 py-8 inline-block">
      {display}
    </span>
  );
}

/**
 * Stylized secp256k1 curve fragment. The real curve over R is one branch
 * (no closed loop), monotonically rising to the right. Drawn left-to-right
 * via stroke-dashoffset; the recovered point drops onto its right end
 * when ECDSA resolves.
 */
function Secp256k1Curve({
  curveActive,
  pointActive,
}: {
  curveActive: boolean;
  pointActive: boolean;
}) {
  // 700px curve length is a heuristic — overshoots the actual path length
  // so the animation reads as "fully drawn" by the time it completes.
  return (
    <svg
      viewBox="0 0 420 180"
      className="w-full h-[140px]"
      role="img"
      aria-label="secp256k1 curve"
    >
      {/* X axis */}
      <line
        x1="20"
        y1="160"
        x2="400"
        y2="160"
        stroke="#d0f100"
        strokeOpacity="0.12"
        strokeWidth="1"
        strokeDasharray="2 4"
      />
      {/* Y axis */}
      <line
        x1="50"
        y1="20"
        x2="50"
        y2="170"
        stroke="#d0f100"
        strokeOpacity="0.12"
        strokeWidth="1"
        strokeDasharray="2 4"
      />
      {/* The curve itself — quasi-elliptic, rising from low-left to high-right */}
      <path
        d="M 60 160 C 110 158 150 148 200 122 S 320 50 400 22"
        stroke="#d0f100"
        strokeWidth="2.8"
        fill="none"
        strokeLinecap="round"
        style={
          curveActive
            ? {
                strokeDasharray: 700,
                strokeDashoffset: 0,
                transition: "stroke-dashoffset 900ms ease-out",
              }
            : {
                strokeDasharray: 700,
                strokeDashoffset: 700,
              }
        }
      />
      {/* Recovered point lands on the curve's high-right tip */}
      {pointActive ? (
        <g className="pact-apex-drop" style={{ transformOrigin: "400px 22px" }}>
          <circle cx="400" cy="22" r="12" fill="#d0f100" opacity="0.32" />
          <circle cx="400" cy="22" r="6" fill="#d0f100" />
        </g>
      ) : null}
      {/* Origin marker */}
      <circle cx="50" cy="160" r="2.5" fill="#d0f100" fillOpacity="0.4" />
    </svg>
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
          reached
            ? "text-chartreuse-pulse transition-colors duration-300"
            : "text-slate-ink transition-colors duration-300"
        }
      >
        {index}.
      </span>{" "}
      <span
        className={
          reached
            ? "text-midnight-navy transition-colors duration-300"
            : "text-slate-ink transition-colors duration-300"
        }
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
