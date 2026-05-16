import { Card } from "@/components/ui/Card";
import { MonoCode } from "@/components/ui/MonoCode";

/**
 * "How a PACT job settles" — 3-step state machine visualisation.
 * Pending → Attested → Settled.
 *
 * Layout: 3 elevated cards in a row at lg, stacked on mobile. Each card
 * carries a large chartreuse step numeral (upright serif, --text-display)
 * at top-left, then card-heading title, body description, and a MonoCode
 * line showing the actual SDK call.
 *
 * Arrows between cards (lg+ only) hint at the directional flow without a
 * heavy connector graphic — caption-size chartreuse arrows.
 *
 * All sizing/spacing/color resolves to design tokens.
 */
const STEPS: ReadonlyArray<{
  num: string;
  title: string;
  body: string;
  code: string;
}> = [
  {
    num: "1",
    title: "Buyer creates job",
    body: "Buyer escrows $0G via PactEscrow.createJob(serviceId, inputCommitment). Funds locked. State: Pending.",
    code: 'createJob(1, "0x9b2a…", { value: parseEther("0.001") })',
  },
  {
    num: "2",
    title: "Seller submits attestation",
    body: "Seller calls submitAttestation(jobId, text, signature) with TEE-signed inference proof. Verifier recovers signer on-chain.",
    code: 'submitAttestation(jobId, "df0870…", "0x99946…")',
  },
  {
    num: "3",
    title: "Settlement",
    body: "Verified attestation triggers atomic settlement. 95% to seller, 5% protocol fee, reputation increments on the seller's INFT.",
    code: "emit JobSettled(jobId, seller, 0.00095 ether)",
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto w-full max-w-[var(--page-max-width)] px-24 py-96">
      <div className="text-center mb-56">
        <div className="text-caption uppercase tracking-uppercase text-slate-ink mb-16 font-mono">
          Job lifecycle
        </div>
        <h2 className="font-display font-normal text-heading-lg tracking-heading-lg leading-heading-lg text-midnight-navy text-balance">
          How a PACT job settles
        </h2>
      </div>

      {/* Cards row. lg+ uses a true 3-col grid with chartreuse arrow
          connectors between cards via the `relative` + absolute pattern. */}
      <div className="grid gap-24 lg:grid-cols-3 items-stretch">
        {STEPS.map((step, i) => (
          <div key={step.num} className="relative">
            <Card variant="elevated" className="p-20 h-full">
              <div className="flex items-baseline gap-12">
                <span className="font-display text-display leading-display tracking-display text-chartreuse-pulse">
                  {step.num}
                </span>
                <span className="text-caption uppercase tracking-uppercase text-slate-ink font-mono">
                  Step
                </span>
              </div>
              <h3 className="mt-16 text-heading-sm tracking-heading-sm leading-heading-sm font-medium text-midnight-navy">
                {step.title}
              </h3>
              <p className="mt-12 text-body leading-body tracking-body text-storm-gray">
                {step.body}
              </p>
              <div className="mt-20">
                <MonoCode className="break-all">{step.code}</MonoCode>
              </div>
            </Card>

            {/* Arrow connector to next card — only at lg+ between consecutive
                cards, never after the last one. Pure CSS chartreuse caret. */}
            {i < STEPS.length - 1 ? (
              <span
                aria-hidden
                className="hidden lg:flex absolute top-1/2 -right-12 -translate-y-1/2 text-chartreuse-pulse text-heading-sm"
              >
                →
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
