"use client";

// CHUNK 8 — full seller experience. Replaces CHUNK 6's placeholder.
//
// Three render branches:
//   1. !isConnected           → DisconnectedView (Connect prompt)
//   2. !isOnRightChain        → switch-chain prompt
//   3. !isSeller              → OnboardingFlow
//   4. isSeller               → DashboardView
//
// Demo override: when NEXT_PUBLIC_DEMO_MOCK === "1" AND ?demoAddress=0x...
// is in the URL, the wallet check is bypassed and the dashboard reads
// the supplied address directly. Used to screenshot the dashboard
// without an attached wallet in headless captures. Disabled in
// production by default.

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId, useSwitchChain } from "wagmi";

import { ogMainnet } from "@/lib/wagmi";
import { useSellerProfile } from "@/lib/useSellerProfile";
import { Card } from "@/components/ui/Card";
import { DashboardView } from "@/components/seller/DashboardView";
import { OnboardingFlow } from "@/components/seller/OnboardingFlow";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export default function SellerPage() {
  return (
    <Suspense fallback={null}>
      <SellerInner />
    </Suspense>
  );
}

function SellerInner() {
  const search = useSearchParams();
  const account = useAccount();
  const chainId = useChainId();

  const mockEnabled = process.env.NEXT_PUBLIC_DEMO_MOCK === "1";
  const demoAddress = mockEnabled ? search.get("demoAddress") : null;
  const mockState = mockEnabled ? search.get("mockState") : null;
  const forceOnboarding =
    search.get("action") === "register" || mockState === "fresh";

  const effectiveAddress = (demoAddress ?? account.address) as
    | `0x${string}`
    | undefined;
  const isConnected = !!demoAddress || account.isConnected;
  const isOnRightChain = !!demoAddress || chainId === ogMainnet.id;

  const profile = useSellerProfile(
    isConnected && isOnRightChain ? effectiveAddress : undefined,
  );

  if (!isConnected) {
    return <DisconnectedView />;
  }

  if (!isOnRightChain) {
    return <WrongChainView />;
  }

  if (profile.isLoading) {
    return <LoadingView />;
  }

  if (forceOnboarding || !profile.data || !profile.data.isSeller) {
    return <OnboardingFlow onComplete={() => profile.refetch()} />;
  }

  return (
    <DashboardView
      address={effectiveAddress as `0x${string}`}
      profile={profile.data}
      onRefetch={() => profile.refetch()}
    />
  );
}

function DisconnectedView() {
  return (
    <section className="bg-ghost-canvas">
      <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 pt-120 pb-72 text-center">
        <div className="text-caption uppercase tracking-uppercase text-slate-ink mb-16 font-mono">
          Seller · 0G mainnet
        </div>
        <h1 className="font-display font-normal text-display leading-display tracking-display text-midnight-navy text-balance">
          Connect to manage your services
        </h1>
        <p className="mt-24 text-lead leading-lead tracking-lead text-storm-gray max-w-prose mx-auto">
          Sellers stake a 5 $0G bond, mint an ERC-7857 Agent INFT, and
          start serving inferences. Reputation accrues to the INFT —
          sell the agent, sell the reputation.
        </p>
        <div className="mt-40 flex justify-center">
          <ConnectButton.Custom>
            {({ openConnectModal, mounted }) =>
              mounted ? (
                <button
                  type="button"
                  onClick={openConnectModal}
                  className="inline-flex items-center justify-center h-56 px-32 rounded-buttons bg-chartreuse-pulse text-midnight-navy text-body tracking-body font-medium [box-shadow:var(--shadow-cta-pill)] hover:brightness-[1.02] active:translate-y-[1px] transition-transform"
                >
                  Connect wallet
                </button>
              ) : null
            }
          </ConnectButton.Custom>
        </div>
      </div>
    </section>
  );
}

function WrongChainView() {
  const { switchChain, isPending } = useSwitchChain();
  return (
    <section className="bg-ghost-canvas">
      <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 pt-120 pb-72 text-center">
        <div className="text-caption uppercase tracking-uppercase text-slate-ink mb-16 font-mono">
          Wrong network
        </div>
        <h1 className="font-display font-normal text-display leading-display tracking-display text-midnight-navy text-balance">
          Switch to 0G Mainnet
        </h1>
        <p className="mt-24 text-lead leading-lead tracking-lead text-storm-gray max-w-prose mx-auto">
          PACT is deployed on 0G mainnet (chainId 16661). Switch your
          wallet to continue.
        </p>
        <div className="mt-40 flex justify-center">
          <button
            type="button"
            onClick={() => switchChain({ chainId: ogMainnet.id })}
            disabled={isPending}
            className="inline-flex items-center justify-center h-56 px-32 rounded-buttons bg-chartreuse-pulse text-midnight-navy text-body tracking-body font-medium [box-shadow:var(--shadow-cta-pill)] hover:brightness-[1.02] disabled:opacity-50 disabled:pointer-events-none transition-transform"
          >
            {isPending ? "Switching…" : "Switch to 0G Mainnet"}
          </button>
        </div>
      </div>
    </section>
  );
}

function LoadingView() {
  return (
    <section className="bg-ghost-canvas">
      <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 pt-120 pb-72 text-center">
        <p className="font-mono text-caption tracking-caption text-slate-ink">
          Reading your services from PactRegistry…
        </p>
      </div>
    </section>
  );
}
