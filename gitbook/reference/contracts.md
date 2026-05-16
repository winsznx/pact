---
description: Solidity external function surface for direct integrators.
---

# Contracts

For integrators who want to skip the SDK and call the contracts directly via `cast`, ethers, web3, viem, or foundry. Every function is non reentrant where it touches state. Full NatSpec on every external function. Source: [`packages/contracts/src/`](https://github.com/winsznx/pact/tree/main/packages/contracts/src).

***

## Buyer surface (PactEscrow)

```solidity
// Escrow funds, open a job. msg.value is the price for one inference.
function createJob(uint256 serviceId, bytes calldata encryptedInput, uint64 timeout)
    external payable returns (uint256 jobId);

// Reclaim escrow if the seller hasn't attested by `timeout`.
function reclaimExpired(uint256 jobId) external;

// Challenge a settled attestation. Requires posting a dispute bond.
function dispute(uint256 jobId) external payable;

// Read job state, escrow balance, etc.
function getJob(uint256 jobId) external view returns (Job memory);
function jobEscrowBalance(uint256 jobId) external view returns (uint128);
function nextJobId() external view returns (uint256);
```

***

## Seller surface (PactRegistry, PactEscrow, SlashingArbiter)

### PactRegistry: register, update, delist

```solidity
function registerService(
    bytes32 capabilityHash,
    string  modelId,
    address providerAddress,
    address signingAddress,
    string  providerIdentity,
    string  providerType,
    bool    targetSeparated,
    uint128 pricePerCall,
    uint64  maxInputBytes,
    bytes   inftMetadataURI
) external returns (uint256 serviceId);

function updateService(uint256 serviceId, uint128 newPrice, bool active) external;
function rotateSigningAddress(uint256 serviceId, address newSigningKey) external;
function delistService(uint256 serviceId) external;
function getSellerServices(address seller) external view returns (uint256[] memory);
```

### PactEscrow: submit the TEE attestation that settles the job

```solidity
function submitAttestation(
    uint256 jobId,
    bytes32 outputRoot,
    bytes32 chatId,
    bytes calldata attestationText,        // the 5 field canonical text
    bytes calldata attestationSignature    // 65 byte ECDSA(secp256k1)
) external;
```

### SlashingArbiter: bond lifecycle

```solidity
function stakeBond(uint256 serviceId) external payable;                 // ≥ 5 $0G
function requestWithdrawal(uint256 serviceId) external;                 // start timer
function withdrawBond(uint256 serviceId) external;                      // after window
```

***

## Public reads (anyone)

```solidity
PactRegistry.getService(serviceId)                  → Service struct
PactRegistry.nextServiceId()                        → uint256
ReputationVault.getReputation(serviceId)            → Reputation struct
ReputationVault.getBuyerWeight(address buyer)       → uint128 (sqrt weighted)
ReputationVault.getBuyerTotalVolume(address buyer)  → uint128 (wei settled)
SlashingArbiter.bondOf(serviceId)                   → uint128
AgentNFT.tokenURI(tokenId) / .ownerOf(tokenId)      → ERC-7857 standard
AttestationVerifier.verify(serviceId, text, signature) → bool
```

***

## Calling from `cast`

Example: read Service 1.

```bash
cast call 0x152A5a433A6592df57d7F77B7B01eEE00C481C2d \
  "getService(uint256)" 1 \
  --rpc-url https://evmrpc.0g.ai
```

Example: create a job.

```bash
cast send 0xB2b762Df53294923d3eaD00d8118AD37388dD4aA \
  "createJob(uint256,bytes,uint64)" \
  1 0x<encrypted-input> 300 \
  --value 0.001ether \
  --rpc-url https://evmrpc.0g.ai \
  --private-key $BUYER_KEY \
  --legacy --gas-price 4000000000
```

> **0G mainnet gotcha.** Use `--legacy --gas-price 4000000000` (4 gwei) on every broadcast. 0G's tip cap minimum is 2 gwei. forge auto estimates below this and txs reject. See [`CLAUDE.md`](https://github.com/winsznx/pact/blob/main/CLAUDE.md) for the full operational rules.

***

## Calling from viem

```ts
import { createWalletClient, http, parseEther } from "viem";
import { PACT_ADDRESSES, PACT_ESCROW_ABI } from "@trypact/sdk";

const txHash = await wallet.writeContract({
  address: PACT_ADDRESSES.PactEscrow,
  abi: PACT_ESCROW_ABI,
  functionName: "createJob",
  args: [1n, encryptedInput, 300n],
  value: parseEther("0.001"),
});
```

***

## Addresses

All seven mainnet contract addresses live at [Mainnet addresses](addresses.md).

***

## Source

* All contracts: [`packages/contracts/src/`](https://github.com/winsznx/pact/tree/main/packages/contracts/src)
* Foundry tests (56/56 passing): [`packages/contracts/test/`](https://github.com/winsznx/pact/tree/main/packages/contracts/test)
* Workspace shared ABIs and addresses: [`packages/shared/`](https://github.com/winsznx/pact/tree/main/packages/shared)
