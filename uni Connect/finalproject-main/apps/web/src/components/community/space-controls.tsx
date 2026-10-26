"use client";

import { Bell, Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { SelectInput } from "@/components/forms/field";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { NOTIFY_LEVELS, type NotifyLevel } from "@/lib/community";
import { decideJoinRequest, setNotifyLevel } from "@/server/actions/spaces";

/** "All posts / Important only / Muted" for a joined space (see notify_level in migration 0011). */
export function NotifySelect({ spaceId, initial }: { spaceId: string; initial: NotifyLevel }) {
  const [level, setLevel] = useState(initial);
  const [pending, startTransition] = useTransition();

  return (
    <label className="relative flex items-center">
      <span className="sr-only">Notifications for this space</span>
      <Bell
        className="pointer-events-none absolute left-3.5 z-10 size-4 text-muted-foreground"
        aria-hidden
      />
      <SelectInput
        value={level}
        disabled={pending}
        className="h-9 w-44 rounded-full pl-10 text-sm"
        onChange={(event) => {
          const next = event.target.value as NotifyLevel;
          const previous = level;
          setLevel(next);
          startTransition(async () => {
            const result = await setNotifyLevel(spaceId, next);
            if (!result.ok) {
              setLevel(previous);
              toast.error(result.error);
            } else toast.success(result.message ?? "Saved.");
          });
        }}
      >
        {NOTIFY_LEVELS.map((n) => (
          <option key={n.value} value={n.value}>
            {n.label}
          </option>
        ))}
      </SelectInput>
    </label>
  );
}

export function JoinRequestItem({
  spaceId,
  user,
}: {
  spaceId: string;
  user: { userId: string; fullName: string; username: string; avatarUrl: string | null };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function decide(approve: boolean) {
    startTransition(async () => {
      const result = await decideJoinRequest(spaceId, user.userId, approve);
      if (!result.ok) return void toast.error(result.error);
      toast.success(result.message ?? "Done.");
      router.refresh();
    });
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <UserAvatar name={user.fullName} src={user.avatarUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{user.fullName}</p>
        <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
      </div>
      <Button size="sm" onClick={() => decide(true)} disabled={pending}>
        <Check data-icon="inline-start" /> Approve
      </Button>
      <Button size="sm" variant="outline" onClick={() => decide(false)} disabled={pending}>
        <X data-icon="inline-start" /> Decline
      </Button>
    </li>
  );
}
