import type { Job, Service } from "@trypact/sdk";

/**
 * In-memory event store. Rebuilt from chain on startup (scan from
 * DEPLOY_BLOCK). Polling layer (poller.ts) keeps it warm with new
 * events as they land. For hackathon scale (~tens of services, hundreds
 * of jobs) this trivially fits in process memory and survives any
 * Railway restart with a 5-second rebuild.
 *
 * Persistence via Supabase / Postgres is the v0.2 path — but for v0.1
 * this avoids an external dep and keeps the deploy a single-process box.
 */
export interface Store {
  lastBlock: bigint | null;
  services: Map<bigint, Service>;
  jobs: Map<bigint, Job>;
  /** address.toLowerCase() → set of serviceIds the seller owns */
  sellerServices: Map<string, Set<bigint>>;
  /** address.toLowerCase() → set of jobIds where this address was buyer or seller */
  addressJobs: Map<string, Set<bigint>>;
  /** Counters maintained incrementally to avoid O(n) scans per /v1/stats call */
  counters: {
    settledJobs: number;
    expiredJobs: number;
    slashedJobs: number;
    totalSettledWei: bigint;
  };
}

export const store: Store = {
  lastBlock: null,
  services: new Map(),
  jobs: new Map(),
  sellerServices: new Map(),
  addressJobs: new Map(),
  counters: {
    settledJobs: 0,
    expiredJobs: 0,
    slashedJobs: 0,
    totalSettledWei: 0n,
  },
};

export function upsertService(svc: Service): void {
  store.services.set(svc.serviceId, svc);
  const key = svc.seller.toLowerCase();
  const ids = store.sellerServices.get(key) ?? new Set();
  ids.add(svc.serviceId);
  store.sellerServices.set(key, ids);
}

export function upsertJob(prev: Job | undefined, next: Job): void {
  store.jobs.set(next.jobId, next);
  for (const addr of [next.buyer, next.seller]) {
    const key = addr.toLowerCase();
    const ids = store.addressJobs.get(key) ?? new Set();
    ids.add(next.jobId);
    store.addressJobs.set(key, ids);
  }
  // Counters: only credit transitions, not repeated reads of the same state.
  if (prev?.state !== next.state) {
    if (next.state === 3 /* Settled */) {
      store.counters.settledJobs += 1;
      store.counters.totalSettledWei += next.amount;
    } else if (next.state === 4 /* Expired */) {
      store.counters.expiredJobs += 1;
    } else if (next.state === 6 /* Slashed */) {
      store.counters.slashedJobs += 1;
    }
  }
}
