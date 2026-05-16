/// Truncate an address or hash to a head/tail form. e.g.
/// 0x4C1b546f5Fc11A9c2428eaFEd1D951Aa13C17ee8 → 0x4C1b…7ee8
export function shortHash(value: string, head = 6, tail = 4): string {
  if (!value) return "";
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/// Build an explorer URL for an address or tx hash. We don't use
/// chainscan-specific path conventions — both /address/{addr} and /tx/{hash}
/// are standard Blockscout layouts and work for chainscan.0g.ai.
export function explorerAddress(addr: string, base: string): string {
  return `${base.replace(/\/+$/, "")}/address/${addr}`;
}
export function explorerTx(hash: string, base: string): string {
  return `${base.replace(/\/+$/, "")}/tx/${hash}`;
}

/// Tiny class-name helper. Not pulling clsx as a dep — overkill for v0.1.
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
