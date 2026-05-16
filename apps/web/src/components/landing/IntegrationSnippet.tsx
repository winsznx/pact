import type { ReactNode } from "react";

/**
 * "Three lines to verifiable inference" — code panel showing the @pact/sdk
 * happy-path. Sits between the 3-column features section and the
 * provenance line.
 *
 * The dark code panel uses the deep-cosmos surface (same colour as the hero
 * gradient's top stop) — a brief visual rhyme back to the hero that lands
 * before footer.
 *
 * Syntax highlighting is span-color tokens only (no Shiki/Prism dependency
 * for v0.1):
 *   - keywords (import, const, await, etc.) → ice-veil
 *   - strings → chartreuse-pulse
 *   - comments → slate-ink
 *   - identifiers → frost-white (default text color of the <pre>)
 *
 * All sizing/spacing/color resolves to design tokens.
 */

function Keyword({ children }: { children: ReactNode }) {
  return <span className="text-ice-veil">{children}</span>;
}

function Str({ children }: { children: ReactNode }) {
  return <span className="text-chartreuse-pulse">{children}</span>;
}

function Comment({ children }: { children: ReactNode }) {
  return <span className="text-slate-ink">{children}</span>;
}

function Line({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

export function IntegrationSnippet() {
  return (
    <section className="mx-auto w-full max-w-[var(--page-max-width)] px-24 pb-96">
      <div className="text-center mb-56">
        <div className="text-caption uppercase tracking-uppercase text-slate-ink mb-16 font-mono">
          For developers
        </div>
        <h2 className="font-display font-normal text-heading-lg tracking-heading-lg leading-heading-lg text-midnight-navy text-balance">
          Three lines to verifiable inference
        </h2>
      </div>

      <div className="bg-deep-cosmos rounded-cards p-32">
        <pre className="font-mono text-label leading-label tracking-label text-frost-white whitespace-pre-wrap break-words">
          <Line>
            <Keyword>import</Keyword> {"{ "}createPactClient{" } "}
            <Keyword>from</Keyword> <Str>{"'@pact/sdk'"}</Str>
          </Line>
          <Line>{" "}</Line>
          <Line>
            <Keyword>const</Keyword> client = createPactClient({"{ "}chain:{" "}
            <Str>{"'0G'"}</Str>
            {" }"})
          </Line>
          <Line>
            <Keyword>const</Keyword> job = <Keyword>await</Keyword>{" "}
            client.createJob({"{"}
          </Line>
          <Line>{"  "}serviceId: 1,</Line>
          <Line>
            {"  "}prompt:{" "}
            <Str>{"'Audit this contract for vulnerabilities'"}</Str>,
          </Line>
          <Line>
            {"  "}amount: <Str>{"'0.001'"}</Str>
          </Line>
          <Line>{"})"}</Line>
          <Line>
            <Keyword>const</Keyword> result = <Keyword>await</Keyword>{" "}
            job.waitForSettlement()
          </Line>
          <Line>{" "}</Line>
          <Line>
            <Comment>
              {"// result.attestation.signer === 0x4C1b546f...7ee8 ✓"}
            </Comment>
          </Line>
        </pre>
      </div>

      <div className="mt-16 text-center">
        <span className="font-mono text-caption tracking-caption text-slate-ink">
          @pact/sdk · npm install pact-sdk · TypeScript-first
        </span>
      </div>
    </section>
  );
}
