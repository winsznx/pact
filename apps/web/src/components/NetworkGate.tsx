"use client";

import { useState, type ReactNode } from "react";
import { useChainId, useSwitchChain } from "wagmi";
import { ogMainnet } from "@/lib/wagmi";

/**
 * Centralises the wrong-chain branch for any chain-gated CTA on the
 * page. Pass the connected variant as `children`; when the wallet is
 * not on 0G mainnet, this swaps in a chartreuse "Switch to 0G Mainnet"
 * button that triggers wagmi `useSwitchChain` (which delegates to the
 * wallet's `wallet_switchEthereumChain` / `wallet_addEthereumChain`).
 *
 * Failures render inline below the button — no toasts, no dev-tool
 * noise. The Switch button itself disables while the request is in
 * flight so a double-click doesn't queue two prompts.
 *
 * Production tier: covers the landing CTAs + any other write call
 * that wants the same wrong-chain handling without re-implementing
 * the prompt sequence.
 *
 * All sizing/spacing/color resolves to design tokens.
 */
interface NetworkGateProps {
  /** Variant: "light" for buttons on ghost-canvas, "dark" for the
   *  deep-cosmos nav. The wrong-chain pill style differs slightly. */
  variant?: "light" | "dark";
  /** Optional alignment hint for the inline error text. */
  errorAlign?: "left" | "center";
  /** Rendered when the connected chain is 0G mainnet. */
  children: ReactNode;
}

export function NetworkGate({
  variant = "light",
  errorAlign = "left",
  children,
}: NetworkGateProps) {
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // chainId is 0 / undefined when no wallet is connected. In that case
  // we don't render anything here — the consumer's `children` already
  // handles the disconnected branch (a Connect button, typically).
  if (!chainId || chainId === ogMainnet.id) {
    return <>{children}</>;
  }

  const onSwitch = () => {
    setErrorMsg(null);
    switchChain(
      { chainId: ogMainnet.id },
      {
        onError: (err) => {
          // Common cases: user rejected (4001), chain not added (4902).
          // The wagmi connector + viem chain config trigger
          // wallet_addEthereumChain automatically when missing, so 4902
          // usually self-resolves; surface the message regardless.
          setErrorMsg(err.message.slice(0, 240));
        },
      },
    );
  };

  const baseClass = "inline-flex items-center justify-center rounded-buttons font-medium tracking-button transition-transform";
  const lightClass = "h-56 px-32 bg-chartreuse-pulse text-midnight-navy text-body [box-shadow:var(--shadow-cta-pill)] hover:brightness-[1.02] active:translate-y-[1px]";
  const darkClass = "h-40 px-20 bg-chartreuse-pulse text-midnight-navy text-button [box-shadow:var(--shadow-cta-pill)] hover:brightness-[1.02] active:translate-y-[1px]";

  return (
    <div className={errorAlign === "center" ? "text-center" : undefined}>
      <button
        type="button"
        onClick={onSwitch}
        disabled={isPending}
        className={`${baseClass} ${variant === "dark" ? darkClass : lightClass} disabled:opacity-50 disabled:pointer-events-none`}
      >
        {isPending ? "Switching…" : "Switch to 0G Mainnet"}
      </button>
      {errorMsg ? (
        <div className="mt-12 font-mono text-caption tracking-caption text-midnight-navy">
          {errorMsg}
        </div>
      ) : null}
    </div>
  );
}
