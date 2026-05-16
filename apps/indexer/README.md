# @pact/indexer

Lightweight REST cache over PACT events on 0G mainnet. Polls `getLogs` every 3s, holds the indexed graph in memory, exposes a stable HTTP API at **`api.trypact.xyz`** for the frontend, SDK consumers, and curious developers.

## Endpoints

| Method · path | Returns |
|---|---|
| `GET /healthz` | uptime + last indexed block + counters |
| `GET /v1/services` | every service ever registered |
| `GET /v1/services/:id` | one service |
| `GET /v1/jobs?limit=N` | recent jobs, newest first |
| `GET /v1/jobs/:id` | one job |
| `GET /v1/sellers/:address` | services owned + jobs participated |
| `GET /v1/stats` | aggregate counters (settled / expired / slashed) |

All numeric fields are JSON strings (`"1000000000000000"`) — preserves precision past 2^53. Parse client-side with `BigInt()`.

## Data model

The indexer derives from three contracts:

- `PactRegistry.ServiceRegistered` → hydrate via `getService(id)` → upsert
- `PactEscrow.JobCreated` + `JobAttested` / `JobSettled` / `JobExpired` / `JobDisputed` / `JobSlashed` → hydrate via `getJob(id)` → upsert
- Counters are maintained incrementally on every state transition

In-memory only. Rebuilds from chain on every restart (~5 seconds at hackathon scale). v0.2 path: Postgres / Supabase persistence.

## Local dev

```bash
pnpm install
pnpm --filter @pact/indexer dev
# → :8080
curl http://localhost:8080/healthz
curl http://localhost:8080/v1/services
```

Env vars:

| name | default | meaning |
|---|---|---|
| `PORT` | `8080` | HTTP listener |
| `PACT_RPC_URL` | `https://evmrpc.0g.ai` | 0G mainnet RPC |
| `PACT_DEPLOY_BLOCK` | `30000000` | start-of-history block for the initial scan |
| `PACT_POLL_MS` | `3000` | poll cadence |

## Deploy (Railway)

The indexer is the only `apps/*` service that needs a persistent Node runtime. Vercel doesn't fit (background polling, long-running). Railway does, and supports pnpm workspaces.

1. New project → Deploy from GitHub → pick `winsznx/pact`.
2. Service settings:
   - **Root Directory**: `/` (keep at repo root so pnpm workspace deps resolve)
   - **Watch Paths**: `apps/indexer/**`, `packages/sdk/**`
   - **Install Command**: `pnpm install --frozen-lockfile`
   - **Build Command**: `pnpm --filter @pact/indexer... build`
   - **Start Command**: `pnpm --filter @pact/indexer start`
   - **Health Check Path**: `/healthz`
3. Add custom domain `api.trypact.xyz` in Networking; DNS CNAME points at the Railway target.

## License

Apache 2.0.
