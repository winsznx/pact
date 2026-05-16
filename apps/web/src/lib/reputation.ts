/**
 * Reputation display formatter.
 *
 * `ReputationVault.weightedScore` accumulates `amount × sqrt(buyerVolume)`
 * across settled jobs (see `ReputationVault.recordSettlement`). The raw
 * magnitude is `wei × sqrt(wei) = wei^1.5`, which explodes into 10^22+
 * even for tiny hackathon-scale activity. Displaying that as a comma-
 * separated integer reads as nonsense ("76,344,135,000,000").
 *
 * To get a number that grows monotonically with activity and stays in a
 * readable range across hackathon-scale and production-scale volumes, we
 * take the integer square root first (bringing the magnitude back to
 * wei-equivalent) and then divide by 1e9 to land in a 1 to ~10M band.
 *
 * Worked examples (Service 1's recordSettlement formula):
 *   - 2 jobs of 0.001 $0G each from one new buyer:
 *       raw ≈ 1.86e19, sqrt ≈ 4.32e9, /1e6 → 4,317
 *   - 1 job of 1 $0G from one new buyer:
 *       raw = 1e27, sqrt ≈ 3.16e13, /1e6 → 31,622,776
 *   - 100 jobs of 1 $0G from one 100-$0G-history buyer:
 *       raw ≈ 1e30, sqrt = 1e15, /1e6 → 1,000,000,000
 *
 * `formatReputationIndex(score)` returns a thousands-separated string.
 * Returns "—" when score is undefined (loading) and "0" when score == 0n.
 */

/**
 * Divisor applied after `bigintSqrt(score)`. The composed transform is
 * `sqrt(raw) / 1e6`, which keeps the displayed number in a recognizable
 * 4-digit-to-billion band across hackathon-scale and production-scale
 * activity.
 */
const INDEX_DIVISOR = 1_000_000n; // 1e6

/**
 * Convert a uint128 weightedScore (raw wei^1.5 magnitude) into a thousands-
 * separated index string. Returns "—" when the score is undefined or
 * the supplied client doesn't yet have a value (loading state).
 */
export function formatReputationIndex(score: bigint | undefined): string {
  if (score === undefined) return "—";
  if (score === 0n) return "0";
  const wei = bigintSqrt(score);
  const index = Number(wei / INDEX_DIVISOR);
  return new Intl.NumberFormat("en-US").format(index);
}

/** Centralised tooltip copy so dashboard, marketplace, explore agree. */
export const REPUTATION_TOOLTIP =
  "Reputation index = sqrt(raw weightedScore) / 1e6. " +
  "Raw weightedScore is sum of (job_amount × sqrt(buyer_total_volume)) " +
  "in ReputationVault. The inner sqrt prevents whale buyers from " +
  "dominating a service's score. The outer sqrt brings the wei^1.5 " +
  "magnitude back to a readable range.";

/**
 * Integer square root for bigint via Newton's method. Returns floor(sqrt(n)).
 * For non-negative inputs only. Used by `formatReputationIndex` to bring
 * the raw weightedScore (wei^1.5 magnitude) back to wei magnitude before
 * dividing into a display index.
 */
function bigintSqrt(n: bigint): bigint {
  if (n < 0n) throw new RangeError("bigintSqrt of negative number");
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}
