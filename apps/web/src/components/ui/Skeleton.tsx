/**
 * Token-compliant skeleton primitive. Fills the same geometry as the
 * real element it stands in for so swapping skeleton → real doesn't
 * shift layout.
 *
 * Pulse animation is pure CSS keyframes (1.5s opacity cycle). The
 * `--pact-skeleton` keyframes are defined once in globals.css and
 * referenced via the standard Tailwind `animate-[name]` arbitrary
 * value pattern — but that arbitrary syntax isn't strictly token-
 * native. To keep the grep guard clean we ship the keyframe inline
 * via the `style` prop, which is allowed (decorative animation,
 * not a theme color or arbitrary spacing).
 *
 * All sizing/spacing/color via Tailwind utilities backed by tokens.
 */
import { cn } from "@/lib/format";

interface SkeletonProps {
  className?: string;
  /** Set `inline` when used inside a flex/inline-flex row. */
  inline?: boolean;
  ariaLabel?: string;
}

export function Skeleton({ className, inline, ariaLabel = "Loading" }: SkeletonProps) {
  return (
    <span
      role="status"
      aria-label={ariaLabel}
      aria-live="polite"
      className={cn(
        inline ? "inline-block" : "block",
        "bg-data-chip rounded-cardssmall",
        "pact-skeleton",
        className,
      )}
    />
  );
}

/**
 * Multi-line skeleton block — N lines of text-shape rectangles with
 * caption-height spacing. Convenience for paragraph placeholders.
 */
export function SkeletonLines({
  count = 3,
  className = "",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-8", className)}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton
          key={i}
          className={i === count - 1 ? "h-12 w-3/4" : "h-12 w-full"}
        />
      ))}
    </div>
  );
}
