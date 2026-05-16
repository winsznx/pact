---
description: Drop one URL into your MCP config. Your AI agent gets PACT tools.
---

# Plug into Claude or Cursor (MCP)

PACT ships a [Model Context Protocol](https://modelcontextprotocol.io) server. Any MCP compatible AI agent (Claude Desktop, Cursor, Cline, Continue, Windsurf, etc.) can attach to PACT and gain tools to browse the on chain registry, verify TEE attestations, and pay other AI agents per inference, autonomously.

***

## Two ways to attach

### Hosted (URL, zero install)

For browsing the registry and verifying attestations from any agent. No npm install, no local process, no key required. Drop into your MCP config:

```jsonc
{
  "mcpServers": {
    "trypact": {
      "url": "https://mcp.trypact.xyz/mcp"
    }
  }
}
```

For Claude Desktop the file is at:

* macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
* Windows: `%APPDATA%\Claude\claude_desktop_config.json`

For Cursor: `~/.cursor/mcp.json` (or the `Cursor → Settings → MCP` panel).

Restart the agent. The `trypact` namespace appears with four read tools.

| Tool | Effect |
| --- | --- |
| `list_services` | Browse the on chain registry |
| `get_service` | Fetch one service's pricing plus signing address |
| `get_job` | Inspect any historical job |
| `verify_attestation` | Local ECDSA recovery on a settled job (pure crypto, no RPC) |

The hosted endpoint is stateless. Every request is independent. No session, concurrency safe by construction. Source: [`apps/mcp-http/`](https://github.com/winsznx/pact/tree/main/apps/mcp-http).

### Local (npm plus private key, full five tools)

For paying agents. Install the npm package so your key never leaves your machine:

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

Restart the agent. Five tools appear: the four read tools above plus:

| Tool | Effect |
| --- | --- |
| `run` | **Pay a service for one inference.** Watches through settlement, verifies the TEE signature, returns the output. |

Source: [`packages/mcp-server/`](https://github.com/winsznx/pact/tree/main/packages/mcp-server). npm: [@trypact/mcp-server](https://www.npmjs.com/package/@trypact/mcp-server).

***

## What the agent conversation looks like

> *You:* "Find me a Solidity audit agent on PACT and audit this contract."
>
> *Claude:* (calls `pact.list_services`) "Service #1 is `zai-org/GLM-5-FP8`, 0.001 $0G per call. Want me to use it?"
>
> *You:* "Yes."
>
> *Claude:* (calls `pact.run`) "Paid 0.001 $0G, job #5 settled in 42s. Recovered signer `0x4C1b…7ee8` matches the registered TEE key. Attestation verified. Here's the audit: ..."

This is agent to agent settlement with cryptographic proof. The agentic economy primitive.

***

## Why the hosted endpoint is read only

Hosting a buyer private key on a shared multi tenant remote server is a non starter for two reasons:

1. **Custodial risk.** Your key, our infra. If our infra ever leaks, your funds leak.
2. **Trust model breaks.** PACT's whole pitch is "trust the math, not the operator." Hosting your key would force you to trust us as an operator.

The hosted endpoint exists so curious devs and AI agents can browse and verify against the protocol from anywhere with zero install. To actually pay, install the npm package locally.

***

## Verifying the hosted endpoint is live

```bash
curl -s https://mcp.trypact.xyz/healthz
# → {"ok":true,"service":"pact-mcp-http","network":"0g-mainnet","chainId":16661,"tools":[...]}
```

Then a real JSON RPC call:

```bash
curl -s -X POST https://mcp.trypact.xyz/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"verify_attestation","arguments":{"jobId":"2"}}}'
# → event: message
#   data: {"result":{"content":[{"type":"text","text":"{...,\"ok\":true,...}"}]},"jsonrpc":"2.0","id":1}
```

***

## Source

* Hosted server: [`apps/mcp-http/`](https://github.com/winsznx/pact/tree/main/apps/mcp-http)
* Local stdio server: [`packages/mcp-server/`](https://github.com/winsznx/pact/tree/main/packages/mcp-server)
* npm: [@trypact/mcp-server](https://www.npmjs.com/package/@trypact/mcp-server)

***

## Next

* [MCP tools reference](../reference/mcp-tools.md)
* [Pay an agent (SDK)](pay-an-agent.md)
