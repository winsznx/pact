---
description: The MCP tools exposed by the hosted server at mcp.trypact.xyz and the local @trypact/mcp-server.
---

# MCP tools

PACT exposes the protocol as MCP tools so any MCP compatible agent (Claude Desktop, Cursor, Cline, Continue, Windsurf) can call it directly.

* **Hosted**: [mcp.trypact.xyz/mcp](https://mcp.trypact.xyz/mcp) (Streamable HTTP, 4 read tools, no install)
* **Local**: [`@trypact/mcp-server`](https://www.npmjs.com/package/@trypact/mcp-server) (stdio, 5 tools including `run`)

***

## Tool list

### `list_services`

List every AI service registered on PACT. Returns service id, seller, model, signing address, price per call, registration timestamp.

* **Hosted**: ✓
* **Local**: ✓
* **Arguments**: none

```jsonc
// Response shape (the content[0].text is a stringified JSON of this)
{
  "network": "0g-mainnet",
  "chainId": 16661,
  "count": 1,
  "services": [ /* Service[] */ ]
}
```

### `get_service`

Fetch a single PACT service by id. Returns the same `Service` struct as `list_services` but for one record.

* **Hosted**: ✓
* **Local**: ✓
* **Arguments**: `{ serviceId: string }` (stringified positive integer like `"1"`)

### `get_job`

Fetch a single PACT job by id. Returns the job's full state: `serviceId`, `buyer`, `seller`, escrow amount, state enum, attestation bytes (if present).

* **Hosted**: ✓
* **Local**: ✓
* **Arguments**: `{ jobId: string }` (stringified positive integer like `"2"`)

### `verify_attestation`

Locally verify a settled job's TEE attestation. Pure ECDSA recovery. Compares the recovered signer against the service's registered `signingAddress`. Returns `ok: true` on match.

* **Hosted**: ✓
* **Local**: ✓
* **Arguments**: `{ jobId: string }`

```jsonc
// Response shape
{
  "jobId": "2",
  "ok": true,
  "recoveredSigner": "0x4C1b546f5Fc11A9c2428eaFEd1D951Aa13C17ee8",
  "expectedSigner": "0x4C1b546f5Fc11A9c2428eaFEd1D951Aa13C17ee8",
  "note": "Signature recovered to the same address PactRegistry.getService(serviceId) returns. Attestation is authentic."
}
```

### `run`

**Pay** a PACT service for one inference. Escrows the service's `pricePerCall` in $0G, polls until settled (~45s on 0G mainnet), verifies the TEE attestation locally, returns the recovered signer plus tx hashes plus job id.

* **Hosted**: ✗ (intentionally omitted, a shared multi tenant server can't safely hold a buyer private key)
* **Local**: ✓ (requires `PACT_PRIVATE_KEY` env var, a 0G mainnet burner with ≥ 0.005 $0G)
* **Arguments**: `{ serviceId: string, prompt: string, timeoutSec?: number }`

```jsonc
// Response shape (truncated)
{
  "jobId": "5",
  "verified": { "ok": true, "recoveredSigner": "0x4C1b…7ee8", "expectedSigner": "0x4C1b…7ee8" },
  "txHashes": { "createJob": "0x..." },
  "createJobChainscan": "https://chainscan.0g.ai/tx/0x...",
  "service": { "id": "1", "modelId": "zai-org/GLM-5-FP8", "signingAddress": "0x4C1b…7ee8" },
  "buyer": "0x..."
}
```

***

## Configuring your agent

### Hosted (URL, zero install)

```jsonc
{
  "mcpServers": {
    "trypact": {
      "url": "https://mcp.trypact.xyz/mcp"
    }
  }
}
```

### Local (npm, full five tools)

```jsonc
{
  "mcpServers": {
    "trypact": {
      "command": "npx",
      "args": ["-y", "@trypact/mcp-server"],
      "env": {
        "PACT_PRIVATE_KEY": "0x<your-burner-key>"
      }
    }
  }
}
```

Config file location depends on your client. See [Plug into Claude or Cursor](../guides/plug-into-claude.md).

***

## Source

* Hosted server: [`apps/mcp-http/`](https://github.com/winsznx/pact/tree/main/apps/mcp-http)
* Local stdio server: [`packages/mcp-server/`](https://github.com/winsznx/pact/tree/main/packages/mcp-server)
* npm: [@trypact/mcp-server](https://www.npmjs.com/package/@trypact/mcp-server)
