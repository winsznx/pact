import type { PublicClient } from "viem";

import { PACT_ADDRESSES } from "./addresses.js";
import { PactRegistryAbi } from "./abis.js";
import type { Address, Hash, Service } from "./types.js";

/**
 * Tuple shape returned by viem from `getService` — kept private so
 * consumers see the named `Service` object, never the raw tuple.
 */
interface ServiceTuple {
  inftTokenId: bigint;
  seller: Address;
  capabilityHash: Hash;
  modelId: string;
  modelCommitment: Hash;
  providerAddress: Address;
  signingAddress: Address;
  providerIdentity: string;
  providerType: string;
  targetSeparated: boolean;
  pricePerCall: bigint;
  maxInputBytes: bigint;
  registeredAt: bigint;
  active: boolean;
}

function hydrate(serviceId: bigint, t: ServiceTuple): Service {
  return {
    serviceId,
    inftTokenId: t.inftTokenId,
    seller: t.seller,
    capabilityHash: t.capabilityHash,
    modelId: t.modelId,
    modelCommitment: t.modelCommitment,
    providerAddress: t.providerAddress,
    signingAddress: t.signingAddress,
    providerIdentity: t.providerIdentity,
    providerType: t.providerType,
    targetSeparated: t.targetSeparated,
    pricePerCall: t.pricePerCall,
    maxInputBytes: t.maxInputBytes,
    registeredAt: t.registeredAt,
    active: t.active,
  };
}

export class ServicesAPI {
  constructor(private readonly publicClient: PublicClient) {}

  /** Total services ever registered (next id minus one). */
  async count(): Promise<bigint> {
    const next = (await this.publicClient.readContract({
      address: PACT_ADDRESSES.PactRegistry,
      abi: PactRegistryAbi,
      functionName: "nextServiceId",
    })) as bigint;
    return next > 0n ? next - 1n : 0n;
  }

  /** Fetch a single service by id. */
  async get(serviceId: bigint): Promise<Service> {
    const tuple = (await this.publicClient.readContract({
      address: PACT_ADDRESSES.PactRegistry,
      abi: PactRegistryAbi,
      functionName: "getService",
      args: [serviceId],
    })) as ServiceTuple;
    return hydrate(serviceId, tuple);
  }

  /** Enumerate all services. Cheap on mainnet today; paginate at scale. */
  async list(): Promise<Service[]> {
    const total = await this.count();
    if (total === 0n) return [];
    const ids = Array.from({ length: Number(total) }, (_, i) => BigInt(i + 1));
    return Promise.all(ids.map((id) => this.get(id)));
  }
}
