import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/format";

type Variant = "chartreuse" | "darkSolid" | "darkGhost" | "lightGhost";
type Size = "md" | "lg" | "xl";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium select-none " +
  "transition-transform active:translate-y-[1px] disabled:opacity-50 disabled:pointer-events-none " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chartreuse-pulse " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-ghost-canvas";

const sizes: Record<Size, string> = {
  // `md` matches DESIGN.md chartreuse-CTA spec: ~40px vertical, 15px text,
  // 24px horizontal padding. Used in nav and product-UI moments.
  md: "h-40 px-24 text-button tracking-button",
  // `lg` for in-product moments where the CTA has the surface to itself
  // (job actions, modal primaries). Collapse h-12(48px) to 56px.
  lg: "h-56 px-28 text-body tracking-body",
  // `xl` for hero-scale CTAs sitting beneath the upright display
  // headline. Antimetal's actual hero CTAs are sized for proportional
  // weight against the headline, not the spec table — so this scales the
  // pill up without abandoning the type system. Collapse px-9(36px) to 32px.
  xl: "h-56 px-32 text-body tracking-body",
};

const variants: Record<Variant, string> = {
  // Chartreuse pill — primary CTA. Shadow stack from tokens.
  chartreuse:
    "bg-chartreuse-pulse text-midnight-navy " +
    "[box-shadow:var(--shadow-cta-pill)] hover:brightness-[1.02]",
  // Dark solid — used in nav against the dark hero background.
  darkSolid:
    "bg-deep-cosmos text-frost-white hover:bg-deep-cosmos",
  // Dark ghost — secondary on dark hero.
  darkGhost:
    "bg-transparent text-frost-white border border-ice-veil/60 " +
    "[box-shadow:var(--shadow-md-2)] hover:bg-white/5",
  // Light ghost — secondary on light surface.
  lightGhost:
    "bg-transparent text-midnight-navy " +
    "[box-shadow:var(--shadow-subtle)] hover:bg-white",
};

export function Button({
  variant = "chartreuse",
  size = "md",
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(base, sizes[size], variants[variant], className)}
      {...rest}
    >
      {children}
    </button>
  );
}
