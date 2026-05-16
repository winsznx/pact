"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { keccak256, parseEther, toBytes, type Hex } from "viem";
import {
  useChainId,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import {
  PACT_ADDRESSES,
  PACT_EXPLORER_URL,
  PactRegistryAbi,
  SlashingArbiterAbi,
} from "@pact/shared";

import { Card } from "@/components/ui/Card";
import { ogMainnet } from "@/lib/wagmi";
import { SELLER_CONSTANTS } from "@/lib/useSellerProfile";

/**
 * Three-step seller onboarding:
 *   1. Service details form
 *   2. Stake bond + review (2 sequential txs:
 *      PactRegistry.registerService → SlashingArbiter.stakeBond)
 *   3. Done — success card with marketplace link
 *
 * Pre-fills mirror Service 1's smoke-test fixture so the form ships
 * with a working baseline. Override any field freely; the contract
 * accepts any seller-supplied values.
 *
 * Hidden / defaulted contract args (not in the form, set on submit):
 *   capabilityHash      = keccak256(displayName) — placeholder for the
 *                         capability tag taxonomy in PRD §3.1.
 *   providerIdentity    = "openrouter" (per G5 fixture)
 *   providerType        = "centralized"
 *   maxInputBytes       = 8192
 *   inftMetadataURI     = empty bytes (v0.1; CHUNK 9 wires real
 *                         IPFS/0G-Storage URI)
 *
 * Contract surface gap (CHUNK 8 audit): registerService takes 10 args
 * including 3 string fields whose semantics are still being settled
 * in v0.2 (capability taxonomy, providerType enum). The form exposes
 * the 6 fields a seller cares about today; the other 4 are pinned to
 * known-good values until the taxonomy lands.
 *
 * All sizing/spacing/color resolves to design tokens.
 */

const GAS_LEGACY = { gasPrice: 4_000_000_000n, type: "legacy" as const };

const DEFAULTS = {
  displayName: "Code review · Solidity audit",
  modelId: "zai-org/GLM-5-FP8",
  signingAddress: "0x4C1b546f5Fc11A9c2428eaFEd1D951Aa13C17ee8",
  providerAddress: "0xd9966e13a6026Fcca4b13E7ff95c94DE268C471C",
  pricePerCallOg: "0.001",
  targetSeparated: true,
} as const;

type Step = 1 | 2 | 3;

interface FormState {
  displayName: string;
  modelId: string;
  signingAddress: string;
  providerAddress: string;
  pricePerCallOg: string;
  targetSeparated: boolean;
}

export function OnboardingFlow({ onComplete }: { onComplete?: () => void }) {
  const router = useRouter();
  const chainId = useChainId();
  const isOnChain = chainId === ogMainnet.id;

  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>({ ...DEFAULTS });

  // Tx 1 — registerService
  const {
    writeContract: writeRegister,
    data: registerTxHash,
    isPending: registerSending,
    error: registerError,
    reset: resetRegister,
  } = useWriteContract();
  const {
    data: registerReceipt,
    isLoading: registerWaiting,
    isSuccess: registerConfirmed,
  } = useWaitForTransactionReceipt({ hash: registerTxHash });

  // Tx 2 — stakeBond
  const {
    writeContract: writeBond,
    data: bondTxHash,
    isPending: bondSending,
    error: bondError,
    reset: resetBond,
  } = useWriteContract();
  const {
    isLoading: bondWaiting,
    isSuccess: bondConfirmed,
  } = useWaitForTransactionReceipt({ hash: bondTxHash });

  // Pull the assigned serviceId out of the ServiceRegistered event.
  const [serviceId, setServiceId] = useState<bigint | null>(null);

  useEffect(() => {
    if (!registerConfirmed || !registerReceipt || serviceId !== null) return;
    const sid = extractServiceId(registerReceipt.logs);
    if (sid !== null) {
      setServiceId(sid);
      // Auto-advance to bond stake.
      writeBond({
        address: PACT_ADDRESSES.SlashingArbiter,
        abi: SlashingArbiterAbi,
        functionName: "stakeBond",
        args: [sid],
        value: SELLER_CONSTANTS.MIN_BOND_WEI,
        ...GAS_LEGACY,
      });
    }
  }, [registerConfirmed, registerReceipt, serviceId, writeBond]);

  useEffect(() => {
    if (bondConfirmed) {
      setStep(3);
      onComplete?.();
    }
  }, [bondConfirmed, onComplete]);

  const valid = isFormValid(form);

  const onRegister = () => {
    if (!valid || !isOnChain) return;
    writeRegister({
      address: PACT_ADDRESSES.PactRegistry,
      abi: PactRegistryAbi,
      functionName: "registerService",
      args: [
        keccak256(toBytes(form.displayName)),
        form.modelId,
        form.providerAddress as `0x${string}`,
        form.signingAddress as `0x${string}`,
        "openrouter",
        "centralized",
        form.targetSeparated,
        parseEther(form.pricePerCallOg),
        8192n,
        "0x" as Hex,
      ],
      ...GAS_LEGACY,
    });
  };

  const inFlight =
    registerSending || registerWaiting || bondSending || bondWaiting;

  return (
    <>
      {/* Hero */}
      <section className="bg-ghost-canvas">
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 pt-72 pb-40">
          <div className="text-caption uppercase tracking-uppercase text-slate-ink mb-12 font-mono">
            Seller onboarding · 0G mainnet
          </div>
          <h1 className="font-display font-normal text-display leading-display tracking-display text-midnight-navy">
            List your AI service
          </h1>
          <p className="mt-20 text-lead leading-lead tracking-lead text-storm-gray max-w-prose">
            Two transactions to go live: register your Service (mints
            an ERC-7857 Agent INFT) and stake a 5 $0G bond. Total cost
            ~5.0005 $0G plus gas. The bond is at risk if your service
            submits invalid attestations.
          </p>
          <Stepper step={step} />
        </div>
      </section>

      <section className="bg-ghost-canvas">
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 pb-72">
          {step === 1 ? (
            <Step1
              form={form}
              setForm={setForm}
              valid={valid}
              onNext={() => setStep(2)}
            />
          ) : null}
          {step === 2 ? (
            <Step2
              form={form}
              isOnChain={isOnChain}
              inFlight={inFlight}
              registerTxHash={registerTxHash}
              registerConfirmed={registerConfirmed}
              bondTxHash={bondTxHash}
              bondConfirmed={bondConfirmed}
              serviceId={serviceId}
              registerError={registerError}
              bondError={bondError}
              onRegister={onRegister}
              onRetry={() => {
                resetRegister();
                resetBond();
                setServiceId(null);
              }}
              onBack={() => setStep(1)}
            />
          ) : null}
          {step === 3 && serviceId !== null ? (
            <Step3
              serviceId={serviceId}
              registerTxHash={registerTxHash}
              bondTxHash={bondTxHash}
              onDashboard={() => router.push("/seller")}
            />
          ) : null}
        </div>
      </section>
    </>
  );
}

function Stepper({ step }: { step: Step }) {
  const labels: Array<{ index: Step; label: string }> = [
    { index: 1, label: "Service details" },
    { index: 2, label: "Stake bond" },
    { index: 3, label: "Done" },
  ];
  return (
    <div className="mt-32 flex items-center gap-12 flex-wrap">
      {labels.map((s, i) => (
        <span key={s.index} className="inline-flex items-center gap-12">
          <span
            className={
              "inline-flex items-center px-12 py-4 rounded-badges font-mono text-caption tracking-uppercase uppercase " +
              (s.index <= step
                ? "bg-chartreuse-pulse text-midnight-navy font-medium"
                : "bg-pure-surface text-slate-ink border border-fog-border")
            }
          >
            {s.index}. {s.label}
          </span>
          {i < labels.length - 1 ? (
            <span aria-hidden className="text-slate-ink">
              →
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function Step1({
  form,
  setForm,
  valid,
  onNext,
}: {
  form: FormState;
  setForm: (s: FormState) => void;
  valid: boolean;
  onNext: () => void;
}) {
  return (
    <Card variant="elevated" className="p-32">
      <div className="text-caption uppercase tracking-uppercase text-slate-ink font-mono mb-16">
        Step 1 of 3 · Service details
      </div>
      <div className="grid gap-20 md:grid-cols-2">
        <Field
          label="Service display name"
          help="Shown on the marketplace card. Hash becomes the on-chain capability tag."
          value={form.displayName}
          onChange={(v) => setForm({ ...form, displayName: v })}
        />
        <Field
          label="Model identifier"
          help="Provider-side model id. PactRegistry stores it for buyer transparency."
          value={form.modelId}
          onChange={(v) => setForm({ ...form, modelId: v })}
        />
        <Field
          label="Signing address"
          help="Address that signs every TEE attestation. Read from broker.inference.listService()."
          value={form.signingAddress}
          onChange={(v) => setForm({ ...form, signingAddress: v })}
        />
        <Field
          label="Provider address"
          help="0G Compute Direct-broker provider operating the TEE node."
          value={form.providerAddress}
          onChange={(v) => setForm({ ...form, providerAddress: v })}
        />
        <Field
          label="Price per call ($0G)"
          help="Buyer escrow per inference. Settlement splits 95% / 5%."
          value={form.pricePerCallOg}
          onChange={(v) => setForm({ ...form, pricePerCallOg: v })}
        />
        <div>
          <label className="block text-caption uppercase tracking-uppercase text-slate-ink font-mono mb-8">
            Target separated
          </label>
          <button
            type="button"
            onClick={() =>
              setForm({ ...form, targetSeparated: !form.targetSeparated })
            }
            className={
              "inline-flex items-center px-16 py-8 rounded-buttons font-mono text-caption tracking-caption " +
              (form.targetSeparated
                ? "bg-chartreuse-pulse text-midnight-navy font-medium"
                : "bg-pure-surface text-slate-ink border border-fog-border")
            }
          >
            {form.targetSeparated ? "true · TeeTLS" : "false · TeeML"}
          </button>
          <div className="mt-8 font-mono text-caption tracking-caption text-slate-ink">
            true = model upstream over TLS; false = model inside the TDX enclave.
          </div>
        </div>
      </div>
      <div className="mt-32 flex items-center justify-end gap-12">
        <button
          type="button"
          onClick={onNext}
          disabled={!valid}
          className="inline-flex items-center justify-center h-56 px-32 rounded-buttons bg-chartreuse-pulse text-midnight-navy text-body tracking-body font-medium [box-shadow:var(--shadow-cta-pill)] hover:brightness-[1.02] disabled:opacity-50 disabled:pointer-events-none"
        >
          Continue to bond →
        </button>
      </div>
    </Card>
  );
}

function Step2({
  form,
  isOnChain,
  inFlight,
  registerTxHash,
  registerConfirmed,
  bondTxHash,
  bondConfirmed,
  serviceId,
  registerError,
  bondError,
  onRegister,
  onRetry,
  onBack,
}: {
  form: FormState;
  isOnChain: boolean;
  inFlight: boolean;
  registerTxHash: Hex | undefined;
  registerConfirmed: boolean;
  bondTxHash: Hex | undefined;
  bondConfirmed: boolean;
  serviceId: bigint | null;
  registerError: Error | null;
  bondError: Error | null;
  onRegister: () => void;
  onRetry: () => void;
  onBack: () => void;
}) {
  const phase: "idle" | "registering" | "bonding" | "done" = !registerTxHash
    ? "idle"
    : !registerConfirmed
      ? "registering"
      : !bondTxHash || !bondConfirmed
        ? "bonding"
        : "done";
  const err = registerError ?? bondError;

  return (
    <Card variant="elevated" className="p-32">
      <div className="text-caption uppercase tracking-uppercase text-slate-ink font-mono mb-16">
        Step 2 of 3 · Stake bond + review
      </div>
      <div className="grid gap-12 grid-cols-[auto_1fr] text-caption">
        <span className="text-slate-ink">Display name</span>
        <span className="text-right font-mono text-midnight-navy">{form.displayName}</span>
        <span className="text-slate-ink">Model</span>
        <span className="text-right font-mono text-midnight-navy">{form.modelId}</span>
        <span className="text-slate-ink">Signing address</span>
        <span className="text-right font-mono text-midnight-navy">{form.signingAddress}</span>
        <span className="text-slate-ink">Provider address</span>
        <span className="text-right font-mono text-midnight-navy">{form.providerAddress}</span>
        <span className="text-slate-ink">Price per call</span>
        <span className="text-right font-mono text-midnight-navy">{form.pricePerCallOg} $0G</span>
        <span className="text-slate-ink">Target separated</span>
        <span className="text-right font-mono text-midnight-navy">{String(form.targetSeparated)}</span>
      </div>
      <div className="mt-32 pt-20 border-t border-fog-border/50">
        <div className="flex items-baseline justify-between gap-12">
          <span className="font-mono text-caption uppercase tracking-uppercase text-slate-ink">
            Bond required
          </span>
          <span className="font-mono text-body text-midnight-navy">
            5 $0G · MIN_BOND from SlashingArbiter
          </span>
        </div>
        <p className="mt-12 text-body leading-body tracking-body text-storm-gray">
          Your bond is at risk if your service submits invalid attestations.
          Slashed bonds redistribute 70% to the disputer, 20% to the protocol,
          the remainder burned.
        </p>
      </div>

      <PhaseStatus
        phase={phase}
        registerTxHash={registerTxHash}
        bondTxHash={bondTxHash}
        serviceId={serviceId}
      />

      {err ? (
        <div className="mt-16 p-16 bg-ghost-canvas rounded-cardssmall">
          <p className="font-mono text-caption tracking-caption text-midnight-navy">
            {err.message.slice(0, 300)}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-12 font-mono text-caption tracking-caption text-midnight-navy hover:text-chartreuse-pulse transition-colors"
          >
            Retry →
          </button>
        </div>
      ) : null}

      <div className="mt-32 flex items-center justify-between gap-12">
        <button
          type="button"
          onClick={onBack}
          disabled={inFlight}
          className="font-mono text-caption tracking-caption text-slate-ink hover:text-midnight-navy transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          ← Edit details
        </button>
        <button
          type="button"
          onClick={onRegister}
          disabled={!isOnChain || inFlight || phase !== "idle"}
          className="inline-flex items-center justify-center h-56 px-32 rounded-buttons bg-chartreuse-pulse text-midnight-navy text-body tracking-body font-medium [box-shadow:var(--shadow-cta-pill)] hover:brightness-[1.02] disabled:opacity-50 disabled:pointer-events-none"
        >
          {phase === "idle"
            ? "Register service + stake bond"
            : phase === "registering"
              ? "Registering (1/2)…"
              : phase === "bonding"
                ? "Staking bond (2/2)…"
                : "Done"}
        </button>
      </div>
    </Card>
  );
}

function PhaseStatus({
  phase,
  registerTxHash,
  bondTxHash,
  serviceId,
}: {
  phase: "idle" | "registering" | "bonding" | "done";
  registerTxHash: Hex | undefined;
  bondTxHash: Hex | undefined;
  serviceId: bigint | null;
}) {
  if (phase === "idle") return null;
  return (
    <div className="mt-20 p-16 bg-ghost-canvas rounded-cardssmall">
      <ul className="space-y-8 font-mono text-caption tracking-caption">
        <li className={phase === "registering" ? "text-midnight-navy" : "text-slate-ink"}>
          {phase === "registering" ? "→" : "✓"} registerService(...) {registerTxHash ? (
            <a
              href={`${PACT_EXPLORER_URL}/tx/${registerTxHash}`}
              target="_blank"
              rel="noreferrer"
              className="text-midnight-navy hover:text-chartreuse-pulse transition-colors"
            >
              {registerTxHash.slice(0, 12)}…{registerTxHash.slice(-6)} ↗
            </a>
          ) : null}
        </li>
        <li className={phase === "bonding" ? "text-midnight-navy" : phase === "done" ? "text-slate-ink" : "text-slate-ink"}>
          {phase === "bonding" ? "→" : phase === "done" ? "✓" : "·"} stakeBond({serviceId?.toString() ?? "…"}) {bondTxHash ? (
            <a
              href={`${PACT_EXPLORER_URL}/tx/${bondTxHash}`}
              target="_blank"
              rel="noreferrer"
              className="text-midnight-navy hover:text-chartreuse-pulse transition-colors"
            >
              {bondTxHash.slice(0, 12)}…{bondTxHash.slice(-6)} ↗
            </a>
          ) : null}
        </li>
      </ul>
    </div>
  );
}

function Step3({
  serviceId,
  registerTxHash,
  bondTxHash,
  onDashboard,
}: {
  serviceId: bigint;
  registerTxHash: Hex | undefined;
  bondTxHash: Hex | undefined;
  onDashboard: () => void;
}) {
  const marketplaceUrl = `/marketplace/${serviceId.toString()}`;
  return (
    <Card variant="elevated" className="p-32 text-center">
      <div className="text-caption uppercase tracking-uppercase text-slate-ink font-mono mb-16">
        Step 3 of 3 · Done
      </div>
      <h2 className="font-display font-normal text-heading-lg tracking-heading-lg leading-heading-lg text-midnight-navy">
        Service #{serviceId.toString()} registered. You&apos;re live.
      </h2>
      <div className="mt-24 font-mono text-caption tracking-caption text-slate-ink space-y-4">
        {registerTxHash ? (
          <div>
            registerService:{" "}
            <a
              href={`${PACT_EXPLORER_URL}/tx/${registerTxHash}`}
              target="_blank"
              rel="noreferrer"
              className="text-midnight-navy hover:text-chartreuse-pulse"
            >
              {registerTxHash.slice(0, 14)}…{registerTxHash.slice(-8)} ↗
            </a>
          </div>
        ) : null}
        {bondTxHash ? (
          <div>
            stakeBond:{" "}
            <a
              href={`${PACT_EXPLORER_URL}/tx/${bondTxHash}`}
              target="_blank"
              rel="noreferrer"
              className="text-midnight-navy hover:text-chartreuse-pulse"
            >
              {bondTxHash.slice(0, 14)}…{bondTxHash.slice(-8)} ↗
            </a>
          </div>
        ) : null}
      </div>
      <div className="mt-32 flex items-center justify-center gap-12 flex-wrap">
        <a
          href={marketplaceUrl}
          className="inline-flex items-center justify-center h-56 px-32 rounded-buttons bg-chartreuse-pulse text-midnight-navy text-body tracking-body font-medium [box-shadow:var(--shadow-cta-pill)]"
        >
          View on marketplace →
        </a>
        <button
          type="button"
          onClick={onDashboard}
          className="font-mono text-caption tracking-caption text-midnight-navy hover:text-chartreuse-pulse transition-colors"
        >
          ← Back to dashboard
        </button>
      </div>
    </Card>
  );
}

function Field({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-caption uppercase tracking-uppercase text-slate-ink font-mono mb-8">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full font-mono text-body tracking-body text-midnight-navy bg-ghost-canvas border border-fog-border/50 rounded-cardssmall px-16 py-12 focus:border-midnight-navy focus:outline-none"
      />
      <div className="mt-8 font-mono text-caption tracking-caption text-slate-ink">
        {help}
      </div>
    </div>
  );
}

function isFormValid(form: FormState): boolean {
  if (!form.displayName.trim()) return false;
  if (!form.modelId.trim()) return false;
  if (!/^0x[0-9a-fA-F]{40}$/.test(form.signingAddress)) return false;
  if (!/^0x[0-9a-fA-F]{40}$/.test(form.providerAddress)) return false;
  const price = Number(form.pricePerCallOg);
  if (!Number.isFinite(price) || price <= 0) return false;
  return true;
}

function extractServiceId(
  logs: ReadonlyArray<{ topics: ReadonlyArray<Hex>; data: Hex }>,
): bigint | null {
  // ServiceRegistered topic0:
  //   keccak256("ServiceRegistered(uint256,address,uint256,bytes32,address)")
  // = 0x... — we don't hardcode the hash; instead use viem's
  // decodeEventLog via the ABI. Imported lazily to keep the bundle
  // size small.
  for (const lg of logs) {
    try {
      // Dynamic require — keeps Module-not-found surface narrow.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { decodeEventLog } = require("viem") as typeof import("viem");
      const parsed = decodeEventLog({
        abi: PactRegistryAbi,
        data: lg.data,
        topics: [...lg.topics] as [Hex, ...Hex[]],
      });
      if (parsed.eventName === "ServiceRegistered") {
        const a = parsed.args as { serviceId: bigint };
        return a.serviceId;
      }
    } catch {
      // Not a PactRegistry log — skip.
    }
  }
  return null;
}
