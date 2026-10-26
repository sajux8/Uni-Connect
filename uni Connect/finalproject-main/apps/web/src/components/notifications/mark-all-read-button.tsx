"use client";

import { CheckCheck } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { markAllAnnouncementsRead } from "@/server/actions/announcements";
import { markAllNotificationsRead } from "@/server/actions/notifications";

/** "Mark all as read" for /notifications or /announcements. */
export function MarkAllReadButton({
  target,
  disabled,
}: {
  target: "notifications" | "announcements";
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={disabled || pending}
      onClick={() =>
        startTransition(async () => {
          const result =
            target === "notifications"
              ? await markAllNotificationsRead()
              : await markAllAnnouncementsRead();
          if (result.ok) toast.success(result.message ?? "Done.");
          else toast.error(result.error);
        })
      }
    >
      <CheckCheck data-icon="inline-start" />
      {pending ? "Marking…" : "Mark all as read"}
    </Button>
  );
}
