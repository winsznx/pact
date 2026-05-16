# Antimetal Inspection (Computed Styles)

## 1.1 NAV (sticky header)
- **Total height (px):** 64px
- **Background color:** `#001033` (`var(--color-deep-cosmos)`)
- **Logo:** `abcdFont`, 16px, weight 450, `#fafeff`
- **Center nav links:** `abcdFont`, 15px, weight 400, `#fafeff`, letter-spacing: `-0.015em`, gap: `8px`, padding: `0`
- **Right-side primary CTA pill:** height `40px`, padding-x `24px`, radius `9999px`, background `#d0f100`, text `#1b2540`, font size `15px`, weight `480`, box-shadow: `rgba(24, 37, 66, 0.32) 0px 1px 3px 0px, rgba(24, 37, 66, 0.12) 0px 0.5px 0.5px 0px, rgba(24, 37, 66, 0.44) 0px 12px 24px -12px, rgba(219, 247, 255, 0.06) 0px 8px 16px 0px inset, rgba(219, 247, 255, 0.48) 0px 0.5px 0.5px 0px inset, rgba(219, 247, 255, 0.04) 0px -4px 8px 0px inset, rgba(219, 247, 255, 0.24) 0px -0.5px 0.5px 0px inset`
- **Right-side secondary:** transparent fill, border/inset-box-shadow `#e0f6ff`, text `#fafeff`, padding-x `12px`, radius `9999px`
- **Total horizontal padding from viewport edge:** 24px

## 1.2 HERO
- **Total section padding:** top `120px`, bottom `120px`
- **Container max-width:** `1200px`
- **Layout:** Centered single column.
- **Announcement banner pill:** radius `9999px`, `#ffffff` fill, shadow `rgba(0,39,80,0.04) 0px 0px 0px 1px` as border, text `#1b2540`, 14px, weight 450, padding `12px 20px`, margin-bottom `28px`.
- **Headline:** `ivarTextFont`, 46px (Live computed) vs 48px (Refero spec), weight `400`, line-height `1.04`, letter-spacing `-0.46px`, color `rgb(255, 247, 229)` (Live computed) vs `#fafeff` (Refero spec), max-width `24ch`, text-align `center`.
- **Subheadline / lead:** `abcdFont`, `20px`, weight `400`, color `#e0f6ff`, line-height `1.3`, max-width `42ch`, margin-top `24px`.
- **Body paragraph:** `16px`, weight `400`, color `rgba(224, 246, 255, 0.75)`, line-height `1.5`, margin-top `12px`.
- **CTA group:** 2 CTAs, gap `12px`, centered.
- **Primary CTA:** height `40px`, padding-x `24px`, radius `9999px`, fill `#d0f100`, text `#1b2540`, `15px`, weight `480`.
- **Secondary CTA:** transparent fill, white text `#fafeff`, border shadow `#e0f6ff`, padding-x `12px`, radius `9999px`.
- **Background:** Gradient `linear-gradient(180deg, #001033 0%, #0050f8 55%, #5fbdf7 100%)`.
- **Illustration:** Glowing white dot-matrix globe overlaid on the blue gradient behind the centered text.

## 1.3 SECTIONS BELOW HERO
- **Section padding:** `80px` (top and bottom).
- **Background color:** `#f8f9fc` (Ghost Canvas).
- **Layout pattern:** Grid / Multi-column features with alternating text/image blocks.
- **Section headers (kicker):** uppercase mono, `13px`, letter-spacing `0.08em`, `#6b7184`.
- **Section titles:** `abcdFont`, `28px`, weight `480`, `#1b2540`.
- **Section body:** `16px`, weight `400`, `#596075`.
- **Distance between sections:** `80px`.

## 1.4 CARDS
- **Background:** `#ffffff`
- **Border-radius:** `20px`
- **Border / Shadow stack:** `rgba(0, 39, 80, 0.03) 0px 56px 72px -16px, rgba(0, 39, 80, 0.03) 0px 32px 32px -16px, rgba(0, 39, 80, 0.04) 0px 6px 12px -3px, rgba(0, 39, 80, 0.04) 0px 0px 0px 1px`
- **Padding:** `20px` on all sides.
- **Internal type scale:** Heading `22px` (weight 480), body `16px` (weight 400), labels `14px`.
- **Spacing within card:** Elements spaced by `8px` or `12px` base units.

## 1.5 FOOTER
- **Background:** `#f8f9fc` (Live computed shows a negative top margin `-130px` due to decorative SVG overlap with `padding-bottom: 129px`).
- **Padding:** Top/Bottom `60px` (effective internal spacing).
- **Columns layout:** 3-column link lists.
- **Link styles:** `16px`, `#6b7184` resting, hovering to `#1b2540`.
- **Rule:** Subtle 1px top border `rgba(0, 39, 80, 0.04)` or `#b1b5c0` (Fog Border).

---
**Delta Notes (Live vs Refero):**
- **Headline Size:** Refero catalogs `48px`, but Live site computed to `46px` with `-0.46px` tracking.
- **Headline Color:** Live computed `rgb(255, 247, 229)` (off-white yellowish), whereas Refero specifies pure white `#ffffff` or frost-white `#fafeff`.
- Canonical Live site values win, but for token naming we adapt semantic tokens like `--color-frost-white`.
