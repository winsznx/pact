"use client";

import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";

import { wagmiConfig } from "@/lib/wagmi";

/**
 * Single provider stack for the whole app. Wagmi → React Query → RainbowKit,
 * in that order — RainbowKit reads from both. QueryClient is created inside
 * useState so each browser tab gets its own.
 *
 * This file is loaded via a `next/dynamic({ ssr: false })` import in
 * `ClientProviders.tsx` — RainbowKit 2.2 transitively imports `idb-keyval`,
 * which calls `indexedDB.open` at module-load time and crashes Node SSR.
 * Skipping SSR for this whole subtree avoids that without a custom
 * webpack alias.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
