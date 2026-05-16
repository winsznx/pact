/**
 * JSON serializer that knows how to render `bigint` values as strings —
 * vanilla JSON.stringify throws on bigints, and `Number(bigint)` silently
 * loses precision past 2^53. Strings preserve exact uint256 values.
 *
 * Used by every REST handler so the API contract is uniform: numeric
 * on-chain fields always arrive as strings ("1000000000000000"), parse
 * client-side with `BigInt()`.
 */
export function bigintSafeReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  return value;
}

/**
 * Project an internal record (which may contain Map / Set / bigint)
 * down to a plain JSON-ready object. Used to flatten `Service` and
 * `Job` records before they leave the API boundary.
 */
export function serialize(obj: unknown): Record<string, unknown> {
  if (obj === null || typeof obj !== "object") {
    throw new Error("serialize() requires an object");
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "bigint") out[k] = v.toString();
    else if (v instanceof Set) out[k] = [...v].map((x) => (typeof x === "bigint" ? x.toString() : x));
    else if (v instanceof Map) {
      const m: Record<string, unknown> = {};
      for (const [mk, mv] of v.entries()) {
        m[String(mk)] = typeof mv === "bigint" ? mv.toString() : mv;
      }
      out[k] = m;
    } else out[k] = v;
  }
  return out;
}
