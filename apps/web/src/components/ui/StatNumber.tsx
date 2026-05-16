import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/format";

/**
 * Display-scale statistic in the display serif (upright). Reserved for
 * oversized numeric heroes (lifetime volume, weighted score, etc.).
 * Antimetal-corrected: upright posture, no italic.
 */
export function StatNumber({
  className,
  children,
  size = "lg",
  ...rest
}: HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  const sizeClass = {
    md: "text-heading-lg leading-heading-lg tracking-heading-lg",
    lg: "text-display leading-display tracking-display",
    xl: "text-display leading-display tracking-display",
  }[size];
  return (
    <span
      className={cn(
        "font-display font-normal text-midnight-navy",
        sizeClass,
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
