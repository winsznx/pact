import express from "express";
import type { Request, Response } from "express";

import { startPoller } from "./poller.js";
import { serialize, bigintSafeReplacer } from "./serialize.js";
import { store } from "./store.js";

/**
 * PACT indexer HTTP API. Single Express process, in-memory store
 * hydrated by `poller.ts`. Designed for `api.trypact.xyz`.
 *
 * Endpoints:
 *   GET  /healthz             — uptime + last indexed block + counters
 *   GET  /v1/services         — full service catalog
 *   GET  /v1/services/:id     — single service
 *   GET  /v1/jobs?limit=N     — recent jobs, newest first
 *   GET  /v1/jobs/:id         — single job
 *   GET  /v1/sellers/:address — services + jobs for an address
 *   GET  /v1/stats            — aggregate counters (settled / expired / slashed)
 *
 * CORS: open to any origin so the frontend (trypact.xyz, explorer.trypact.xyz),
 * SDK consumers, and curious developers can hit it from anywhere.
 */
const PORT = parseInt(process.env.PORT ?? "8080", 10);
const startedAt = Date.now();

const app = express();

app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "public, max-age=2");
  next();
});

// Override `res.json` to use our bigint-safe replacer so handlers can
// pass raw bigints to res.json without manual stringification.
app.set("json replacer", bigintSafeReplacer);

app.get("/healthz", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    lastBlock: store.lastBlock,
    counters: {
      services: store.services.size,
      jobs: store.jobs.size,
      sellers: store.sellerServices.size,
      ...store.counters,
    },
  });
});

app.get("/v1/services", (_req: Request, res: Response) => {
  const services = [...store.services.values()]
    .sort((a, b) => Number(a.serviceId - b.serviceId))
    .map((s) => serialize(s));
  res.json({ services, total: services.length });
});

app.get("/v1/services/:id", (req: Request, res: Response) => {
  const idStr = req.params.id;
  if (typeof idStr !== "string") {
    res.status(400).json({ error: "missing :id" });
    return;
  }
  let id: bigint;
  try {
    id = BigInt(idStr);
  } catch {
    res.status(400).json({ error: "invalid :id" });
    return;
  }
  const svc = store.services.get(id);
  if (!svc) {
    res.status(404).json({ error: "service not found" });
    return;
  }
  res.json(serialize(svc));
});

app.get("/v1/jobs", (req: Request, res: Response) => {
  const raw = req.query.limit;
  const limitParam = typeof raw === "string" ? parseInt(raw, 10) : NaN;
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), 200)
    : 50;
  const jobs = [...store.jobs.values()]
    .sort((a, b) => Number(b.createdAt - a.createdAt))
    .slice(0, limit)
    .map((j) => serialize(j));
  res.json({ jobs, total: store.jobs.size, limit });
});

app.get("/v1/jobs/:id", (req: Request, res: Response) => {
  const idStr = req.params.id;
  if (typeof idStr !== "string") {
    res.status(400).json({ error: "missing :id" });
    return;
  }
  let id: bigint;
  try {
    id = BigInt(idStr);
  } catch {
    res.status(400).json({ error: "invalid :id" });
    return;
  }
  const job = store.jobs.get(id);
  if (!job) {
    res.status(404).json({ error: "job not found" });
    return;
  }
  res.json(serialize(job));
});

app.get("/v1/sellers/:address", (req: Request, res: Response) => {
  const addressRaw = req.params.address;
  if (typeof addressRaw !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(addressRaw)) {
    res.status(400).json({ error: "invalid :address" });
    return;
  }
  const key = addressRaw.toLowerCase();
  const serviceIds = store.sellerServices.get(key) ?? new Set();
  const jobIds = store.addressJobs.get(key) ?? new Set();
  const services = [...serviceIds]
    .map((id) => store.services.get(id))
    .filter((s) => s !== undefined)
    .map((s) => serialize(s!));
  const jobs = [...jobIds]
    .map((id) => store.jobs.get(id))
    .filter((j) => j !== undefined)
    .map((j) => serialize(j!));
  res.json({ address: addressRaw, services, jobs });
});

app.get("/v1/stats", (_req: Request, res: Response) => {
  res.json({
    lastBlock: store.lastBlock,
    services: store.services.size,
    jobs: store.jobs.size,
    sellers: store.sellerServices.size,
    settledJobs: store.counters.settledJobs,
    expiredJobs: store.counters.expiredJobs,
    slashedJobs: store.counters.slashedJobs,
    totalSettledWei: store.counters.totalSettledWei,
  });
});

app.get("/", (_req: Request, res: Response) => {
  res.json({
    name: "PACT indexer",
    network: "0g-mainnet",
    chainId: 16661,
    docs: "https://github.com/winsznx/pact/blob/main/apps/indexer/README.md",
    endpoints: [
      "/healthz",
      "/v1/services",
      "/v1/services/:id",
      "/v1/jobs?limit=N",
      "/v1/jobs/:id",
      "/v1/sellers/:address",
      "/v1/stats",
    ],
  });
});

async function main(): Promise<void> {
  await startPoller();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`indexer listening on :${PORT}`);
  });
}

main().catch((err) => {
  console.error("indexer fatal:", err);
  process.exit(1);
});
