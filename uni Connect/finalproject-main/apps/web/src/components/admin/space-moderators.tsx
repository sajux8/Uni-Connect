"use client";

import { Search, UserMinus, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { inputClass } from "@/components/forms/field";
import { SettingsSection } from "@/components/settings/settings-section";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { findMembers, setSpaceArchived, setSpaceModerator } from "@/server/actions/catalog";

/** Admins choose who moderates a space (join requests, hiding posts, pinning…). */
export function SpaceModerators({
  spaceId,
  moderators,
}: {
  spaceId: string;
  moderators: { id: string; name: string; username: string; avatarUrl: string | null }[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; username: string }[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const q = query.trim();
    const timer = window.setTimeout(async () => {
      if (q.length < 2) {
        setResults([]);
        return;
      }
      const result = await findMembers(q);
      if (result.ok) setResults(result.data.filter((p) => !moderators.some((m) => m.id === p.id)));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, moderators]);

  function change(userId: string, moderator: boolean) {
    startTransition(async () => {
      const result = await setSpaceModerator(spaceId, userId, moderator);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Saved.");
      setQuery("");
      setResults([]);
      router.refresh();
    });
  }

  return (
    <SettingsSection
      title="Space moderators"
      description="They can approve join requests, pin, lock, move and hide posts in this space. Coordinators and super admins can always do this."
    >
      {moderators.length > 0 ? (
        <ul className="divide-y rounded-2xl border">
          {moderators.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-4 py-3">
              <UserAvatar name={m.name} src={m.avatarUrl} size="sm" />
              <span className="min-w-0 flex-1 truncate font-semibold">{m.name}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => change(m.id, false)}
                aria-label={`Remove ${m.name} as moderator`}
              >
                <UserMinus data-icon="inline-start" /> Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No space moderators yet.</p>
      )}
      <div className="space-y-2">
        <label htmlFor="moderator-search" className="text-[13.5px] font-bold">
          Add a moderator
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id="moderator-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or username"
            className={cn(inputClass, "pl-10")}
          />
        </div>
        {results.length > 0 && (
          <ul className="divide-y rounded-2xl border">
            {results.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm">
                  <span className="font-semibold">{p.name}</span>{" "}
                  <span className="text-muted-foreground">@{p.username}</span>
                </span>
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => change(p.id, true)}
                  aria-label={`Make ${p.name} a moderator`}
                >
                  <UserPlus data-icon="inline-start" /> Add
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SettingsSection>
  );
}

export function ArchiveSpaceButton({ spaceId, archived }: { spaceId: string; archived: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant={archived ? "outline" : "destructive"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await setSpaceArchived(spaceId, !archived);
          if (result.ok) {
            toast.success(result.message ?? "Saved.");
            router.refresh();
          } else toast.error(result.error);
        })
      }
    >
      {archived ? "Restore space" : "Archive space"}
    </Button>
  );
}
