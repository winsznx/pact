---
description: Pay a real on-chain inference in under five minutes.
---

# Quickstart

Three paths. Pick the one that matches your stack. All three hit live 0G mainnet (chainId 16661).

***

## 1. Web (zero install)

Open [trypact.xyz/marketplace](https://trypact.xyz/marketplace), pick a service, click **Run an inference**, connect a wallet (RainbowKit modal), sign the `createJob` transaction. You'll be redirected to `/jobs/N` where the state machine ticks live through **Pending → Sealed → Attested → Settled** in about 45 seconds. Every transition links to chainscan.

To verify the resulting attestation cryptographically in your own browser, open `/verify/N?autoplay=1`. viem's `recoverMessageAddress` runs locally. No server trust.

***

## 2. SDK (TypeScript)

Install:

```bash
pnpm add @trypact/sdk viem
# or: npm i @trypact/sdk viem
# or: yarn add @trypact/sdk viem
```

Set `BUYER_KEY` to a 0G mainnet burner with at least 0.005 $0G:

```ts
import { PactClient } from "@trypact/sdk";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const chain = {
  id: 16661, name: "0G Mainnet",
  nativeCurrency: { name: "OG", symbol: "OG", decimals: 18 },
  rpcUrls: { default: { http: ["https://evmrpc.0g.ai"] } },
} as const;

const account = privateKeyToAccount(process.env.BUYER_KEY as `0x${string}`);
const pact = new PactClient({
  publicClient: createPublicClient({ chain, transport: http() }),
  walletClient: createWalletClient({ account, chain, transport: http() }),
});

const result = await pact.run({
  serviceId: 1n,
  prompt: "Audit this Solidity contract for reentrancy vulnerabilities",
});

console.log(result.verified.ok);                  // true on authentic attestation
console.log(result.verified.recoveredSigner);     // matches service.signingAddress
console.log(result.txHashes.createJob);           // chainscan it
```

[Full SDK reference](reference/sdk.md). [Pay an agent (guide)](guides/pay-an-agent.md).

***

## 3. MCP (Claude, Cursor, any MCP agent)

Drop one URL into your MCP client config:

```jsonc
{
  "mcpServers": {
    "trypact": {
      "url": "https://mcp.trypact.xyz/mcp"
    }
  }
}
```

Restart the agent. Four read tools appear under the `trypact` namespace: `list_services`, `get_service`, `get_job`, `verify_attestation`. All hit 0G mainnet. The hosted endpoint is read only by design. A shared remote server cannot safely hold a buyer private key. For the full five tool set including the paying `run` tool, install [`@trypact/mcp-server`](https://www.npmjs.com/package/@trypact/mcp-server) locally.

[Full MCP guide](guides/plug-into-claude.md).

***

## Need $0G to test?

Claim from the 0G mainnet faucet (link in [0G's docs](https://docs.0g.ai)) or bridge from another chain. About 6 $0G covers a seller bond plus dozens of test jobs. About 0.005 $0G covers a few buyer runs.

***

## Next

* [How the protocol works](concepts/settlement.md)
* [Pay an agent in detail](guides/pay-an-agent.md)
* [Register as a seller](guides/register-as-seller.md)
