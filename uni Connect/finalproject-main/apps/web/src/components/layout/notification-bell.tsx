"use client";

import { Bell, BellRing } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { iconCircle } from "@/components/layout/icon-circle";
import { NotificationRow } from "@/components/notifications/notification-row";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/server/queries/notifications";
import { fetchRecentNotifications, markAllNotificationsRead } from "@/server/actions/notifications";

type Row = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

/**
 * Bell with the unread count and a popover of the latest notifications (Feature 9).
 * New notifications arrive over Realtime (RLS limits the stream to the user's own rows).
 */
export function NotificationBell({
  userId,
  initialCount,
}: {
  userId: string;
  initialCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [seenInitial, setSeenInitial] = useState(initialCount);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const refetchTimer = useRef<number | undefined>(undefined);

  // The server's count wins whenever the layout re-renders (e.g. after marking things read).
  if (initialCount !== seenInitial) {
    setSeenInitial(initialCount);
    setCount(initialCount);
  }

  const load = useCallback(async () => {
    const result = await fetchRecentNotifications();
    if (result.ok) {
      setItems(result.data.items);
      setCount(result.data.unread);
      setError(false);
    } else setError(true);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;

    // Hand the session to Realtime first, or the socket is anonymous and RLS hides every row.
    void supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled || !data.session) return;
      await supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const row = payload.new as Row;
            setCount((c) => c + 1);
            setItems((current) =>
              current
                ? [
                    {
                      id: row.id,
                      type: row.type,
                      title: row.title,
                      body: row.body,
                      link: row.link,
                      readAt: row.read_at,
                      createdAt: row.created_at,
                      actor: null,
                    },
                    ...current,
                  ].slice(0, 8)
                : current,
            );
            // No toast for the page you're already on (e.g. the open conversation).
            if (row.link !== window.location.pathname) {
              toast(row.title, {
                description: row.type === "announcement" ? "New announcement" : undefined,
                action: row.link
                  ? { label: "Open", onClick: () => router.push(row.link!) }
                  : undefined,
              });
            }
            // Announcements and messages also change the sidebar's unread badges.
            if (row.type === "announcement" || row.type === "new_message") router.refresh();
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            // "Mark all read" sends one event per row: refetch once they settle.
            window.clearTimeout(refetchTimer.current);
            refetchTimer.current = window.setTimeout(() => void load(), 500);
          },
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      window.clearTimeout(refetchTimer.current);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, router, load]);

  function markAll() {
    startTransition(async () => {
      const result = await markAllNotificationsRead();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCount(0);
      setItems(
        (current) =>
          current?.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ?? null,
      );
    });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void load();
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(iconCircle, "relative")}
            aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
          />
        }
      >
        <Bell className="size-[18px]" aria-hidden />
        {count > 0 && (
          <span
            aria-hidden
            className="absolute -top-1.5 -right-1.5 grid min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] leading-[18px] font-bold text-primary-foreground ring-2 ring-background"
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] max-w-[calc(100vw-1.5rem)] gap-0 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Notifications</h2>
          <Button variant="ghost" size="xs" disabled={count === 0 || pending} onClick={markAll}>
            Mark all read
          </Button>
        </div>
        <div className="max-h-[26rem] overflow-y-auto p-1.5">
          {items === null && !error ? (
            <div className="space-y-2 p-2" aria-label="Loading notifications">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="size-9 rounded-xl" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-4/5" />
                    <Skeleton className="h-3 w-2/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Couldn&apos;t load notifications.{" "}
              <button
                type="button"
                className="font-semibold text-primary"
                onClick={() => void load()}
              >
                Try again
              </button>
            </p>
          ) : items && items.length > 0 ? (
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <NotificationRow
                    item={item}
                    compact
                    onOpen={() => {
                      setOpen(false);
                      if (!item.readAt) setCount((c) => Math.max(0, c - 1));
                    }}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
                <BellRing className="size-4" aria-hidden />
              </span>
              <p className="text-sm font-medium">You&apos;re all caught up</p>
              <p className="text-[13px] text-muted-foreground">
                Replies, answers and announcements for you will show up here.
              </p>
            </div>
          )}
        </div>
        <div className="border-t p-2">
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block rounded-md px-2 py-1.5 text-center text-[13px] font-medium text-primary hover:bg-accent"
          >
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
