/**
 * Reputation display formatter.
 *
 * `ReputationVault.weightedScore` is `uint128` wei-scale per PRD §5.4
 * — it accumulates `sqrt(buyer_total_volume + this_job_amount)` summed
 * across settled jobs. The sqrt prevents whale buyers from dominating
 * a service's score. For a single Job #2 settlement of 0.001 $0G
 * (= 1e15 wei) from a buyer with no prior history, the formula adds
 * sqrt(1e15) ≈ 31,622,776 to the score, which we then divide by 1e9
 * to map to a human-readable index. The exact wei-scale + the /1e9
 * normalisation are kept here so every consumer reads the same value.
 *
 * `formatReputationIndex(score)` returns a thousands-separated string
 * like "31,623" — suitable for headline numbers + per-row reputation
 * cells. Tooltip copy is exported alongside so dashboard + marketplace
 * + explore all surface the same explanation.
 */

/** Divisor used to map raw weightedScore wei into a readable index. */
const INDEX_DIVISOR = 1_000_000_000n; // 1e9

/**
 * Convert a uint128 weightedScore (wei-scale) into a thousands-
 * separated index string. Returns "—" when the score is undefined or
 * the supplied client doesn't yet have a value (loading state).
 */
export function formatReputationIndex(score: bigint | undefined): string {
  if (score === undefined) return "—";
  if (score === 0n) return "0";
  // Number conversion is safe up to ~2^53; weightedScore-after-divide
  // sits well within that range for hackathon-scale volumes.
  const index = Math.round(Number(score / INDEX_DIVISOR));
  return new Intl.NumberFormat("en-US").format(index);
}

/** Centralised tooltip copy so dashboard/marketplace/explore agree. */
export const REPUTATION_TOOLTIP =
  "Reputation index = sqrt(buyer_total_volume + this_job_amount) summed " +
  "across settled jobs, normalised by 1e9. The sqrt-scaling prevents " +
  "whale buyers from dominating a service's score. Raw value lives in " +
  "ReputationVault.weightedScore (uint128 wei).";
