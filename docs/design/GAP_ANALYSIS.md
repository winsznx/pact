# Gap Analysis: Antimetal vs. PACT

This document identifies the discrepancies between the live Antimetal site's computed styles (the canonical source of truth) and the current state of the PACT CHUNK 1 implementation (including the `DESIGN.md` and token files).

## 1. TOKEN GAPS
*These are computed values from the live site that are missing or mismatched in our current design token system.*

- **Hero Text Color (Warm Cream):** The live site uses `rgb(255, 247, 229)` for the hero headline, giving it a warm cream tone, whereas our tokens currently define `--color-frost-white` (`#fafeff`) or rely on pure white.
- **Hero Gradient Stops (P0):** The live site uses a 3-stop gradient (`#001033 0%, #0050f8 55%, #5fbdf7 100%`), creating a specific depth profile. If our current implementation uses a 2-stop gradient, this must be updated.
- **Body Text Opacity Derivation (P0):** Instead of using a solid hex code, the live site derives body text color in the hero via opacity (e.g., `rgba(224, 246, 255, 0.75)` which is `--color-ice-veil` at 75% opacity). Our system needs to accommodate this opacity usage rather than solid fallbacks.
- **Card Box-Shadow Stack (P0):** The live site's card elevation relies on a complex 4-layer shadow stack: `rgba(0, 39, 80, 0.03) 0px 56px 72px -16px, rgba(0, 39, 80, 0.03) 0px 32px 32px -16px, rgba(0, 39, 80, 0.04) 0px 6px 12px -3px, rgba(0, 39, 80, 0.04) 0px 0px 0px 1px`. Our current implementation is likely flatter.
- **CTA Pill Box-Shadow Stack (P0):** The primary CTA uses an extensive 7-layer stack including intricate inset highlights (`rgba(219, 247, 255, 0.48) 0px 0.5px 0.5px 0px inset`, etc.). We need to capture this exact stack in our tokens.
- **Headline Typography Scale:** The live computed headline is `46px` with a line-height of `1.04` and tracking of `-0.46px`. Our tokens currently list `48px` or `40px` sizes for display headers.

## 2. STRUCTURE GAPS
*These are architectural or layout patterns present on Antimetal that PACT has drifted from.*

- **Headline Posture (Italic vs. Upright) (P0):** Verification via Puppeteer confirms that the live Antimetal hero headline `font-style` is `normal` (upright). PACT's CHUNK 1 assumes an italic headline (`Instrument Serif italic`). This assumption is a significant visual gap.
- **Nav Height:** The live Antimetal sticky nav computes to `64px` in height. PACT's nav currently uses an `80px` (`h-20` / `--section-gap`) height, giving it too much breathing room relative to the source DNA.
- **Section Rhythm & Padding:** Antimetal strictly enforces an `80px` section padding and an `80px` inter-section gap.
- **Card Internal Spacing:** The cards use strict internal padding structures based on `8px` and `12px` base units, alongside a global `20px` card padding.

## 3. COMPONENT GAPS
*These are specific UI components or stylistic patterns that exist in Antimetal but are missing or incorrectly implemented in PACT.*

- **Hero Illustration Pattern:** The Antimetal hero features a glowing, white dot-matrix globe overlaid on the 3-stop blue gradient. PACT's hero lacks this specific atmospheric illustration layer.
- **Announcement Banner Pill:** Antimetal places a small, pill-shaped announcement badge directly above the hero headline. PACT needs this structural component implemented with the exact `9999px` radius, `#ffffff` fill, and outer shadow ring.
- **Secondary CTA Ghost Border:** The dark ghost button in the hero uses a precise inset shadow or border (`#e0f6ff` ice veil) with `12px` padding-x that must be perfectly replicated in our secondary CTA.
