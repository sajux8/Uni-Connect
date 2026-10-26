"use client";

import { useEffect } from "react";

import { CenteredLayout } from "@/components/layout/centered-layout";
import { ErrorState } from "@/components/shared/error-state";

/** Catch-all error boundary for public and auth pages. The signed-in app has its own in (app)/error.tsx. */
export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <CenteredLayout>
      <ErrorState onRetry={retry} digest={error.digest} />
    </CenteredLayout>
  );
}
