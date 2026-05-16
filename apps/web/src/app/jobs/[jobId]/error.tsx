"use client";

import { ErrorFallback } from "@/components/ui/ErrorFallback";

export default function JobDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} routeLabel="Job detail" />;
}
