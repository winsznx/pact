"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  decodeEventLog,
  formatEther,
  keccak256,
  toBytes,
  type Hex,
  type Log,
} from "viem";
import { PactEscrowAbi, PACT_EXPLORER_URL } from "@pact/shared";

import { Card } from "@/components/ui/Card";
import { pactEscrowContract } from "@/lib/wagmi";

/**
 * Right column of /jobs/new — wallet status + submit button (state-aware)
 * + tx hash readout.
 *
 * State machine in this panel:
 *   A) wallet not connected   → ConnectButton.Custom rendered as our pill
 *   B) wallet connected, no prompt → disabled "Submit job" + hint
 *   C) wallet connected, has prompt → enabled "Submit job · X $0G"
 *   D) writeContract pending  → "Confirming…" with spinner
 *   E) tx hash known, waiting confirmation → "Reading new jobId…"
 *   F) success                → side-effect: localStorage prompt write +
 *                               router.push(/jobs/<id>)
 *   G) error                  → red-tinted button + retry
 *
 * v0.1: localStorage handoff for the seller agent. v0.2 wraps the prompt
 * in ECIES via the seller pubkey + posts to a Supabase queue.
 *
 * All sizing/spacing/color resolves to design tokens.
 */
interface JobActionPanelProps {
  prompt: string;
  serviceId: bigint;
  pricePerCallWei: bigint;
}

export function JobActionPanel({
  prompt,
  serviceId,
  pricePerCallWei,
}: JobActionPanelProps) {
  const router = useRouter();
  const { isConnected } = useAccount();
  const {
    writeContract,
    data: txHash,
    isPending: isWriting,
    isError: isWriteError,
    error: writeError,
    reset,
  } = useWriteContract();
  const {
    data: receipt,
    isLoading: isWaiting,
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({ hash: txHash });

  const [redirected, setRedirected] = useState(false);

  // On confirmation, parse JobCreated to extract jobId, persist prompt,
  // then navigate to the job detail page.
  useEffect(() => {
    if (!isConfirmed || !receipt || redirected) return;
    const jobId = extractJobId(receipt.logs);
    if (jobId === null) return;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`pact:prompt:${jobId.toString()}`, prompt);
    }
    setRedirected(true);
    router.push(`/jobs/${jobId.toString()}`);
  }, [isConfirmed, receipt, prompt, router, redirected]);

  const onSubmit = () => {
    if (!prompt) return;
    const inputCommitment = keccak256(toBytes(prompt));
    writeContract({
      ...pactEscrowContract,
      functionName: "createJob",
      args: [serviceId, inputCommitment, 3600n],
      value: pricePerCallWei,
    });
  };

  const buttonBase =
    "w-full inline-flex items-center justify-center h-56 px-32 rounded-buttons text-body tracking-body font-medium transition-transform";

  return (
    <Card variant="elevated" className="p-32 lg:sticky lg:top-72">
      {!isConnected ? (
        <>
          <div className="text-caption uppercase tracking-uppercase text-slate-ink font-mono mb-16">
            Wallet
          </div>
          <p className="text-body leading-body tracking-body text-storm-gray mb-24">
            Connect a wallet on 0G mainnet to escrow funds and create a job.
          </p>
          <ConnectButton.Custom>
            {({ openConnectModal, mounted }) =>
              mounted ? (
                <button
                  type="button"
                  onClick={openConnectModal}
                  className={`${buttonBase} bg-chartreuse-pulse text-midnight-navy [box-shadow:var(--shadow-cta-pill)] hover:brightness-[1.02] active:translate-y-[1px]`}
                >
                  Connect wallet
                </button>
              ) : null
            }
          </ConnectButton.Custom>
        </>
      ) : (
        <>
          <div className="text-caption uppercase tracking-uppercase text-slate-ink font-mono mb-16">
            Submit
          </div>

          <button
            type="button"
            onClick={onSubmit}
            disabled={!prompt || isWriting || isWaiting || redirected}
            className={
              isWriteError
                ? `${buttonBase} bg-pure-surface border border-fog-border text-midnight-navy`
                : `${buttonBase} bg-chartreuse-pulse text-midnight-navy [box-shadow:var(--shadow-cta-pill)] hover:brightness-[1.02] active:translate-y-[1px] disabled:opacity-50 disabled:pointer-events-none`
            }
          >
            {renderButtonLabel({
              isWriting,
              isWaiting,
              redirected,
              isWriteError,
              hasPrompt: prompt.length > 0,
              pricePerCallWei,
            })}
          </button>

          <div className="mt-12 text-center font-mono text-caption tracking-caption text-slate-ink min-h-[var(--spacing-20)]">
            {!prompt
              ? "Enter your prompt above"
              : isWriting
                ? "Sign the transaction in your wallet…"
                : isWaiting && txHash
                  ? "Waiting for confirmation on 0G mainnet…"
                  : redirected
                    ? "Redirecting to job page…"
                    : "Funds locked in PactEscrow on confirm"}
          </div>

          {txHash ? (
            <div className="mt-20 pt-20 border-t border-fog-border/50">
              <div className="text-caption uppercase tracking-uppercase text-slate-ink font-mono mb-8">
                Transaction
              </div>
              <a
                href={`${PACT_EXPLORER_URL}/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-caption tracking-caption text-midnight-navy hover:text-chartreuse-pulse transition-colors break-all"
              >
                {txHash}
              </a>
            </div>
          ) : null}

          {isWriteError ? (
            <div className="mt-20 pt-20 border-t border-fog-border/50">
              <p className="text-body leading-body tracking-body text-midnight-navy">
                {writeError?.message?.slice(0, 200) ?? "Transaction failed"}
              </p>
              <button
                type="button"
                onClick={() => reset()}
                className="mt-12 font-mono text-caption tracking-caption text-midnight-navy hover:text-chartreuse-pulse transition-colors"
              >
                Retry →
              </button>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}

function renderButtonLabel({
  isWriting,
  isWaiting,
  redirected,
  isWriteError,
  hasPrompt,
  pricePerCallWei,
}: {
  isWriting: boolean;
  isWaiting: boolean;
  redirected: boolean;
  isWriteError: boolean;
  hasPrompt: boolean;
  pricePerCallWei: bigint;
}) {
  if (isWriteError) return "Try again";
  if (redirected) return "Done →";
  if (isWaiting) return "Reading new jobId…";
  if (isWriting) return "Confirming…";
  if (!hasPrompt) return "Submit job";
  return `Submit job · ${formatEther(pricePerCallWei)} $0G`;
}

/**
 * Find the JobCreated log in a tx receipt and return the indexed jobId.
 * Returns null when no JobCreated log is present (shouldn't happen on a
 * successful createJob receipt, but guard defensively rather than crash).
 */
function extractJobId(logs: ReadonlyArray<Log>): bigint | null {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: PactEscrowAbi,
        data: log.data as Hex,
        topics: log.topics,
      });
      if (decoded.eventName === "JobCreated") {
        // jobId is the first indexed arg.
        const args = decoded.args as { jobId: bigint };
        return args.jobId;
      }
    } catch {
      // Not a PactEscrow event — skip.
    }
  }
  return null;
}
