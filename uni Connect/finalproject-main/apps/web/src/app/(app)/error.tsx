"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/shared/error-state";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorState onRetry={retry} digest={error.digest} className="mt-10" />;
}
