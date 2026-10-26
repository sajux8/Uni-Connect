"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";

import { StateFrame } from "@/components/shared/states";
import { Button } from "@/components/ui/button";

/** Something went wrong: friendly message, retry, optional error digest. */
export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this. Check your connection and try again.",
  onRetry,
  digest,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  digest?: string;
  className?: string;
}) {
  return (
    <StateFrame
      icon={TriangleAlert}
      tone="danger"
      title={title}
      description={description}
      className={className}
    >
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <RotateCcw data-icon="inline-start" />
          Try again
        </Button>
      )}
      {digest && (
        <p className="text-xs font-semibold text-muted-foreground tabular-nums">
          Error ID: {digest}
        </p>
      )}
    </StateFrame>
  );
}
