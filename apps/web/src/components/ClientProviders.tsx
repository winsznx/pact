"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

// Skip SSR for the entire wagmi/RainbowKit subtree. See Providers.tsx
// NatSpec for the indexedDB-during-SSR rationale. The landing page renders
// server-side without provider context (no wagmi hooks at the rendered
// nodes for CHUNK 1); RainbowKit ConnectButton in Nav mounts on hydrate.
const Providers = dynamic(
  () => import("./Providers").then((m) => m.Providers),
  { ssr: false, loading: () => null },
);

export function ClientProviders({ children }: { children: ReactNode }) {
  return <Providers>{children}</Providers>;
}
