import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/format";

/**
 * Inline code chip in DM Mono. The ~invisible blue tint background and
 * small radius signal "structural grouping" rather than emphasis.
 * Used for addresses, hashes, and any technical inline label.
 */
export function MonoCode({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-mono text-caption tracking-caption",
        "bg-data-chip rounded-cardssmall px-8 py-4",
        "text-midnight-navy",
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
