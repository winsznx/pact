// Next 15 generates an OG image PNG from this file at request time via
// the @vercel/og ImageResponse API (Satori under the hood). Output ships
// at /opengraph-image and is wired into <meta property="og:image">
// automatically; the twitter card inherits it via the metadata config in
// layout.tsx.
//
// Visual identity matches the live landing page verbatim:
//   - Hero gradient (deep-cosmos → electric blue → cyan, exact stops
//     from --gradient-hero-gradient)
//   - Dot-grid overlay (radial-gradient white dots, 22px tile — same
//     pattern Hero.tsx renders)
//   - Self-hosted Instrument Serif (display, upright) + DM Sans (body)
//     + DM Mono (caption) — same three faces the app ships
//   - Chartreuse-pulse accent (#d0f100) for the live indicator and stat
//     numerals; white announcement pill mirrors the in-page badge
//
// Satori doesn't support woff2 — we ship TTF variants under
// public/og-fonts/ specifically for this route. ~360KB total, only
// loaded by the edge OG handler, never reaching client bundles.

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "PACT — Settlement protocol for verifiable AI-as-a-Service on 0G mainnet";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Token-faithful colors (DESIGN.md / tokens.variables.css).
const COLOR_DEEP_COSMOS = "#001033";
const COLOR_CHARTREUSE = "#d0f100";
const COLOR_FROST = "#fafeff";
const COLOR_ICE_VEIL = "#e0f6ff";
const COLOR_MIDNIGHT_NAVY = "#1b2540";

export default async function Image() {
  // Load the same self-hosted fonts the live site uses. Satori needs TTF;
  // public/og-fonts/ ships the matching faces alongside the .woff2's
  // public/fonts/ uses for the runtime app.
  // Satori needs static (non-variable) TTFs — load 4 faces in parallel
  // from public/og-fonts/. Variable DM Sans was breaking the parser, so
  // we ship explicit 400 and 500 statics. All four are <100KB each.
  const [instrumentSerif, dmSans400, dmSans500, dmMono] = await Promise.all([
    fetch(new URL("../../public/og-fonts/instrument-serif-400.ttf", import.meta.url)).then(
      (r) => r.arrayBuffer(),
    ),
    fetch(new URL("../../public/og-fonts/dm-sans-400.ttf", import.meta.url)).then(
      (r) => r.arrayBuffer(),
    ),
    fetch(new URL("../../public/og-fonts/dm-sans-500.ttf", import.meta.url)).then(
      (r) => r.arrayBuffer(),
    ),
    fetch(new URL("../../public/og-fonts/dm-mono-400.ttf", import.meta.url)).then(
      (r) => r.arrayBuffer(),
    ),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          color: COLOR_FROST,
          fontFamily: "DM Sans",
          // Exact --gradient-hero-gradient stops from tokens.variables.css.
          background:
            "linear-gradient(180deg, #001033 0%, #0050f8 55%, #5fbdf7 100%)",
          position: "relative",
        }}
      >
        {/* Dot-grid overlay — same SVG pattern Hero.tsx renders client-side */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.18,
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.55) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />

        {/* Soft blue radial bleed behind the headline — atmospheric depth */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: "920px",
            height: "640px",
            background:
              "radial-gradient(50% 50%, rgba(95,189,247,0.40) 0%, rgba(0,128,248,0.18) 40%, rgba(248,249,252,0) 100%)",
            filter: "blur(72px)",
          }}
        />

        {/* TOP ROW: PACT lockup + live caption */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            {/* Recovery Arc mark — Satori inline SVG. No filters (Satori
                doesn't render feGaussianBlur reliably); the chartreuse
                strokes on the deep-cosmos plate carry the brand cleanly. */}
            <svg
              width="44"
              height="44"
              viewBox="0 0 32 32"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="32" height="32" rx="7" fill={COLOR_DEEP_COSMOS} />
              <path
                d="M 5 22 Q 16 9 27 22"
                stroke={COLOR_CHARTREUSE}
                strokeWidth="2.4"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="5" cy="22" r="1.7" fill={COLOR_CHARTREUSE} />
              <circle cx="27" cy="22" r="1.7" fill={COLOR_CHARTREUSE} />
              <circle cx="16" cy="8.5" r="3" fill={COLOR_CHARTREUSE} />
            </svg>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "12px",
              }}
            >
              <span style={{ fontSize: "32px", fontWeight: 500, color: COLOR_FROST }}>
                PACT
              </span>
              <span
                style={{
                  fontFamily: "DM Mono",
                  fontSize: "18px",
                  color: COLOR_ICE_VEIL,
                  opacity: 0.7,
                }}
              >
                0G mainnet · live
              </span>
            </div>
          </div>

          {/* Live pulse dot */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: COLOR_CHARTREUSE,
                boxShadow: `0 0 18px ${COLOR_CHARTREUSE}`,
              }}
            />
            <span
              style={{
                fontFamily: "DM Mono",
                fontSize: "16px",
                color: COLOR_ICE_VEIL,
                opacity: 0.85,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              chainId 16661
            </span>
          </div>
        </div>

        {/* CENTER: Announcement pill + upright display headline + subhead */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "28px",
            position: "relative",
            textAlign: "center",
          }}
        >
          {/* White announcement pill — DESIGN.md "Announcement Banner Pill" */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "12px 24px",
              borderRadius: "9999px",
              background: COLOR_FROST,
              color: COLOR_MIDNIGHT_NAVY,
              fontFamily: "DM Mono",
              fontSize: "18px",
              letterSpacing: "0.04em",
              boxShadow:
                "rgba(0, 39, 80, 0.08) 0px 6px 16px -3px, rgba(0, 39, 80, 0.04) 0px 0px 0px 1px",
            }}
          >
            live · 0G mainnet · 7 contracts deployed
          </div>

          {/* Upright display headline — Instrument Serif, no italic per DESIGN.md */}
          <div
            style={{
              display: "flex",
              fontFamily: "Instrument Serif",
              fontSize: "80px",
              lineHeight: 1.04,
              letterSpacing: "-0.02em",
              color: COLOR_FROST,
              maxWidth: "1000px",
              textWrap: "balance",
            }}
          >
            AI agents are about to become the largest economic actors in Web3.
          </div>

          <div
            style={{
              display: "flex",
              fontSize: "28px",
              color: COLOR_ICE_VEIL,
              opacity: 0.85,
              maxWidth: "880px",
              fontFamily: "DM Sans",
            }}
          >
            Today, no one can prove what model they ran. PACT does.
          </div>
        </div>

        {/* BOTTOM ROW: 4-stat live mainnet strip + URL right */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", gap: "44px" }}>
            <Stat value="7" label="contracts" />
            <Stat value="1" label="services live" />
            <Stat value="1" label="jobs settled" />
            <Stat value="5" label="$0G bonded" />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "10px",
              fontFamily: "DM Mono",
              fontSize: "26px",
              color: COLOR_ICE_VEIL,
            }}
          >
            <span style={{ color: COLOR_CHARTREUSE }}>→</span>
            trypact.xyz
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Instrument Serif", data: instrumentSerif, weight: 400, style: "normal" },
        { name: "DM Sans", data: dmSans400, weight: 400, style: "normal" },
        { name: "DM Sans", data: dmSans500, weight: 500, style: "normal" },
        { name: "DM Mono", data: dmMono, weight: 400, style: "normal" },
      ],
    },
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div
        style={{
          fontFamily: "Instrument Serif",
          fontSize: "56px",
          lineHeight: 1.04,
          color: COLOR_FROST,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: "DM Mono",
          fontSize: "13px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: COLOR_ICE_VEIL,
          opacity: 0.7,
        }}
      >
        {label}
      </div>
    </div>
  );
}
