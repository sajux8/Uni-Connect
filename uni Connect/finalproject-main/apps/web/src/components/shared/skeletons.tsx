import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Skeletons are the same size as the real thing to avoid layout shift. Prefer these to spinners
 * for first load.
 */

export function PostCardSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border bg-card p-5">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-5 w-3/4" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="ml-auto h-4 w-20" />
      </div>
    </div>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="flex gap-4 rounded-xl border bg-card p-4">
      <Skeleton className="h-16 w-14 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2.5">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-2 w-full max-w-60 rounded-full" />
      </div>
      <Skeleton className="hidden h-8 w-24 sm:block" />
    </div>
  );
}

export function ListSkeleton({
  count = 4,
  item: Item = PostCardSkeleton,
  className,
}: {
  count?: number;
  item?: React.ComponentType;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <Item key={i} />
      ))}
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="mb-6 space-y-2">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading page">
      <PageHeaderSkeleton />
      <ListSkeleton />
    </div>
  );
}
