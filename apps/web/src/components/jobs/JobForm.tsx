"use client";

import { keccak256, toBytes, formatEther } from "viem";
import { Card } from "@/components/ui/Card";
import { Hash } from "@/components/ui/Hash";

/**
 * Left column of /jobs/new — the prompt entry form + commitment preview
 * + cost breakdown.
 *
 * v0.1 plaintext. v0.2 wraps the prompt in ECIES via the seller's
 * pubkey from PactRegistry.getService().
 *
 * All sizing/spacing/color resolves to design tokens.
 */
interface JobFormProps {
  prompt: string;
  setPrompt: (s: string) => void;
  pricePerCallWei: bigint;
}

export function JobForm({ prompt, setPrompt, pricePerCallWei }: JobFormProps) {
  const inputCommitment =
    prompt.length > 0
      ? keccak256(toBytes(prompt))
      : ("0x0000000000000000000000000000000000000000000000000000000000000000" as const);

  const pricePerCall = formatEther(pricePerCallWei);
  // Protocol fee = 5% of pricePerCall. Held inside the escrow, split on
  // settle. Buyer's total escrow == pricePerCall.
  const protocolFeeWei = (pricePerCallWei * 500n) / 10_000n;
  const protocolFee = formatEther(protocolFeeWei);

  return (
    <Card variant="elevated" className="p-32">
      {/* Prompt input */}
      <div>
        <label className="block text-caption uppercase tracking-uppercase text-slate-ink font-mono mb-12">
          Your prompt
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Audit this Solidity contract for vulnerabilities…"
          className="w-full min-h-[var(--spacing-160)] p-16 font-mono text-body leading-body tracking-body text-midnight-navy bg-ghost-canvas border border-fog-border/50 focus:border-midnight-navy focus:outline-none rounded-cardssmall"
        />
        <div className="mt-8 flex items-center justify-between font-mono text-caption tracking-caption text-slate-ink">
          <span>{prompt.length} characters</span>
          <span>
            v0.1 plaintext · v0.2 ECIES-wrapped via seller pubkey
          </span>
        </div>
      </div>

      {/* Commitment preview — only when prompt non-empty */}
      {prompt.length > 0 ? (
        <div className="mt-32">
          <label className="block text-caption uppercase tracking-uppercase text-slate-ink font-mono mb-12">
            Input commitment
          </label>
          <Hash value={inputCommitment} kind="tx" head={10} tail={8} />
          <div className="mt-8 font-mono text-caption tracking-caption text-slate-ink">
            This hash is what gets escrowed on-chain.
          </div>
        </div>
      ) : null}

      {/* Cost breakdown */}
      <div className="mt-32 pt-24 border-t border-fog-border/50">
        <label className="block text-caption uppercase tracking-uppercase text-slate-ink font-mono mb-16">
          Cost
        </label>
        <div className="grid grid-cols-[auto_1fr] gap-x-24 gap-y-8 font-mono text-body tracking-body items-baseline">
          <span className="text-slate-ink">per call</span>
          <span className="text-right text-midnight-navy">
            {pricePerCall} $0G
          </span>
          <span className="text-slate-ink">protocol fee</span>
          <span className="text-right text-midnight-navy">
            {protocolFee} $0G <span className="text-slate-ink">(5%)</span>
          </span>
          <span className="text-slate-ink">total escrowed</span>
          <span className="text-right text-midnight-navy">
            {pricePerCall} $0G
          </span>
        </div>
        <div className="mt-12 font-mono text-caption tracking-caption text-slate-ink">
          5% fee retained on settlement. Refunded if expired.
        </div>
      </div>
    </Card>
  );
}
