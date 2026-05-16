"use client";

import { useEffect, useRef, useState } from "react";

/**
 * requestAnimationFrame count-up. On mount it counts from 0 to `value`
 * over `durationMs`. On subsequent prop changes it counts from the
 * previous displayed value to the new target — so a live-updating stats
 * row interpolates between snapshots rather than snapping.
 *
 * Respects `prefers-reduced-motion`: no animation, just the final value.
 *
 * `formatter` runs on the interpolated float each frame; default rounds
 * to integer and locale-groups (e.g. `1,234`). Pass a custom formatter
 * for decimals (`(n) => n.toFixed(2)`) or units.
 *
 * SSR safety: this component only renders inside client-only contexts
 * (loading state shows a Skeleton, then this swaps in), so there's no
 * hydration mismatch — the count-up starts from 0 on its first client
 * paint.
 */
interface AnimatedNumberProps {
  value: number | bigint;
  durationMs?: number;
  formatter?: (n: number) => string;
  className?: string;
}

const DEFAULT_FORMATTER = (n: number) => Math.round(n).toLocaleString();

export function AnimatedNumber({
  value,
  durationMs = 900,
  formatter = DEFAULT_FORMATTER,
  className,
}: AnimatedNumberProps) {
  const target = typeof value === "bigint" ? Number(value) : value;
  const [display, setDisplay] = useState<number>(0);
  const fromRef = useRef<number>(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplay(target);
      return;
    }
    fromRef.current = display;
    startRef.current = performance.now();
    const step = (t: number) => {
      const elapsed = t - (startRef.current ?? t);
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const next = fromRef.current + (target - fromRef.current) * eased;
      setDisplay(next);
      if (progress < 1) rafRef.current = window.requestAnimationFrame(step);
    };
    rafRef.current = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafRef.current);
    // `display` deliberately excluded from deps — re-snapshotting it as
    // `from` happens before the new RAF loop, and including it would
    // restart the animation every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return <span className={className}>{formatter(display)}</span>;
}
