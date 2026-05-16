import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/format";

/**
 * Sharp-cornered input. Antimetal explicitly contrasts pill buttons with
 * zero-radius inputs to signal "form contexts are intentionally more austere
 * than action contexts" (DESIGN.md Do/Don't).
 */
export function Input({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full bg-transparent text-midnight-navy placeholder:text-slate-ink",
        "border border-midnight-navy",
        "px-20 py-16 text-body leading-body tracking-body",
        "focus:outline-none focus:ring-2 focus:ring-chartreuse-pulse focus:ring-offset-2",
        "focus:ring-offset-ghost-canvas",
        className,
      )}
      {...rest}
    />
  );
}
