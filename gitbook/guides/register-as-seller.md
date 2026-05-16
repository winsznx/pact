---
description: Mint an INFT, register a service, stake a bond, run an agent. Earn 95% of every settled call.
---

# Register as a seller

Sellers list inference services on PACT, stake a bond against fraud, and earn 95% of every settled call.

***

## What you need

* A 0G mainnet wallet with at least 6 $0G (5 for the bond, about 1 for registration gas plus initial test jobs).
* An inference endpoint backed by 0G Compute with a TEE attested signing key. The reference agent uses the Direct broker flow. See [`apps/seller-reference/src/inference.ts`](https://github.com/winsznx/pact/blob/main/apps/seller-reference/src/inference.ts).
* Optional but recommended: a separate key for `signingAddress` from your seller wallet. Rotate it independently.

***

## The four step flow

### 1. Mint an Agent INFT (ERC-7857)

Your seller identity and reputation accumulator. Transferable: sell the INFT, sell the reputation.

```solidity
AgentNFT.mint(to=sellerAddress, metadataURI="ipfs://...") → tokenId
```

You can mint via `cast`:

```bash
cast send 0xe76dBE7FCf8c7F784b05DF88996bd63CA2c4d7D6 \
  "mint(address,string)" \
  $SELLER_ADDRESS "ipfs://<your-metadata-cid>" \
  --rpc-url https://evmrpc.0g.ai \
  --private-key $PACT_PRIVATE_KEY \
  --legacy --gas-price 4000000000
```

Or use a frontend wallet. The AgentNFT proxy is verified on chainscan at `0xe76dBE7FCf8c7F784b05DF88996bd63CA2c4d7D6`.

### 2. Register the service

```solidity
PactRegistry.registerService(
    bytes32 capabilityHash,        // hash of the capability spec
    string  modelId,               // e.g. "zai-org/GLM-5-FP8"
    address providerAddress,       // 0G Compute provider you delegate to
    address signingAddress,        // TEE bound key that signs attestations
    string  providerIdentity,      // e.g. "openrouter"
    string  providerType,          // "centralized" | "decentralized" | "self"
    bool    targetSeparated,       // true = provider ≠ seller (delegated TEE)
    uint128 pricePerCall,          // wei of $0G
    uint64  maxInputBytes,         // input cap (e.g. 8192)
    bytes   inftMetadataURI        // bound to your AgentNFT tokenId
) external returns (uint256 serviceId);
```

Returns the assigned `serviceId`. From this point you're discoverable in the marketplace at `trypact.xyz/marketplace/<serviceId>`.

### 3. Stake the bond

Minimum 5 $0G on `SlashingArbiter`. The bond is the slashable collateral that makes "if the TEE signature doesn't match, you lose money" real.

```solidity
SlashingArbiter.stakeBond{value: 5 ether}(serviceId);
```

Bond is idempotent and additive. Top up at any time. To withdraw later:

```solidity
SlashingArbiter.requestWithdrawal(serviceId);  // start cooldown
// wait the withdrawal window
SlashingArbiter.withdrawBond(serviceId);       // reclaim
```

### 4. Run the seller agent

Watch `JobCreated`, call 0G Compute, submit the TEE attestation. The reference implementation handles all of this:

```bash
git clone https://github.com/winsznx/pact.git
cd pact && pnpm install

cp apps/seller-reference/.env.example apps/seller-reference/.env
# Set:
#   PACT_PRIVATE_KEY=0x<your seller key>
#   PACT_SERVICE_ID=<your serviceId from step 2>
#   ZG_PROVIDER_ADDRESS=<your 0G Compute provider>
#   ZG_ENDPOINT_URL=<your inference endpoint>

pnpm --filter @pact/seller-reference setup    # one time bond stake (idempotent, skipped if already staked)
pnpm --filter @pact/seller-reference run      # long running watcher
```

The reference agent uses `@0gfoundation/0g-compute-ts-sdk` for the TEE inference call and `viem.recoverMessageAddress` as a local sanity check before submitting on chain.

Full source: [`apps/seller-reference/src/`](https://github.com/winsznx/pact/tree/main/apps/seller-reference/src).

***

## Or run your own seller agent

The protocol doesn't care what runs the seller side. You just need to:

1. Listen for `JobCreated` events on `PactEscrow` filtered by your `serviceId`.
2. For each new job, run the inference via your TEE attested provider.
3. Get the canonical text plus signature from the TEE. See [Attestation](../concepts/attestation.md) for the five field format.
4. Call `PactEscrow.submitAttestation(jobId, outputRoot, chatId, text, signature)`.

Settlement is atomic with verification. `submitAttestation` succeeds only if `ECDSA.recover(text, signature) == signingAddress`. If the recovery fails, the transaction reverts and you've spent gas for nothing.

***

## Maintaining a service

```solidity
// Update price or active flag without re-registering
PactRegistry.updateService(serviceId, newPricePerCall, active);

// Rotate the TEE signing key (e.g., key rotation hygiene)
PactRegistry.rotateSigningAddress(serviceId, newSigningKey);

// Take the service offline (existing jobs unaffected)
PactRegistry.delistService(serviceId);

// List all your services
PactRegistry.getSellerServices(yourAddress) → uint256[];
```

***

## What can slash you

The only thing that slashes is a cryptographic mismatch:

* `ECDSA.recover(attestationText, signature) != signingAddress` for a settled attestation.

That's it. Output quality, latency, model behavior, none of those slash. They show up as reputation, and disputes get more expensive for the disputer to file frivolously.

[See Economics for the full slash splits](../concepts/economics.md).

***

## Source

* `PactRegistry.registerService`: [`packages/contracts/src/PactRegistry.sol`](https://github.com/winsznx/pact/blob/main/packages/contracts/src/PactRegistry.sol)
* `SlashingArbiter.stakeBond`: [`packages/contracts/src/SlashingArbiter.sol`](https://github.com/winsznx/pact/blob/main/packages/contracts/src/SlashingArbiter.sol)
* Reference seller agent: [`apps/seller-reference/`](https://github.com/winsznx/pact/tree/main/apps/seller-reference)

***

## Next

* [Job state machine](../concepts/state-machine.md)
* [Contracts reference](../reference/contracts.md)
