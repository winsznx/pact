"use client";

import { useState } from "react";
import { cn, explorerAddress, explorerTx, shortHash } from "@/lib/format";
import { PACT_EXPLORER_URL } from "@pact/shared";

interface HashProps {
  value: string;
  /** When set, click copies + opens explorer in a new tab. */
  kind?: "address" | "tx";
  className?: string;
  head?: number;
  tail?: number;
}

/**
 * Truncated mono representation of an address/hash with copy-to-clipboard
 * and an inline link to the appropriate chainscan.0g.ai page.
 *
 * Click target: copy. Cmd/Ctrl-click on the explorer pill: open in new tab.
 */
export function Hash({
  value,
  kind = "address",
  className,
  head = 6,
  tail = 4,
}: HashProps) {
  const [copied, setCopied] = useState(false);
  const url =
    kind === "address"
      ? explorerAddress(value, PACT_EXPLORER_URL)
      : explorerTx(value, PACT_EXPLORER_URL);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // navigator.clipboard fails on http:// localhost in some browsers; the
      // explorer link is the fallback.
    }
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-8 font-mono text-caption tracking-caption",
        "bg-data-chip rounded-cardssmall px-8 py-4",
        className,
      )}
    >
      <button
        type="button"
        onClick={onCopy}
        className="text-midnight-navy hover:text-deep-cosmos cursor-pointer"
        title={copied ? "copied" : `copy ${value}`}
      >
        {shortHash(value, head, tail)}
      </button>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-slate-ink hover:text-midnight-navy"
        title="open in chainscan.0g.ai"
      >
        ↗
      </a>
      {copied ? (
        <span className="text-chartreuse-pulse text-caption" aria-live="polite">
          copied
        </span>
      ) : null}
    </span>
  );
}
