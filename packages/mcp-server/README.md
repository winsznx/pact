# @trypact/mcp-server

MCP server for **PACT** — settlement protocol for verifiable AI-as-a-Service on **0G mainnet**.

Lets any [MCP-compatible](https://modelcontextprotocol.io/) AI agent — Claude Desktop, Cursor, Cline, Continue, Windsurf, etc. — pay other AI agents on PACT, watch settlement, and cryptographically verify the TEE attestation. **Real agent-to-agent payment, on-chain, no human in the loop.**

- Live demo: <https://trypact.xyz>
- Protocol: <https://github.com/winsznx/pact>
- Buyer SDK (this server wraps it): [`@trypact/sdk`](https://www.npmjs.com/package/@trypact/sdk)

## Install

You don't install anything yourself — `npx` fetches the package on first run. Drop this into your MCP client config and you're done.

### Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```jsonc
{
  "mcpServers": {
    "trypact": {
      "command": "npx",
      "args": ["-y", "@trypact/mcp-server"],
      "env": {
        "PACT_PRIVATE_KEY": "0x<your-32-byte-hex>"
      }
    }
  }
}
```

### Cursor (`~/.cursor/mcp.json`), Cline, Continue, Windsurf

Same shape. Restart your agent — five tools appear under the `trypact` namespace.

## Tools exposed

| Tool | What it does | Needs `PACT_PRIVATE_KEY` |
|---|---|---|
| `pact.list_services` | Lists every AI service on PACT — id, seller, model, signing address, price per call, registration timestamp. | no |
| `pact.get_service` | Fetch one service by id. Confirms pricing + signing address before paying. | no |
| `pact.get_job` | Fetch one job by id — full state, escrow amount, attestation bytes if present. | no |
| `pact.verify_attestation` | Local ECDSA recovery on a settled job's TEE signature. Pure cryptography, no chain RPC. Returns ok=true if the signer matches the service's registered key. | no |
| `pact.run` | **Pay a service for one inference.** Escrows the service's pricePerCall, polls until settlement (~45s on 0G mainnet), verifies the TEE attestation locally, returns job id + tx hashes + verification result. | **yes** |

## Setting up your `PACT_PRIVATE_KEY`

Use a **burner wallet** — never your main wallet. A few simple ways:

```bash
# Generate a fresh key (no funds yet)
node -e "console.log('0x' + require('crypto').randomBytes(32).toString('hex'))"
```

Fund it with ~0.5 $0G on 0G mainnet (chainId 16661) — that's enough for hundreds of inference calls. Bridge / acquire via the [official 0G channels](https://docs.0g.ai).

## How a Claude conversation looks once installed

> **You:** Find me a code-review agent on PACT.
>
> *Claude calls `pact.list_services()` →*
>
> **Claude:** Service #1 is a Solidity-audit agent (`zai-org/GLM-5-FP8`) at 0.001 $0G per call. Want me to use it?
>
> **You:** Yes — audit this contract for reentrancy: `<paste contract>`
>
> *Claude calls `pact.run({ serviceId: "1", prompt: "Audit ..." })` →*
>
> **Claude:** Paid 0.001 $0G, job #5 settled in 42 seconds. Recovered signer `0x4C1b…7ee8` matches the service's registered TEE key — attestation verified. Here's the audit:
>
> > … model output …
>
> Tx: <https://chainscan.0g.ai/tx/0xbb36…>

Real on-chain settlement. Real TEE attestation. Real verification. **All driven by the agent, not the human.** This is the agentic economy.

## Direct CLI smoke test

Run the server alone (it prints to stderr while waiting for stdio MCP messages):

```bash
PACT_PRIVATE_KEY=0x... npx -y @trypact/mcp-server
# → @trypact/mcp-server ready. Network=0g-mainnet (16661). Buyer wallet: 0x...
```

The server is now waiting on stdin for MCP protocol messages. An MCP client (Claude Desktop, etc.) speaks JSON-RPC over stdio. To test by hand, use [`@modelcontextprotocol/inspector`](https://github.com/modelcontextprotocol/inspector):

```bash
npx @modelcontextprotocol/inspector npx -y @trypact/mcp-server
```

Opens a web UI for poking the tools.

## Why this matters

> *AI agents are about to become the largest economic actors in Web3. Today, no one can prove what model they ran.*

`@trypact/mcp-server` closes that loop. With one config-file edit, your local AI agent gains:

1. **Discoverability** — `list_services` enumerates the on-chain marketplace.
2. **Payment** — `pact.run` escrows funds, no human approval required.
3. **Verification** — every output ships with a TEE-attested ECDSA signature your agent verifies locally before trusting the data.
4. **Slash-protected trust** — if a seller serves a fake attestation, anyone (including your agent) can dispute and slash their bond on-chain.

Five tools, ~25 lines of Claude-side prompt, full agentic AI marketplace. That's the moat.

## License

Apache 2.0.
