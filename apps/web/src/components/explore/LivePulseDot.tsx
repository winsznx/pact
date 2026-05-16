"use client";

import { useEffect, useState } from "react";

/**
 * Tiny chartreuse pulse — pings whenever the parent's `isRefetching` flips
 * to true, then settles back to a steady glow. CSS-only animation, no
 * framer-motion. Three concentric rings: solid dot + two expanding
 * ghosted rings via box-shadow keyframes.
 *
 * Live state: lit chartreuse with a 2s ambient pulse. On refetch, kicks
 * into a brighter quick beat for ~600ms.
 *
 * All sizing/spacing/color resolves to design tokens.
 */
interface LivePulseDotProps {
  isRefetching?: boolean;
}

export function LivePulseDot({ isRefetching = false }: LivePulseDotProps) {
  const [beat, setBeat] = useState(false);

  useEffect(() => {
    if (!isRefetching) return;
    setBeat(true);
    const t = window.setTimeout(() => setBeat(false), 600);
    return () => window.clearTimeout(t);
  }, [isRefetching]);

  return (
    <span
      aria-hidden
      className="relative inline-flex items-center justify-center w-12 h-12"
    >
      <span
        className={
          "absolute inline-flex w-12 h-12 rounded-buttons bg-chartreuse-pulse " +
          (beat ? "opacity-70 scale-150" : "opacity-30 scale-100") +
          " transition-all duration-500"
        }
      />
      <span className="relative inline-flex w-8 h-8 rounded-buttons bg-chartreuse-pulse" />
    </span>
  );
}
