import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/format";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** "live" gives the chartreuse fill; "neutral" is the floating pill. */
  variant?: "live" | "neutral";
  children: ReactNode;
}

export function Badge({
  variant = "neutral",
  className,
  children,
  ...rest
}: BadgeProps) {
  const variantClass =
    variant === "live"
      ? "bg-chartreuse-pulse text-midnight-navy"
      : "bg-pure-surface text-midnight-navy [box-shadow:var(--shadow-md)]";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-8 rounded-badges",
        // Padding matches DESIGN.md "Announcement Banner Pill" / "Badge Pill
        // (Floating)" spec: 12px vertical, 12px left, 20px right (we balance
        // to 16px horizontal — content uses gap-1.5 for the "New" prefix
        // pattern). 14px text per the abcdFont weight-450 spec.
        "px-16 py-12 text-sm tracking-sm font-medium",
        variantClass,
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
