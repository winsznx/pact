import { hexToString, recoverMessageAddress } from "viem";

import type { Address, AttestationFields, Hex, VerifyResult } from "./types.js";

export interface VerifyArgs {
  /** Canonical attestation text bytes (EIP-191 will be applied internally). */
  text: Hex;
  /** ECDSA signature returned by the TEE provider. */
  signature: Hex;
  /** Service's registered signing address — must match the recovered signer. */
  expectedSigner: Address;
}

/**
 * Local ECDSA verification of a PACT attestation. Same primitive
 * `AttestationVerifier.sol` runs on-chain — same bytes, same hash, same
 * recovered address. If `recoveredSigner === expectedSigner`, the
 * attestation is authentic.
 *
 * No RPC calls. No external state. Pure cryptography.
 */
export async function verifyAttestation(args: VerifyArgs): Promise<VerifyResult> {
  const recoveredSigner = (await recoverMessageAddress({
    message: { raw: args.text },
    signature: args.signature,
  })) as Address;

  return {
    ok: recoveredSigner.toLowerCase() === args.expectedSigner.toLowerCase(),
    recoveredSigner,
    expectedSigner: args.expectedSigner,
  };
}

/**
 * Parse the 5-field canonical attestation text:
 *   <contentHash>:<usageHash>:<providerType>:<providerIdentity>:<tlsCertFingerprint>
 *
 * The bytes are colon-separated ASCII. `AttestationVerifier.parseAttestationText`
 * runs the same split on-chain.
 */
export function decodeAttestationText(text: Hex): AttestationFields {
  const decoded = hexToString(text);
  const parts = decoded.split(":");
  if (parts.length !== 5) {
    throw new Error(
      `attestation text must have 5 colon-separated fields, got ${parts.length}`,
    );
  }
  const [contentHash, usageHash, providerType, providerIdentity, tlsCertFingerprint] = parts;
  if (
    contentHash === undefined ||
    usageHash === undefined ||
    providerType === undefined ||
    providerIdentity === undefined ||
    tlsCertFingerprint === undefined
  ) {
    throw new Error("attestation text parsing produced undefined field");
  }
  return {
    contentHash: contentHash as `0x${string}`,
    usageHash: usageHash as `0x${string}`,
    providerType,
    providerIdentity,
    tlsCertFingerprint: tlsCertFingerprint as Hex,
  };
}

export class AttestationsAPI {
  verify(args: VerifyArgs): Promise<VerifyResult> {
    return verifyAttestation(args);
  }
  decode(text: Hex): AttestationFields {
    return decodeAttestationText(text);
  }
}
