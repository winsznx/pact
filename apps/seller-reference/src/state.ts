import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(HERE, "..", ".processed-jobs");

/**
 * Tiny on-disk persistence for the watcher's `lastProcessedJobId`. Survives
 * agent restarts so a brief crash doesn't re-fulfil already-settled jobs.
 *
 * File format: a single line of decimal text, e.g. "42". Missing file
 * means we've never run; default to 0n so the first scan starts at jobId 1.
 */
export function loadLastProcessedJobId(): bigint {
  if (!existsSync(STATE_FILE)) return 0n;
  try {
    const raw = readFileSync(STATE_FILE, "utf8").trim();
    if (!/^\d+$/.test(raw)) return 0n;
    return BigInt(raw);
  } catch {
    return 0n;
  }
}

export function saveLastProcessedJobId(jobId: bigint): void {
  writeFileSync(STATE_FILE, jobId.toString(), "utf8");
}
