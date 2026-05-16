import { Card } from "@/components/ui/Card";
import { Hash } from "@/components/ui/Hash";

/**
 * Conceptual preview of the captured G5 attestation payload — the bytes that
 * every settled job produces on chain. CHUNK 5 will hook this up to a real
 * verifier path with browser-side ECDSA recovery; for CHUNK 1 we display the
 * canonical 5-field text and signature shape so the moat is visible from the
 * landing page.
 *
 * Captured 2026-05-07 via scripts/day0/g5-direct-broker.ts (live mainnet,
 * provider 0xd9966e13...). See AGENT_PROGRESS for the full provenance.
 */
const CAPTURED_TEXT =
  "df0870f9b6a0bafc8223cebee0581160c6ea69876e57be3fa4e412450cd0b88e:0a2d1a40916f10253302e59bd1f1ea7dca6616fe4e816e3cd683310c5711eed6:centralized:openrouter:84c05f5412b2f6357c22c1fd3f9d345b9ac02e99254491a05b589b46570d3ba9";
const CAPTURED_SIG =
  "0x99946cf42f441ae8756cc899f74054926c8b9d4ae5b570499783da23ae73393a647dc0f9a188159876d1ba52b42bdc0b837ccaaf0ccf79b93449a16b1f9fab831c";
const CAPTURED_SIGNER = "0x4C1b546f5Fc11A9c2428eaFEd1D951Aa13C17ee8" as const;

export function AttestationReceipt() {
  return (
    <Card variant="elevated" className="p-20">
      <div className="flex items-center gap-8 text-caption text-slate-ink">
        <span className="font-mono">attestation receipt</span>
        <span className="font-mono text-caption text-chartreuse-pulse">
          ATTESTED → SETTLED
        </span>
      </div>

      <div className="mt-12">
        <div className="text-caption uppercase tracking-uppercase text-slate-ink mb-4">
          Canonical text (5-field colon-separated)
        </div>
        <div className="font-mono text-caption leading-subheading tracking-caption text-midnight-navy break-all bg-data-chip rounded-cardssmall px-12 py-12">
          {CAPTURED_TEXT.split(":").map((field, i, arr) => (
            <span key={i}>
              {field}
              {i < arr.length - 1 ? (
                <span className="text-chartreuse-pulse mx-0.5">:</span>
              ) : null}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-12 grid grid-cols-[auto_1fr] gap-x-16 gap-y-8 text-caption items-center">
        <div className="text-slate-ink">recovered signer</div>
        <div className="text-right">
          <Hash value={CAPTURED_SIGNER} kind="address" />
        </div>
        <div className="text-slate-ink">signature</div>
        <div className="text-right">
          <Hash value={CAPTURED_SIG} kind="tx" head={8} tail={6} />
        </div>
        <div className="text-slate-ink">verify</div>
        <div className="text-right font-mono text-caption text-midnight-navy">
          ECDSA + EIP-191 ·{" "}
          <span className="text-chartreuse-pulse">on-chain ✓</span>
        </div>
      </div>
    </Card>
  );
}
