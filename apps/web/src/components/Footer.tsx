import Link from "next/link";
import { PACT_ADDRESSES, PACT_EXPLORER_URL } from "@pact/shared";
import { Hash } from "@/components/ui/Hash";

/**
 * Footer prints the canonical mainnet addresses so anyone can verify the
 * deployment on chainscan without leaving the page. Reads directly from
 * @pact/shared so frontend cannot drift from the deployed manifest.
 */
export function Footer() {
  const items: Array<[string, keyof typeof PACT_ADDRESSES]> = [
    ["PactRegistry", "PactRegistry"],
    ["PactEscrow", "PactEscrow"],
    ["AttestationVerifier", "AttestationVerifier"],
    ["ReputationVault", "ReputationVault"],
    ["SlashingArbiter", "SlashingArbiter"],
    ["AgentNFT", "AgentNFT_proxy"],
  ];

  return (
    <footer className="mt-160 border-t border-fog-border/50 bg-ghost-canvas">
      <div className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-60">
        <div className="grid gap-56 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-12">
              <svg
                aria-hidden
                viewBox="0 0 32 32"
                className="h-36 w-36 flex-shrink-0"
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
              <div className="text-lead tracking-lead font-medium text-midnight-navy">
                PACT
              </div>
            </div>
            <p className="mt-12 text-sm text-slate-ink leading-sm tracking-sm max-w-xs">
              Provable Agent-to-Agent Compute Trust. Settlement protocol for
              AI-as-a-Service on 0G mainnet.
            </p>
          </div>

          <div>
            <div className="text-caption uppercase tracking-uppercase text-slate-ink">
              Mainnet contracts
            </div>
            <ul className="mt-12 space-y-8 text-caption">
              {items.map(([label, key]) => (
                <li key={key} className="flex items-center justify-between gap-8">
                  <span className="text-slate-ink">{label}</span>
                  <Hash value={PACT_ADDRESSES[key]} kind="address" />
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-caption uppercase tracking-uppercase text-slate-ink">
              Resources
            </div>
            <ul className="mt-12 space-y-8 text-sm text-midnight-navy">
              <li>
                <a
                  href={PACT_EXPLORER_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  0G ChainScan ↗
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/winsznx/pact"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  GitHub ↗
                </a>
              </li>
              <li>
                <a
                  href="https://explorer.trypact.xyz"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  Explorer ↗
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-56 border-t border-fog-border/50 pt-24 text-caption text-ash-medium font-mono tracking-caption">
          chainId 16661 · primary RPC https://evmrpc.0g.ai · explorer{" "}
          {PACT_EXPLORER_URL}
        </div>
      </div>
    </footer>
  );
}
