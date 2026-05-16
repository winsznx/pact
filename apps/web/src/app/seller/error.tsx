"use client";

import { ErrorFallback } from "@/components/ui/ErrorFallback";

export default function SellerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} routeLabel="Seller" />;
}
