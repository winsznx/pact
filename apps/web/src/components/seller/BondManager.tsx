"use client";

import { useEffect, useState } from "react";
import { formatEther } from "viem";
import { useChainId, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { PACT_ADDRESSES, PACT_EXPLORER_URL, SlashingArbiterAbi } from "@pact/shared";

import { ogMainnet } from "@/lib/wagmi";
import { type BondState, SELLER_CONSTANTS } from "@/lib/useSellerProfile";

/**
 * Inline bond manager for a single service. Renders one of four states
 * derived from the on-chain bond:
 *   locked              → "Request withdrawal" (7-day cooldown)
 *   withdrawal_pending  → countdown to withdrawable timestamp
 *   withdrawable        → "Withdraw N $0G"
 *   withdrawn           → "Re-stake 5 $0G"
 *
 * Contract surface gap (CHUNK 8 audit): SlashingArbiter has no
 * cancelWithdrawalRequest. Once `requestWithdrawal` is called the seller
 * is locked into the 7-day cooldown — they can't serve new jobs during
 * it (the contract uses `withdrawalUnlockAt != 0` as a "withdrawing"
 * flag). The UI surfaces this in the confirmation copy.
 *
 * All sizing/spacing/color resolves to design tokens.
 */
interface BondManagerProps {
  serviceId: bigint;
  bond: BondState;
  onRefetch: () => void;
}

const GAS_LEGACY = { gasPrice: 4_000_000_000n, type: "legacy" as const };

export function BondManager({ serviceId, bond, onRefetch }: BondManagerProps) {
  const chainId = useChainId();
  const isOnRightChain = chainId === ogMainnet.id;
  const [confirming, setConfirming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    writeContract,
    data: txHash,
    isPending: isSending,
    reset,
  } = useWriteContract();
  const { isLoading: isWaiting, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isConfirmed) {
      setConfirming(false);
      reset();
      onRefetch();
    }
  }, [isConfirmed, reset, onRefetch]);

  const onAction = (fn: "requestWithdrawal" | "withdrawBond" | "stakeBond") => {
    if (!isOnRightChain) return;
    setErrorMsg(null);
    if (fn === "requestWithdrawal" && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    const onError = (err: Error) => setErrorMsg(err.message.slice(0, 240));
    if (fn === "stakeBond") {
      writeContract(
        {
          address: PACT_ADDRESSES.SlashingArbiter,
          abi: SlashingArbiterAbi,
          functionName: "stakeBond",
          args: [serviceId],
          value: SELLER_CONSTANTS.MIN_BOND_WEI,
          ...GAS_LEGACY,
        },
        { onError },
      );
    } else if (fn === "withdrawBond") {
      writeContract(
        {
          address: PACT_ADDRESSES.SlashingArbiter,
          abi: SlashingArbiterAbi,
          functionName: "withdrawBond",
          args: [serviceId],
          ...GAS_LEGACY,
        },
        { onError },
      );
    } else {
      writeContract(
        {
          address: PACT_ADDRESSES.SlashingArbiter,
          abi: SlashingArbiterAbi,
          functionName: "requestWithdrawal",
          args: [serviceId],
          ...GAS_LEGACY,
        },
        { onError },
      );
    }
  };

  const explorerLink = txHash
    ? `${PACT_EXPLORER_URL}/tx/${txHash}`
    : null;

  return (
    <div className="mt-16 pt-16 border-t border-fog-border/50">
      <div className="flex items-center justify-between gap-12 flex-wrap">
        <BondLine bond={bond} />
        <ActionButton
          bond={bond}
          confirming={confirming}
          isPending={isSending || isWaiting}
          isOnRightChain={isOnRightChain}
          onAction={onAction}
          onCancelConfirm={() => setConfirming(false)}
        />
      </div>

      {confirming && bond.status === "locked" ? (
        <div className="mt-12 p-16 bg-ghost-canvas rounded-cardssmall">
          <p className="text-body leading-body tracking-body text-midnight-navy">
            Bond enters a 7-day cooldown. You can&apos;t serve new jobs
            during this period. SlashingArbiter has no cancel — once
            requested, only the timer ends it.
          </p>
          <div className="mt-12 flex items-center gap-12">
            <button
              type="button"
              onClick={() => onAction("requestWithdrawal")}
              className="inline-flex items-center justify-center h-40 px-20 rounded-buttons bg-chartreuse-pulse text-midnight-navy text-button tracking-button font-medium [box-shadow:var(--shadow-cta-pill)]"
            >
              Confirm withdrawal
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="font-mono text-caption tracking-caption text-slate-ink hover:text-midnight-navy transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {explorerLink ? (
        <div className="mt-12 font-mono text-caption tracking-caption text-slate-ink">
          tx: {" "}
          <a
            href={explorerLink}
            target="_blank"
            rel="noreferrer"
            className="text-midnight-navy hover:text-chartreuse-pulse transition-colors"
          >
            {txHash?.slice(0, 12)}…{txHash?.slice(-6)} ↗
          </a>
        </div>
      ) : null}

      {errorMsg ? (
        <div className="mt-12 font-mono text-caption tracking-caption text-midnight-navy">
          {errorMsg}
        </div>
      ) : null}
    </div>
  );
}

function BondLine({ bond }: { bond: BondState }) {
  if (bond.status === "locked") {
    return (
      <div className="font-mono text-caption tracking-caption text-slate-ink">
        <span className="text-midnight-navy">{formatEther(bond.amountWei)} $0G</span>
        {" locked · eligible to serve jobs"}
      </div>
    );
  }
  if (bond.status === "withdrawal_pending") {
    return (
      <div className="font-mono text-caption tracking-caption text-slate-ink">
        Withdrawal pending · available in {formatRemaining(bond.withdrawableAt)}
      </div>
    );
  }
  if (bond.status === "withdrawable") {
    return (
      <div className="font-mono text-caption tracking-caption text-slate-ink">
        <span className="text-chartreuse-pulse">{formatEther(bond.amountWei)} $0G</span>
        {" unlocked · withdraw to wallet"}
      </div>
    );
  }
  return (
    <div className="font-mono text-caption tracking-caption text-slate-ink">
      No active bond · service is suspended
    </div>
  );
}

function ActionButton({
  bond,
  confirming,
  isPending,
  isOnRightChain,
  onAction,
}: {
  bond: BondState;
  confirming: boolean;
  isPending: boolean;
  isOnRightChain: boolean;
  onAction: (
    fn: "requestWithdrawal" | "withdrawBond" | "stakeBond",
  ) => void;
  onCancelConfirm: () => void;
}) {
  const className =
    "inline-flex items-center justify-center h-40 px-20 rounded-buttons font-medium text-button tracking-button transition-transform disabled:opacity-50 disabled:pointer-events-none";

  const disabled = isPending || !isOnRightChain || confirming;

  if (bond.status === "locked") {
    return (
      <button
        type="button"
        onClick={() => onAction("requestWithdrawal")}
        disabled={disabled}
        className={`${className} bg-pure-surface text-midnight-navy [box-shadow:var(--shadow-md)] hover:text-chartreuse-pulse`}
      >
        {isPending ? "Working…" : "Request withdrawal"}
      </button>
    );
  }
  if (bond.status === "withdrawal_pending") {
    return (
      <span className="font-mono text-caption tracking-caption text-slate-ink">
        7-day cooldown · no action available
      </span>
    );
  }
  if (bond.status === "withdrawable") {
    return (
      <button
        type="button"
        onClick={() => onAction("withdrawBond")}
        disabled={disabled}
        className={`${className} bg-chartreuse-pulse text-midnight-navy [box-shadow:var(--shadow-cta-pill)] hover:brightness-[1.02]`}
      >
        {isPending ? "Withdrawing…" : `Withdraw ${formatEther(bond.amountWei)} $0G`}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onAction("stakeBond")}
      disabled={disabled}
      className={`${className} bg-chartreuse-pulse text-midnight-navy [box-shadow:var(--shadow-cta-pill)] hover:brightness-[1.02]`}
    >
      {isPending ? "Staking…" : "Re-stake 5 $0G"}
    </button>
  );
}

function formatRemaining(unlockAt: number): string {
  const now = Math.floor(Date.now() / 1000);
  const delta = Math.max(0, unlockAt - now);
  if (delta === 0) return "now";
  const d = Math.floor(delta / 86_400);
  const h = Math.floor((delta % 86_400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((delta % 3600) / 60);
  return `${h}h ${m}m`;
}
