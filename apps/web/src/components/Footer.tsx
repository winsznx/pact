import { PACT_ADDRESSES, PACT_EXPLORER_URL } from "@pact/shared";

/**
 * Footer is the brand cosmos band — the only place on the site beyond the
 * hero where we go deep-cosmos. The composition:
 *
 *   - Animated nebula gradient + chartreuse-flecked starfield as the
 *     ambient background (CSS-only, ~6KB, no external assets).
 *   - A giant low-opacity Recovery Arc bleeding off the right side, so
 *     the mark is the cosmic vibe — brand consistency.
 *   - Hero band at top with the wordmark + Instrument Serif italic
 *     tagline ("Trust the math. Pay the agent.").
 *   - 4-column grid: brand summary, mainnet contracts, resources, socials.
 *   - Bottom strip: chain config + signature link.
 *
 * Resources column links the SDK + MCP server + explorer subdomain.
 * Socials column carries x.com/trypact_ + GitHub + npm. All hover-tinted
 * to chartreuse-pulse for parity with the rest of the surface.
 */
export function Footer() {
  const contracts: Array<[string, keyof typeof PACT_ADDRESSES]> = [
    ["PactRegistry", "PactRegistry"],
    ["PactEscrow", "PactEscrow"],
    ["AttestationVerifier", "AttestationVerifier"],
    ["ReputationVault", "ReputationVault"],
    ["SlashingArbiter", "SlashingArbiter"],
    ["AgentNFT", "AgentNFT_proxy"],
  ];

  return (
    <footer className="relative mt-160 overflow-hidden bg-deep-cosmos text-frost-white">
      {/* Animated nebula — slow rotate + scale, 30s loop */}
      <div aria-hidden className="absolute inset-0 pact-footer-nebula pointer-events-none" />
      {/* Twinkling starfield — chartreuse-flecked, multi-layer */}
      <div aria-hidden className="absolute inset-0 pact-footer-stars pointer-events-none" />
      {/* Giant Recovery Arc bleeding off the right — the mark as ambient */}
      <svg
        aria-hidden
        viewBox="0 0 1024 1024"
        className="absolute -right-[280px] -bottom-[180px] h-[720px] w-[720px] opacity-[0.08] pointer-events-none"
      >
        <path
          d="M 160 720 Q 512 220 864 720"
          stroke="#d0f100"
          strokeWidth="42"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="160" cy="720" r="34" fill="#d0f100" />
        <circle cx="864" cy="720" r="34" fill="#d0f100" />
        <circle cx="512" cy="280" r="70" fill="#d0f100" />
      </svg>

      <div className="relative">
        {/* Hero band — wordmark + tagline */}
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 pt-100 pb-60 text-center">
          <div className="flex items-center justify-center gap-16">
            <svg
              aria-hidden
              viewBox="0 0 32 32"
              className="h-48 w-48 flex-shrink-0"
            >
              <rect width="32" height="32" rx="7" fill="#001033" />
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
            <span className="font-display text-heading-lg leading-heading-lg tracking-heading-lg text-frost-white">
              PACT
            </span>
          </div>
          <p className="mt-20 font-display italic text-heading-sm leading-heading-sm tracking-heading-sm text-ice-veil">
            Trust the math. Pay the agent.
          </p>
        </div>

        {/* 4-column information grid */}
        <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 pb-60">
          <div className="grid gap-48 md:grid-cols-2 lg:grid-cols-4">
            {/* Brand summary */}
            <div>
              <div className="text-caption uppercase tracking-uppercase text-ice-veil/70 font-mono">
                What this is
              </div>
              <p className="mt-12 text-sm leading-sm tracking-sm text-ice-veil/90">
                Settlement protocol for verifiable AI-as-a-Service on{" "}
                0G mainnet. Buyers pay sellers per inference. TEE attestation
                + ECDSA recovery guarantee model + execution. Reputation
                accrues to the seller&apos;s ERC-7857 INFT.
              </p>
            </div>

            {/* Contracts */}
            <div>
              <div className="text-caption uppercase tracking-uppercase text-ice-veil/70 font-mono">
                Mainnet contracts
              </div>
              <ul className="mt-12 space-y-8 text-caption">
                {contracts.map(([label, key]) => (
                  <li
                    key={key}
                    className="flex items-center justify-between gap-8"
                  >
                    <span className="text-ice-veil/80">{label}</span>
                    <a
                      href={`${PACT_EXPLORER_URL}/address/${PACT_ADDRESSES[key]}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-caption text-frost-white/85 hover:text-chartreuse-pulse transition-colors"
                    >
                      {shortAddress(PACT_ADDRESSES[key])} ↗
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Resources */}
            <div>
              <div className="text-caption uppercase tracking-uppercase text-ice-veil/70 font-mono">
                Resources
              </div>
              <ul className="mt-12 space-y-8 text-sm">
                <FooterLink href="https://docs.trypact.xyz">
                  Docs ↗
                </FooterLink>
                <FooterLink href={PACT_EXPLORER_URL}>
                  0G ChainScan ↗
                </FooterLink>
                <FooterLink href="https://explorer.trypact.xyz">
                  PACT Explorer ↗
                </FooterLink>
                <FooterLink href="https://api.trypact.xyz/v1/services">
                  Indexer API ↗
                </FooterLink>
                <FooterLink href="https://mcp.trypact.xyz/mcp">
                  Hosted MCP endpoint ↗
                </FooterLink>
                <FooterLink href="https://www.npmjs.com/package/@trypact/sdk">
                  @trypact/sdk on npm ↗
                </FooterLink>
                <FooterLink href="https://www.npmjs.com/package/@trypact/mcp-server">
                  @trypact/mcp-server on npm ↗
                </FooterLink>
              </ul>
            </div>

            {/* Socials */}
            <div>
              <div className="text-caption uppercase tracking-uppercase text-ice-veil/70 font-mono">
                Socials
              </div>
              <ul className="mt-12 space-y-8 text-sm">
                <FooterLink href="https://x.com/trypact_">
                  X / Twitter ↗
                </FooterLink>
                <FooterLink href="https://github.com/winsznx/pact">
                  GitHub ↗
                </FooterLink>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom strip */}
        <div className="border-t border-white/10">
          <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-24 text-caption font-mono tracking-caption text-ice-veil/55 flex items-center justify-between gap-16 flex-wrap">
            <span>
              chainId 16661 · primary RPC https://evmrpc.0g.ai · explorer{" "}
              {PACT_EXPLORER_URL}
            </span>
            <span className="text-ice-veil/45">
              built solo for 0G APAC Hackathon · 2026
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-ice-veil/90 hover:text-chartreuse-pulse transition-colors duration-300"
      >
        {children}
      </a>
    </li>
  );
}

function shortAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
