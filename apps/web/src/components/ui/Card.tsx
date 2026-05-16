import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/format";

type Variant = "elevated" | "section" | "data";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  children: ReactNode;
}

const base = "transition-shadow";
const variants: Record<Variant, string> = {
  // Elevated white card — primary product UI showcase.
  // 20px radius, layered blue-tinted shadow stack acts as the border.
  elevated:
    "bg-pure-surface rounded-cards [box-shadow:var(--shadow-card-elevated)]",
  // Recessed grouping container on the ghost canvas.
  // Uses 16px radius and the 1-step gray difference for separation.
  section: "bg-ghost-canvas rounded-cardsmedium",
  // Inline code/data chip — barely-there tint.
  data: "bg-data-chip rounded-cardssmall",
};

export function Card({
  variant = "elevated",
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div className={cn(base, variants[variant], className)} {...rest}>
      {children}
    </div>
  );
}
