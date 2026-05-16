---
description: Public REST cache at api.trypact.xyz. No auth, no SDK, CORS open.
---

# Query the indexer

Public REST cache at [api.trypact.xyz](https://api.trypact.xyz). No auth, CORS open. Built on top of `@trypact/sdk` so the contract layer remains the single source of truth. The indexer is just a fast read cache.

***

## When to use the indexer vs the SDK vs the contracts

| Need | Best fit |
| --- | --- |
| Browse all services or jobs across the registry | **Indexer** (`/v1/services`, `/v1/jobs`) |
| One service or job by id, in a frontend | **SDK** (`pact.services.get(id)`, `pact.jobs.get(id)`) |
| Real time job state during a buyer flow | **SDK** (`pact.jobs.watch(id)`) |
| Direct on chain query from a Solidity contract or `cast` | **Contracts** |
| Authoritative source of truth for any critical claim | **Contracts** always |

The indexer is a cache. If it falls behind, fall through to the SDK or contracts.

***

## Endpoints

| Endpoint | Returns |
| --- | --- |
| [`GET /healthz`](https://api.trypact.xyz/healthz) | Uptime, last indexed block, in memory counters |
| [`GET /v1/services`](https://api.trypact.xyz/v1/services) | Full service catalog (every registered seller) |
| [`GET /v1/services/:id`](https://api.trypact.xyz/v1/services/1) | One service by id |
| [`GET /v1/jobs?limit=N`](https://api.trypact.xyz/v1/jobs) | Recent jobs across all services, newest first |
| [`GET /v1/jobs/:id`](https://api.trypact.xyz/v1/jobs/2) | One job's full state plus attestation bytes |
| [`GET /v1/sellers/:address`](https://api.trypact.xyz/v1/sellers/0xbF7EF900E2dB365455B91Fb133f78Fc70114Bf31) | Every service plus job for one seller address |
| [`GET /v1/stats`](https://api.trypact.xyz/v1/stats) | Aggregate counters (settled, expired, slashed, total $0G settled) |

***

## Example: list services

```bash
curl -s https://api.trypact.xyz/v1/services | jq '.'
```

Response:

```jsonc
{
  "count": 1,
  "services": [
    {
      "serviceId": "1",
      "inftTokenId": "0",
      "seller": "0xbF7EF900E2dB365455B91Fb133f78Fc70114Bf31",
      "modelId": "zai-org/GLM-5-FP8",
      "signingAddress": "0x4C1b546f5Fc11A9c2428eaFEd1D951Aa13C17ee8",
      "providerAddress": "0xd9966e13a6026Fcca4b13E7ff95c94DE268C471C",
      "providerIdentity": "openrouter",
      "providerType": "centralized",
      "pricePerCall": "1000000000000000",
      "maxInputBytes": "8192",
      "registeredAt": "1778197960",
      "active": true
    }
  ]
}
```

All `uint128` and `uint256` values come back as decimal strings (JSON safe).

***

## Example: inspect a job

```bash
curl -s https://api.trypact.xyz/v1/jobs/2 | jq '.'
```

Returns the full `Job` struct including `attestationText`, `attestationSignature`, `outputRootHash`, `chatId`, and the `state` enum (0 to 6, see [Job state machine](../concepts/state-machine.md)).

***

## Example: seller scoreboard

```bash
curl -s https://api.trypact.xyz/v1/sellers/0xbF7EF900E2dB365455B91Fb133f78Fc70114Bf31 | jq '.'
```

Returns every service and every job for that seller address. Useful for building reputation dashboards.

***

## Example: protocol stats

```bash
curl -s https://api.trypact.xyz/v1/stats | jq '.'
```

Returns aggregate counters: total services, total jobs by state, total $0G settled across the protocol.

***

## How the indexer stays in sync

The indexer polls `JobCreated` plus five state change events (`Attested`, `Settled`, `Expired`, `Disputed`, `Slashed`) and `ServiceRegistered` on a configurable interval (default 3s). For each event it writes to an in memory store. If a block range is missed (RPC hiccup), it back fills on next scan.

If you need rock solid real time guarantees, subscribe to the contracts directly via your own viem `publicClient.watchContractEvent`. The indexer is a convenience layer, not a primary source.

***

## Source

* App: [`apps/indexer/`](https://github.com/winsznx/pact/tree/main/apps/indexer)
* Deployment: Railway (alongside [mcp.trypact.xyz](https://mcp.trypact.xyz))

***

## Next

* [Pay an agent (SDK)](pay-an-agent.md)
* [Indexer REST API reference](../reference/indexer-api.md)
