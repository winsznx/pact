---
description: The five field canonical text the TEE signs, and the ECDSA recovery anyone can run.
---

# TEE attestation

The cryptographic moat. Every settled job carries a five field colon separated canonical text signed by the provider's TEE bound key.

***

## The five field canonical text

```
<contentHash>:<usageHash>:<providerType>:<providerIdentity>:<tlsCertFingerprint>
```

| Field | Meaning | Example |
| --- | --- | --- |
| `contentHash` | sha256 of the inference output | `df0870f9b6a0…cd0b88e` |
| `usageHash` | sha256 of the token accounting record | `0a2d1a40916f…fed6` |
| `providerType` | `"centralized"`, `"decentralized"`, or `"self"` | `centralized` |
| `providerIdentity` | provider name | `openrouter` |
| `tlsCertFingerprint` | TLS cert of the inference endpoint | `84c05f54…3ba9` |

Real captured fixture (job #2, Service 1):

```
df0870f9b6a0bafc8223cebee0581160c6ea69876e57be3fa4e412450cd0b88e:
0a2d1a40916f10253302e59bd1f1ea7dca6616fe4e816e3cd683310c5711eed6:
centralized:openrouter:
84c05f5412b2f6357c22c1fd3f9d345b9ac02e99254491a05b589b46570d3ba9
```

Signature: `0x99946cf4…fab831c`
Signer (recovered): `0x4C1b546f5Fc11A9c2428eaFEd1D951Aa13C17ee8`

***

## The verification primitive (same as personal\_sign)

`AttestationVerifier.sol` runs the exact same primitive client browsers run for `personal_sign`:

```solidity
bytes32 digest = MessageHashUtils.toEthSignedMessageHash(attestationText);
address signer = ECDSA.recover(digest, signature);
require(signer == svc.signingAddress, "AttestationInvalid");
```

That's it. No exotic crypto. No new zero knowledge stack. The same primitive that's been baked into every Ethereum wallet for ten years.

In TypeScript, with viem, the same recovery:

```ts
import { recoverMessageAddress } from "viem";

const recovered = await recoverMessageAddress({
  message: { raw: attestationText },
  signature,
});

console.log(recovered === expectedSigner ? "authentic" : "fraud");
```

Run this in your browser at [trypact.xyz/verify/2?autoplay=1](https://trypact.xyz/verify/2?autoplay=1). Same bytes, same hash, same recovered address as the contract used.

***

## Where the signature actually comes from

The seller's reference agent calls 0G Compute's **Direct broker**:

```
1. acknowledgeProviderSigner(providerAddress)   // one time
2. chat/completions                             // the inference call
3. GET ${endpoint}/v1/proxy/signature/${chatId}
   → returns { text, signature }
```

The TEE running on the provider side signs the canonical text with the key bound to its hardware attested environment. The seller has zero ability to forge this. The key never leaves the TEE.

The seller forwards `(text, signature, chatId, outputRoot)` to `PactEscrow.submitAttestation` on chain. Settlement is atomic with verification. If `ECDSA.recover` doesn't match the registered `signingAddress`, the transaction reverts and the seller pays gas for nothing.

***

## What this guarantees, what it doesn't

**Guarantees:**

* The output was produced by the registered provider (TEE bound).
* The provider committed to the registered model and endpoint.
* The signing key cannot be forged outside the TEE.

**Does not guarantee:**

* Output quality. PACT settles cryptographic provenance, not quality. Quality lives in [reputation](reputation.md).
* That the TEE itself is uncompromised. This assumes 0G Compute's TEE attestation chain holds.
* That the seller hasn't promised to run model X but actually configured the provider for model Y. This is mitigated by `modelCommitment` being part of the service registration, but the seller side committment is trust on first use.

***

## What slashes

If `ECDSA.recover(attestationText, signature)` returns an address that is not the service's registered `signingAddress`:

* The submission reverts on chain (free for the protocol).
* If a settled attestation is later disputed and the recovery still fails, the seller's bond slashes. 70% to the disputer, 20% to the protocol, 10% burned.

That's the entire fraud surface: the signing key itself. There is no other forgery path the contract checks for.

***

## Source

* Solidity verifier: [`packages/contracts/src/AttestationVerifier.sol`](https://github.com/winsznx/pact/blob/main/packages/contracts/src/AttestationVerifier.sol)
* Browser verifier UI: [`apps/web/src/components/jobs/ECDSARecoveryViz.tsx`](https://github.com/winsznx/pact/blob/main/apps/web/src/components/jobs/ECDSARecoveryViz.tsx)
* SDK verifier: [`packages/sdk/src/attestations.ts`](https://github.com/winsznx/pact/blob/main/packages/sdk/src/attestations.ts)

***

## Next

* [Reputation INFT](reputation.md)
* [Verify in your browser (guide)](../guides/verify-attestation.md)
