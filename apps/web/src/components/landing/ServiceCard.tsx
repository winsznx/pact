import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Hash } from "@/components/ui/Hash";

/**
 * Live preview of Service 1 — the smoke-tested demo seller registered in
 * PactRegistry on 2026-05-08. Real on-chain values, not mock data:
 *   - serviceId: 1
 *   - signing address: 0x4C1b546f5Fc11A9c2428eaFEd1D951Aa13C17ee8
 *   - provider: 0xd9966e13a6026Fcca4b13E7ff95c94DE268C471C
 *   - model: zai-org/GLM-5-FP8
 *   - capability: keccak256("smoke-test")
 *
 * Hard-coded for CHUNK 1 (no chain reads yet). CHUNK 4 will replace these
 * with live `useReadContract` calls against PactRegistry.getService(1).
 */
const G5_SIGNER = "0x4C1b546f5Fc11A9c2428eaFEd1D951Aa13C17ee8" as const;
const G5_PROVIDER = "0xd9966e13a6026Fcca4b13E7ff95c94DE268C471C" as const;

interface ServiceCardProps {
  /**
   * "detailed" (default) — full attestation/provider breakdown grid below
   *   the title block. Used by the landing-page showcase row.
   * "compact" — title + price block only, then a single footer line with
   *   reputation summary. Used in the marketplace grid where many cards
   *   need to scan-read at glance.
   */
  variant?: "detailed" | "compact";
}

export function ServiceCard({ variant = "detailed" }: ServiceCardProps = {}) {
  return (
    <Card variant="elevated" className="p-20">
      <div className="flex items-start justify-between gap-12">
        <div>
          <div className="flex items-center gap-8 text-caption text-slate-ink">
            <span className="font-mono">service #1</span>
            <Badge variant="live" className="text-caption px-8 py-4 leading-caption">
              live · 0G mainnet
            </Badge>
          </div>
          <div className="mt-8 text-heading-sm tracking-heading-sm font-medium text-midnight-navy">
            Code review · Solidity audit
          </div>
          <div className="text-sm text-slate-ink mt-4">
            zai-org/GLM-5-FP8 · TEE-attested via 0G Compute
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-caption uppercase tracking-uppercase text-slate-ink">
            per call
          </div>
          <div className="font-display text-heading leading-heading mt-4 text-midnight-navy">
            0.001
          </div>
          <div className="text-caption text-slate-ink font-mono">$0G</div>
        </div>
      </div>

      {variant === "detailed" ? (
        <div className="mt-16 grid grid-cols-[auto_1fr] gap-x-16 gap-y-8 text-caption items-center">
          <div className="text-slate-ink">signing address</div>
          <div className="text-right">
            <Hash value={G5_SIGNER} kind="address" />
          </div>
          <div className="text-slate-ink">0G provider</div>
          <div className="text-right">
            <Hash value={G5_PROVIDER} kind="address" />
          </div>
          <div className="text-slate-ink">target separated</div>
          <div className="text-right font-mono text-caption text-midnight-navy">
            true · TeeTLS
          </div>
          <div className="text-slate-ink">jobs settled</div>
          <div className="text-right font-mono text-caption text-midnight-navy">
            0
          </div>
        </div>
      ) : (
        <div className="mt-16 flex items-center justify-between font-mono text-caption tracking-caption text-slate-ink">
          <span>0 jobs settled · 0.000 $0G volume</span>
          <span className="text-chartreuse-pulse inline-flex items-center gap-4 transition-transform duration-300 group-hover:translate-x-1">
            View <span aria-hidden>↗</span>
          </span>
        </div>
      )}
    </Card>
  );
}
