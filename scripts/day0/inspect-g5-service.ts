/**
 * Read-only inspection — full field dump of the G5 provider's listService()
 * entry. Answers a single architectural question raised by Phase 1.5 g8:
 * is the TEE proxy's signing_address (returned per-call in TeeTLS via
 * /v1/proxy/signature/{chatId}) ALSO advertised pre-flight via listService()
 * for TeeTLS providers — same as the TeeML provider exposes at index 9?
 *
 * No ack, no ledger write, no inference, no fund transfer. listService is
 * a registry read; broker construction is in-memory only.
 *
 * Why a separate script and not patching g5: g5's summarize() truncates
 * arrays to 3 elements, so its captured output never recorded indices
 * 3..10. We want all 11 verbatim.
 */

import { createZGComputeNetworkBroker } from "@0gfoundation/0g-compute-ts-sdk";
import { ethers } from "ethers";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./lib/env.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(HERE, "output", "inspect-g5-service.json");
const TARGET = "0xd9966e13a6026Fcca4b13E7ff95c94DE268C471C";

function dumpAll(s: unknown): Record<string, unknown> {
  if (s === null || typeof s !== "object") return { value: String(s) };
  const out: Record<string, unknown> = {};
  for (const key in s as object) {
    const val = (s as Record<string, unknown>)[key];
    if (typeof val === "bigint") {
      out[key] = val.toString();
    } else if (val !== null && typeof val === "object") {
      out[key] = JSON.parse(
        JSON.stringify(val, (_, v: unknown) =>
          typeof v === "bigint" ? v.toString() : v,
        ),
      );
    } else {
      out[key] = val;
    }
  }
  return out;
}

const env = loadEnv(["PACT_PRIVATE_KEY"]);
const provider = new ethers.JsonRpcProvider(env.PACT_RPC_URL);
const wallet = new ethers.Wallet(env.PACT_PRIVATE_KEY!, provider);
const broker = await createZGComputeNetworkBroker(wallet);

const services = await broker.inference.listService();
const allDumps = services.map(dumpAll);

const matchIndex = services.findIndex(
  (s) =>
    (s as { provider?: string }).provider?.toLowerCase() === TARGET.toLowerCase(),
);
if (matchIndex === -1) {
  console.error(`FATAL: provider ${TARGET} not found in listService(). Available providers:`);
  for (const d of allDumps) console.error(` - ${(d as { provider?: string }).provider}`);
  process.exit(1);
}

const fields = allDumps[matchIndex]!;
const result = {
  capturedAt: new Date().toISOString(),
  target: TARGET,
  walletAddress: wallet.address,
  servicesCount: services.length,
  matchIndex,
  fields,
};

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));

console.log(JSON.stringify(result, null, 2));
