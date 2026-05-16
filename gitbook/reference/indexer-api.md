---
description: REST endpoint reference for api.trypact.xyz.
---

# Indexer REST API

Base URL: [https://api.trypact.xyz](https://api.trypact.xyz)

Public, no auth, CORS open. JSON over HTTPS. All `uint128` and `uint256` values are returned as decimal strings for JSON safety.

***

## Endpoints

### `GET /healthz`

```bash
curl https://api.trypact.xyz/healthz
```

```jsonc
{
  "ok": true,
  "uptimeSec": 12345,
  "lastIndexedBlock": "32987654",
  "counters": {
    "services": 1,
    "jobs": 3,
    "settledJobs": 3,
    "expiredJobs": 0,
    "slashedJobs": 0,
    "totalSettledWei": "3000000000000000"
  }
}
```

***

### `GET /v1/services`

Full service catalog, every registered seller.

```bash
curl https://api.trypact.xyz/v1/services
```

```jsonc
{
  "count": 1,
  "services": [ /* Service[] */ ]
}
```

Each `Service` has the same shape as the SDK's [`Service`](sdk.md#service-type).

***

### `GET /v1/services/:id`

One service by id.

```bash
curl https://api.trypact.xyz/v1/services/1
```

Returns the `Service` struct, or `404` if not found.

***

### `GET /v1/jobs?limit=N`

Recent jobs across all services, newest first. Default `limit=50`.

```bash
curl 'https://api.trypact.xyz/v1/jobs?limit=10'
```

```jsonc
{
  "count": 3,
  "jobs": [ /* Job[] */ ]
}
```

***

### `GET /v1/jobs/:id`

One job's full state plus attestation bytes (if state ≥ Attested).

```bash
curl https://api.trypact.xyz/v1/jobs/2
```

Returns the `Job` struct, or `404` if not found.

***

### `GET /v1/sellers/:address`

Every service plus job for one seller wallet address.

```bash
curl https://api.trypact.xyz/v1/sellers/0xbF7EF900E2dB365455B91Fb133f78Fc70114Bf31
```

```jsonc
{
  "seller": "0xbF7EF900E2dB365455B91Fb133f78Fc70114Bf31",
  "services": [ /* Service[] */ ],
  "jobs": [ /* Job[] */ ]
}
```

***

### `GET /v1/stats`

Aggregate protocol counters.

```bash
curl https://api.trypact.xyz/v1/stats
```

```jsonc
{
  "services": 1,
  "jobs": {
    "total": 3,
    "settled": 3,
    "expired": 0,
    "slashed": 0
  },
  "totalSettledWei": "3000000000000000"
}
```

***

## Caching and freshness

The indexer polls events every 3s (configurable). Typical lag from on chain settlement to indexed availability is under 6s. If you need rock solid real time, use the SDK against the contract directly (`pact.jobs.watch(id)`) or subscribe to events via viem's `watchContractEvent`.

***

## Source

* App: [`apps/indexer/`](https://github.com/winsznx/pact/tree/main/apps/indexer)
* Deployment: Railway
* Status: [https://api.trypact.xyz/healthz](https://api.trypact.xyz/healthz)
