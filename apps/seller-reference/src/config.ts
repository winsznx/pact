import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV_FILE = join(HERE, "..", ".env");

/**
 * Lightweight .env loader — same shape as scripts/day0/lib/env.ts so the
 * seller agent and the Phase 0 gates share env semantics. We don't pull
 * `dotenv` because the SDK install graph is already heavy.
 */
function loadDotenv(): void {
  if (!existsSync(ENV_FILE)) return;
  const raw = readFileSync(ENV_FILE, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotenv();

const ConfigSchema = z.object({
  PACT_PRIVATE_KEY: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, "PACT_PRIVATE_KEY must be 0x-prefixed 32-byte hex"),
  PACT_RPC_URL: z.string().url().default("https://evmrpc.0g.ai"),
  PACT_SERVICE_ID: z
    .string()
    .regex(/^\d+$/)
    .default("1")
    .transform((s) => BigInt(s)),
  PACT_BROKER_PROVIDER_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .default("0xd9966e13a6026Fcca4b13E7ff95c94DE268C471C"),
  PACT_POLL_INTERVAL_MS: z
    .string()
    .regex(/^\d+$/)
    .default("3000")
    .transform((s) => Number.parseInt(s, 10)),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  const parsed = ConfigSchema.safeParse({
    PACT_PRIVATE_KEY: process.env.PACT_PRIVATE_KEY,
    PACT_RPC_URL: process.env.PACT_RPC_URL,
    PACT_SERVICE_ID: process.env.PACT_SERVICE_ID,
    PACT_BROKER_PROVIDER_ADDRESS: process.env.PACT_BROKER_PROVIDER_ADDRESS,
    PACT_POLL_INTERVAL_MS: process.env.PACT_POLL_INTERVAL_MS,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid config:\n${issues}\n\nCopy .env.example to .env and fill in.`);
  }
  return parsed.data;
}
