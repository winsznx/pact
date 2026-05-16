---
description: All seven PACT contract addresses on 0G mainnet.
---

# Mainnet addresses

Network: **0G mainnet**, chainId **16661**. RPC: `https://evmrpc.0g.ai`. Explorer: [chainscan.0g.ai](https://chainscan.0g.ai).

***

## Contracts

| Contract | Address | Explorer |
| --- | --- | --- |
| PactRegistry | `0x152A5a433A6592df57d7F77B7B01eEE00C481C2d` | [chainscan](https://chainscan.0g.ai/address/0x152A5a433A6592df57d7F77B7B01eEE00C481C2d) |
| PactEscrow | `0xB2b762Df53294923d3eaD00d8118AD37388dD4aA` | [chainscan](https://chainscan.0g.ai/address/0xB2b762Df53294923d3eaD00d8118AD37388dD4aA) |
| AttestationVerifier | `0x765C857B6764c90B0093Ea16f6103902665D0aa2` | [chainscan](https://chainscan.0g.ai/address/0x765C857B6764c90B0093Ea16f6103902665D0aa2) |
| ReputationVault | `0x1574E42D7fF268384408430D5b76C88f37b8a72B` | [chainscan](https://chainscan.0g.ai/address/0x1574E42D7fF268384408430D5b76C88f37b8a72B) |
| SlashingArbiter | `0x324E5b2183134EB239C7E934438831a15abe7C00` | [chainscan](https://chainscan.0g.ai/address/0x324E5b2183134EB239C7E934438831a15abe7C00) |
| AgentNFT (proxy) | `0xe76dBE7FCf8c7F784b05DF88996bd63CA2c4d7D6` | [chainscan](https://chainscan.0g.ai/address/0xe76dBE7FCf8c7F784b05DF88996bd63CA2c4d7D6) |
| AgentNFT (impl) | `0x4EC0DCac00A274Fb69F54cAb62370b2c71989CE4` | [chainscan](https://chainscan.0g.ai/address/0x4EC0DCac00A274Fb69F54cAb62370b2c71989CE4) |

Always interact with the **AgentNFT proxy**, not the implementation. The implementation address exists only for chainscan verification and on chain upgrade history.

***

## First settled job

* Tx: [`0xbb36752d…7df48`](https://chainscan.0g.ai/tx/0xbb36752d4e7330d2dc46f84a479b524111fa43f81ee55467cfedd8717a67df48)
* Date: 2026-05-15
* Buyer escrow: 0.001 $0G
* Outcome: TEE attested ECDSA signature verified on chain. Atomic settlement (95% seller, 5% protocol fee).

***

## Network config

| Field | Value |
| --- | --- |
| chainId | `16661` |
| name | `0G Mainnet` |
| RPC | `https://evmrpc.0g.ai` |
| Explorer | `https://chainscan.0g.ai` |
| Native currency | `OG` (18 decimals) |
| Recommended gas price | `4 gwei` (legacy mode) |

> Use `--legacy --gas-price 4000000000` on every cast / forge broadcast. 0G's tip cap minimum is 2 gwei. forge auto estimates below this and txs reject.

***

## Exported from `@trypact/sdk`

All addresses plus the chain config are exported from the SDK:

```ts
import {
  PACT_ADDRESSES,
  NETWORK_0G_MAINNET,
  PACT_REGISTRY_ABI,
  PACT_ESCROW_ABI,
  ATTESTATION_VERIFIER_ABI,
  REPUTATION_VAULT_ABI,
  SLASHING_ARBITER_ABI,
  AGENT_NFT_ABI,
} from "@trypact/sdk";
```

***

## Source

* Address registry: [`packages/shared/src/addresses.ts`](https://github.com/winsznx/pact/blob/main/packages/shared/src/addresses.ts)
* Chain config: [`packages/sdk/src/client.ts`](https://github.com/winsznx/pact/blob/main/packages/sdk/src/client.ts)
