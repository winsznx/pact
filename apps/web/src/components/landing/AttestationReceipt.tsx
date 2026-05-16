import { Card } from "@/components/ui/Card";
import { Hash } from "@/components/ui/Hash";

/**
 * Conceptual preview of a captured G5 attestation payload — the bytes that
 * every settled job produces on chain.
 *
 * Layout: structured 5-field table instead of a single colon-mashed wall.
 * Each field shows its name (contentHash / usageHash / providerType /
 * providerIdentity / tlsCertFingerprint) with the corresponding hex
 * head…tail-elided so the receipt is scannable, not a paragraph of bytes.
 *
 * Captured 2026-05-07 via scripts/day0/g5-direct-broker.ts (live mainnet,
 * provider 0xd9966e13...). See AGENT_PROGRESS for the full provenance.
 */
const CAPTURED_TEXT =
  "df0870f9b6a0bafc8223cebee0581160c6ea69876e57be3fa4e412450cd0b88e:0a2d1a40916f10253302e59bd1f1ea7dca6616fe4e816e3cd683310c5711eed6:centralized:openrouter:84c05f5412b2f6357c22c1fd3f9d345b9ac02e99254491a05b589b46570d3ba9";
const CAPTURED_SIG =
  "0x99946cf42f441ae8756cc899f74054926c8b9d4ae5b570499783da23ae73393a647dc0f9a188159876d1ba52b42bdc0b837ccaaf0ccf79b93449a16b1f9fab831c";
const CAPTURED_SIGNER = "0x4C1b546f5Fc11A9c2428eaFEd1D951Aa13C17ee8" as const;

const FIELD_LABELS = [
  "contentHash",
  "usageHash",
  "providerType",
  "providerIdentity",
  "tlsCertFingerprint",
] as const;

/** Hex looks like an address/tx — middle-elide. Free-form (e.g. "centralized")
 *  shows as-is. */
function elideField(value: string): string {
  if (/^[0-9a-fA-F]{40,}$/.test(value)) {
    return `${value.slice(0, 8)}…${value.slice(-6)}`;
  }
  return value;
}

export function AttestationReceipt() {
  const fields = CAPTURED_TEXT.split(":");

  return (
    <Card variant="elevated" className="p-20">
      <div className="flex items-center justify-between gap-8 text-caption text-slate-ink">
        <span className="font-mono">attestation receipt</span>
        <span className="font-mono text-caption text-chartreuse-pulse">
          ATTESTED → SETTLED
        </span>
      </div>

      <div className="mt-16">
        <div className="text-caption uppercase tracking-uppercase text-slate-ink mb-8 font-mono">
          5-field canonical text
        </div>
        <div className="bg-data-chip rounded-cardssmall px-12 py-12">
          <dl className="grid grid-cols-[auto_1fr] gap-x-12 gap-y-6 font-mono text-caption leading-subheading tracking-caption">
            {fields.map((value, i) => {
              const label = FIELD_LABELS[i] ?? `field${i}`;
              return (
                <div key={label} className="contents">
                  <dt className="text-slate-ink">{label}</dt>
                  <dd className="text-midnight-navy text-right break-all">
                    {elideField(value)}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      </div>

      <div className="mt-16 grid grid-cols-[auto_1fr] gap-x-16 gap-y-8 text-caption items-center">
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
