"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useSwitchChain } from "wagmi";
import Link from "next/link";

import { ogMainnet } from "@/lib/wagmi";

/**
 * Sticky top nav. DESIGN.md "Sticky Navigation Bar":
 *   "deep-cosmos background. Logo left in frost-white. Center nav: abcdFont 15px
 *    weight 400, frost-white, letter-spacing -0.015em, 8px gap between items.
 *    Right: ghost pill ('Log in') ... ; filled pill ('Book a demo') with
 *    chartreuse fill, midnight-navy text, 9999px radius, padding 0 16px."
 *
 * The connect-wallet slot maps to the filled pill ('Book a demo' position),
 * so it must render in our design tokens — not RainbowKit's default blue
 * theme. We use ConnectButton.Custom to bypass RainbowKit's chrome and
 * compose the pill ourselves with the chartreuse-CTA style.
 *
 * Three production wallet states:
 *   1. Not connected    → chartreuse "Connect" pill (opens RainbowKit modal)
 *   2. Wrong chain      → chartreuse "Switch to 0G Mainnet" pill (wagmi
 *                         useSwitchChain, which itself delegates to
 *                         wallet_switchEthereumChain / addEthereumChain)
 *   3. Connected on 0G  → frost-white address pill with green dot indicator,
 *                         clicking opens the RainbowKit account modal
 */
const NAV_ITEMS: ReadonlyArray<{ label: string; href: string; external?: boolean }> = [
  { label: "Marketplace", href: "/marketplace" },
  { label: "Explore", href: "/explore" },
  { label: "Seller", href: "/seller" },
  { label: "Protocol", href: "https://github.com/winsznx/pact", external: true },
];

export function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 w-full bg-deep-cosmos/95 backdrop-blur supports-[backdrop-filter]:bg-deep-cosmos/80">
      <div className="mx-auto flex h-[var(--height-nav)] w-full max-w-[var(--page-max-width)] items-center justify-between px-24">
        <Link
          href="/"
          aria-label="PACT — home"
          className="flex items-center gap-10 text-frost-white tracking-button focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chartreuse-pulse focus-visible:ring-offset-2 focus-visible:ring-offset-deep-cosmos rounded-buttons px-4"
        >
          <svg
            aria-hidden
            viewBox="0 0 32 32"
            className="h-28 w-28 flex-shrink-0"
          >
            <path
              d="M 5 22 Q 16 9 27 22"
              stroke="#d0f100"
              strokeWidth="2.4"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="5" cy="22" r="1.9" fill="#d0f100" />
            <circle cx="27" cy="22" r="1.9" fill="#d0f100" />
            <circle cx="16" cy="8.5" r="3.4" fill="#d0f100" />
          </svg>
          <span className="text-lead font-medium">PACT</span>
          <span className="hidden sm:inline text-caption text-ice-veil/70 font-mono">
            0G mainnet · live
          </span>
        </Link>

        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-8 text-button text-frost-white tracking-button"
        >
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.label}
              href={item.href}
              external={item.external}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Mobile menu trigger — visible only at <md */}
        <button
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav-drawer"
          onClick={() => setMenuOpen((v) => !v)}
          className="md:hidden inline-flex items-center justify-center w-40 h-40 rounded-buttons text-frost-white hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chartreuse-pulse focus-visible:ring-offset-2 focus-visible:ring-offset-deep-cosmos transition-colors"
        >
          <span aria-hidden className="font-mono text-lead">
            {menuOpen ? "×" : "≡"}
          </span>
        </button>

        <div className="hidden md:flex">
          <WalletPills />
        </div>
      </div>

      {/* Mobile drawer — sits under the sticky nav bar */}
      {menuOpen ? (
        <div
          id="mobile-nav-drawer"
          className="md:hidden bg-deep-cosmos/95 backdrop-blur border-t border-white/5"
        >
          <nav
            aria-label="Mobile primary"
            className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-16 flex flex-col gap-12 text-button text-frost-white tracking-button"
          >
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.label}
                href={item.href}
                external={item.external}
                onNavigate={() => setMenuOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
            <div className="pt-12 border-t border-white/5">
              <WalletPills />
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

function WalletPills() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;
        const wrongChain = connected && chain.unsupported;
        const onChain = connected && !chain.unsupported;
        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none",
                userSelect: "none",
              },
            })}
            className="flex items-center gap-12"
          >
            {!connected ? (
              <ChartreusePill onClick={openConnectModal}>Connect</ChartreusePill>
            ) : null}
            {wrongChain ? <SwitchChainPill /> : null}
            {onChain ? (
              <ConnectedPill
                onClick={openAccountModal}
                label={account.displayName}
              />
            ) : null}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

/**
 * Chain-switch pill — calls wagmi useSwitchChain directly so the wallet
 * gets `wallet_switchEthereumChain` (or `wallet_addEthereumChain` on
 * first contact). We don't open the RainbowKit chain modal here because
 * we have exactly one supported chain — clicking "Switch to 0G Mainnet"
 * should just do the switch, not surface a chain picker.
 */
function SwitchChainPill() {
  const { switchChain, isPending } = useSwitchChain();
  return (
    <button
      type="button"
      onClick={() => switchChain({ chainId: ogMainnet.id })}
      disabled={isPending}
      className={
        "inline-flex items-center justify-center h-40 px-20 rounded-buttons " +
        "bg-chartreuse-pulse text-midnight-navy text-button font-medium tracking-button " +
        "[box-shadow:var(--shadow-cta-pill)] hover:brightness-[1.02] " +
        "transition-transform active:translate-y-[1px] " +
        "disabled:opacity-50 disabled:pointer-events-none"
      }
    >
      {isPending ? "Switching…" : "Switch to 0G Mainnet"}
    </button>
  );
}

/**
 * Connected pill — small green dot ('●') sits left of the truncated
 * address, signalling "you're on the right chain, wallet is live."
 * Address is rendered in mono since it's an address; the rest of the
 * pill uses the abcdFont (DM Sans) substitute.
 */
function ConnectedPill({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center gap-8 h-40 px-16 rounded-buttons " +
        "bg-pure-surface text-midnight-navy text-button font-medium tracking-button " +
        "[box-shadow:var(--shadow-md)] hover:brightness-[1.02] " +
        "transition-transform active:translate-y-[1px]"
      }
    >
      <span
        aria-hidden
        className="inline-block w-8 h-8 rounded-buttons bg-chartreuse-pulse pact-live-pulse"
      />
      <span className="font-mono">{label}</span>
    </button>
  );
}

function ChartreusePill({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center justify-center h-40 px-20 rounded-buttons " +
        "bg-chartreuse-pulse text-midnight-navy text-button font-medium tracking-button " +
        "[box-shadow:var(--shadow-cta-pill)] hover:brightness-[1.02] " +
        "transition-transform active:translate-y-[1px]"
      }
    >
      {children}
    </button>
  );
}

function NavLink({
  href,
  external,
  children,
  onNavigate,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
  onNavigate?: () => void;
}) {
  const className =
    "px-12 py-8 rounded-buttons hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chartreuse-pulse focus-visible:ring-offset-2 focus-visible:ring-offset-deep-cosmos transition-colors flex items-center";
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={className}
        onClick={onNavigate}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} onClick={onNavigate}>
      {children}
    </Link>
  );
}
