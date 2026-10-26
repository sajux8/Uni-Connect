"use client";

import { MessagesSquare } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { RelativeTime } from "@/components/community/relative-time";
import { UserAvatar } from "@/components/shared/user-avatar";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ConversationSummary } from "@/server/queries/messages";

/**
 * Left pane of /messages. New messages in any
 * conversation arrive over Realtime (RLS: participants only) and refresh the list.
 */
export function ConversationList({
  userId,
  conversations,
}: {
  userId: string;
  conversations: ConversationSummary[];
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;
    let timer: number | undefined;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled || !data.session) return;
      await supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`inbox:${userId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
          window.clearTimeout(timer);
          timer = window.setTimeout(() => router.refresh(), 600);
        })
        .subscribe();
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, router]);

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
          <MessagesSquare className="size-5" aria-hidden />
        </span>
        <p className="font-extrabold">No conversations yet</p>
        <p className="text-sm text-muted-foreground">
          A private chat opens when a mentor accepts your request, or when you accept one.
        </p>
        <Link href="/mentors" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Find a mentor
        </Link>
      </div>
    );
  }

  return (
    <nav aria-label="Conversations">
      <ul className="space-y-1 p-2">
        {conversations.map((c) => {
          const href = `/messages/${c.id}`;
          const active = pathname === href;
          const preview = c.lastMessage
            ? c.lastMessage.deleted
              ? "Message deleted"
              : `${c.lastMessage.fromMe ? "You: " : ""}${c.lastMessage.body}`
            : c.topic;
          return (
            <li key={c.id}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                  active && "bg-accent",
                )}
              >
                <UserAvatar name={c.partner.name} src={c.partner.avatarUrl} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate", c.unread > 0 ? "font-extrabold" : "font-bold")}>
                      {c.partner.name}
                    </span>
                    <RelativeTime
                      date={c.lastMessageAt}
                      className="shrink-0 text-[11.5px] text-muted-foreground"
                    />
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-[13px]",
                        c.unread > 0 ? "font-semibold text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {preview}
                    </span>
                    {c.unread > 0 && (
                      <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] leading-5 font-bold text-primary-foreground">
                        <span className="sr-only">Unread messages: </span>
                        {c.unread > 9 ? "9+" : c.unread}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[11.5px] text-muted-foreground">
                    {c.iAmMentor ? "Mentee" : "Mentor"}
                    {c.status !== "accepted" && " · ended"} · {c.topic}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Two panes on desktop; on phones the list and the open chat take turns. */
export function MessagesShell({
  header,
  list,
  children,
}: {
  header: React.ReactNode;
  list: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const inThread = pathname !== "/messages";
  return (
    <>
      <div className={cn(inThread && "max-md:hidden")}>{header}</div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[300px_minmax(0,1fr)] lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside
          className={cn(
            "min-h-0 overflow-y-auto rounded-[22px] border bg-card shadow-soft md:h-[calc(100dvh-17rem)] md:min-h-[480px]",
            inThread && "max-md:hidden",
          )}
        >
          {list}
        </aside>
        <div className={cn("min-w-0", !inThread && "max-md:hidden")}>{children}</div>
      </div>
    </>
  );
}
