"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toggleBookmark } from "@/server/actions/bookmarks";

/** Save / unsave a post, event, announcement, resource or opportunity (Feature 8). Updates instantly. */
export function BookmarkButton({
  type,
  id,
  initial,
  withLabel = false,
  className,
}: {
  type: "post" | "event" | "announcement" | "resource" | "opportunity";
  id: string;
  initial: boolean;
  withLabel?: boolean;
  className?: string;
}) {
  const [saved, setSaved] = useState(initial);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !saved;
    setSaved(next);
    startTransition(async () => {
      const result = await toggleBookmark(type, id, next);
      if (!result.ok) {
        setSaved(!next);
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? (next ? "Saved." : "Removed."), {
        action: {
          label: "Undo",
          onClick: () => void toggleBookmark(type, id, !next).then(() => setSaved(!next)),
        },
      });
    });
  }

  const Icon = saved ? BookmarkCheck : Bookmark;
  return (
    <Button
      type="button"
      variant={withLabel ? "outline" : "ghost"}
      size={withLabel ? "default" : "icon"}
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      aria-label={withLabel ? undefined : saved ? "Remove bookmark" : "Bookmark"}
      className={cn(saved && "text-primary dark:text-accent-foreground", className)}
    >
      <Icon
        data-icon={withLabel ? "inline-start" : undefined}
        className={cn(saved && "fill-current")}
      />
      {withLabel && (saved ? "Saved" : "Save")}
    </Button>
  );
}
