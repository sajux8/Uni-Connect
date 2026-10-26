"use client";

import {
  ArrowLeft,
  Ban,
  Check,
  Flag,
  Lock,
  MoreHorizontal,
  Pencil,
  SendHorizontal,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

import { ConversationMenu } from "@/components/messages/conversation-menu";
import { CategoryChip } from "@/components/shared/badges";
import { ReportDialog } from "@/components/shared/report-dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { addCampusDays, campusDay, formatCampus } from "@/lib/campus-time";
import { canEditMessage, linkifyParts, MESSAGE_MAX, startsGroup } from "@/lib/mentorship";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  deleteMessage,
  editMessage,
  loadEarlierMessages,
  markConversationRead,
  sendMessage,
} from "@/server/actions/messages";
import type { ChatMessage, ConversationDetail } from "@/server/queries/messages";

type Row = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};

type LocalMessage = ChatMessage & { pending?: boolean; failed?: boolean };

function fromRow(row: Row): ChatMessage {
  return {
    id: row.id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
  };
}

/** Inserts or replaces by id, keeping time order. */
function upsert(list: LocalMessage[], message: LocalMessage): LocalMessage[] {
  const index = list.findIndex((m) => m.id === message.id);
  if (index >= 0) {
    const next = list.slice();
    next[index] = message;
    return next;
  }
  return [...list, message].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

/**
 * The open conversation. Plain text
 * only; links are made clickable. Realtime brings in new, edited and deleted messages and
 * the other person's read marker.
 */
export function ChatThread({
  conversation,
  userId,
}: {
  conversation: ConversationDetail;
  userId: string;
}) {
  const router = useRouter();
  const { partner, request } = conversation;
  const first = partner.name.split(" ")[0];
  const [messages, setMessages] = useState<LocalMessage[]>(conversation.messages);
  const [hasMore, setHasMore] = useState(conversation.hasMore);
  const [partnerRead, setPartnerRead] = useState(conversation.partnerLastReadAt);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [today, setToday] = useState("");
  const [loadingEarlier, startLoadingEarlier] = useTransition();
  const scroller = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  const readTimer = useRef<number | undefined>(undefined);

  // Clock for "edit within 15 minutes" and the Today/Yesterday dividers.
  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
      setToday(campusDay(new Date()));
    };
    tick();
    const interval = window.setInterval(tick, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const markRead = useCallback(() => {
    window.clearTimeout(readTimer.current);
    readTimer.current = window.setTimeout(() => {
      if (document.visibilityState === "visible") void markConversationRead(conversation.id);
    }, 800);
  }, [conversation.id]);

  // Opening the chat reads it; refresh once so the list and badges catch up.
  useEffect(() => {
    void markConversationRead(conversation.id).then(() => router.refresh());
    const onVisible = () => {
      if (document.visibilityState === "visible") markRead();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearTimeout(readTimer.current);
    };
  }, [conversation.id, router, markRead]);

  // Realtime: messages in this conversation and the partner's read marker.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled || !data.session) return;
      await supabase.realtime.setAuth(data.session.access_token);
      const filter = `conversation_id=eq.${conversation.id}`;
      channel = supabase
        .channel(`conversation:${conversation.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter },
          (payload) => {
            const row = payload.new as Row;
            setMessages((list) => upsert(list, fromRow(row)));
            if (row.sender_id !== userId) markRead();
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "messages", filter },
          (payload) => {
            setMessages((list) => upsert(list, fromRow(payload.new as Row)));
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "conversation_participants", filter },
          (payload) => {
            const row = payload.new as { user_id: string; last_read_at: string | null };
            if (row.user_id === partner.id) setPartnerRead(row.last_read_at);
          },
        )
        .subscribe();
    });
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [conversation.id, partner.id, userId, markRead]);

  // Keep the newest message in view unless the reader scrolled up.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function onScroll() {
    const el = scroller.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  async function send() {
    const body = draft.trim();
    if (!body) return;
    if (body.length > MESSAGE_MAX) {
      toast.error(`Messages can be up to ${MESSAGE_MAX} characters.`);
      return;
    }
    const tempId = `temp-${Math.random().toString(36).slice(2)}`;
    const temp: LocalMessage = {
      id: tempId,
      senderId: userId,
      body,
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedAt: null,
      pending: true,
    };
    stickToBottom.current = true;
    setDraft("");
    setMessages((list) => [...list, temp]);
    const result = await sendMessage(conversation.id, body);
    setMessages((list) => {
      const without = list.filter((m) => m.id !== tempId);
      if (result.ok) return upsert(without, result.data);
      return [...without, { ...temp, pending: false, failed: true }];
    });
    if (!result.ok) {
      toast.error(result.error);
      if (!conversation.canMessage) router.refresh();
    }
  }

  function retry(message: LocalMessage) {
    setMessages((list) => list.filter((m) => m.id !== message.id));
    setDraft(message.body);
    composer.current?.focus();
  }

  async function saveEdit() {
    if (!editing) return;
    const result = await editMessage(editing.id, editing.body);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setMessages((list) => upsert(list, result.data));
    setEditing(null);
  }

  async function remove(id: string) {
    const result = await deleteMessage(id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setMessages((list) => upsert(list, result.data));
    toast.success("Message deleted.");
  }

  function loadEarlier() {
    const oldest = messages.find((m) => !m.pending);
    if (!oldest) return;
    const el = scroller.current;
    const fromBottom = el ? el.scrollHeight - el.scrollTop : 0;
    startLoadingEarlier(async () => {
      const result = await loadEarlierMessages(conversation.id, oldest.createdAt);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      stickToBottom.current = false;
      setMessages((list) => result.data.messages.reduce(upsert, list));
      setHasMore(result.data.hasMore);
      // Keep the reader's place after older messages are added above.
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - fromBottom;
      });
    });
  }

  const lastMine = [...messages]
    .reverse()
    .find((m) => m.senderId === userId && !m.pending && !m.failed);
  const seen = Boolean(
    lastMine && partnerRead && Date.parse(partnerRead) >= Date.parse(lastMine.createdAt),
  );
  const yesterday = today ? addCampusDays(today, -1) : "";
  const closedReason = conversation.blockedByMe
    ? `You blocked ${first}. Unblock them in Settings → Privacy to message again.`
    : request.status !== "accepted"
      ? request.endedBy === userId
        ? "You ended this mentorship. You can still read the conversation."
        : `This mentorship has ended. You can still read the conversation.`
      : !conversation.canMessage
        ? `You can't message ${first} right now.`
        : null;

  return (
    <section
      aria-label={`Conversation with ${partner.name}`}
      className="flex h-[calc(100dvh-12.5rem)] min-h-[420px] flex-col overflow-hidden rounded-[22px] border bg-card shadow-soft md:h-[calc(100dvh-17rem)] md:min-h-[480px]"
    >
      <header className="flex items-center gap-3 border-b px-3 py-3 sm:px-4">
        <Link
          href="/messages"
          aria-label="Back to conversations"
          className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-accent md:hidden"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <UserAvatar name={partner.name} src={partner.avatarUrl} size="md" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-extrabold">
            {partner.username ? (
              <Link href={`/u/${partner.username}`} className="hover:text-primary">
                {partner.name}
              </Link>
            ) : (
              partner.name
            )}
          </h2>
          <p className="truncate text-[13px] text-muted-foreground">
            {request.iAmMentor ? "Your mentee" : "Your mentor"} · {request.topic}
          </p>
        </div>
        {request.status !== "accepted" && <CategoryChip>Ended</CategoryChip>}
        <ConversationMenu
          partner={partner}
          requestId={request.id}
          active={request.status === "accepted"}
          blockedByMe={conversation.blockedByMe}
        />
      </header>

      <div
        ref={scroller}
        onScroll={onScroll}
        className="flex-1 space-y-1 overflow-y-auto px-3 py-4 sm:px-5"
        aria-live="polite"
        aria-relevant="additions"
      >
        {hasMore ? (
          <div className="flex justify-center pb-3">
            <Button variant="outline" size="sm" onClick={loadEarlier} disabled={loadingEarlier}>
              {loadingEarlier ? "Loading…" : "Load earlier messages"}
            </Button>
          </div>
        ) : (
          <div className="mx-auto mb-4 max-w-md space-y-3 text-center">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-surface-tint px-3 py-1.5 text-xs text-muted-foreground">
              <Lock className="size-3.5" aria-hidden />
              Messages are private between you and {first}. They&apos;re never used by AI search.
            </p>
            <div className="rounded-2xl border bg-surface-tint p-3.5 text-left text-sm">
              <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                Mentorship request
              </p>
              <p className="mt-1 font-bold">{request.topic}</p>
              <p className="mt-1 whitespace-pre-line text-muted-foreground">{request.message}</p>
              {request.responseNote && (
                <p className="mt-2 border-t pt-2">
                  <span className="font-semibold">
                    {request.iAmMentor ? "Your reply:" : `${first}'s reply:`}
                  </span>{" "}
                  {request.responseNote}
                </p>
              )}
            </div>
          </div>
        )}

        {messages.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {conversation.canMessage ? `Say hello to ${first}.` : "No messages."}
          </p>
        )}

        {messages.map((m, i) => {
          const previous = messages[i - 1];
          const day = campusDay(m.createdAt);
          const newDay = !previous || campusDay(previous.createdAt) !== day;
          const groupStart = newDay || startsGroup(previous, m);
          const mine = m.senderId === userId;
          const deleted = Boolean(m.deletedAt);
          const editable =
            mine &&
            !deleted &&
            !m.pending &&
            !m.failed &&
            now > 0 &&
            canEditMessage(m.createdAt, now);
          const isEditing = editing?.id === m.id;
          const next = messages[i + 1];
          const groupEnd = !next || campusDay(next.createdAt) !== day || startsGroup(m, next);
          const showMeta =
            groupEnd || m.pending || m.failed || Boolean(m.editedAt) || lastMine?.id === m.id;
          return (
            <Fragment key={m.id}>
              {newDay && (
                <div
                  className="flex items-center gap-3 py-3 text-xs font-semibold text-muted-foreground"
                  role="separator"
                >
                  <span className="h-px flex-1 bg-border" />
                  {day === today
                    ? "Today"
                    : day === yesterday
                      ? "Yesterday"
                      : formatCampus(m.createdAt, "dayLong")}
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}
              <div
                className={cn(
                  "group/msg flex items-end gap-1.5",
                  mine ? "justify-end" : "justify-start",
                  groupStart && "pt-2",
                )}
              >
                {mine && !deleted && !isEditing && !m.pending && !m.failed && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Message options"
                          className="opacity-100 sm:opacity-0 sm:group-hover/msg:opacity-100 sm:focus-visible:opacity-100 sm:aria-expanded:opacity-100"
                        />
                      }
                    >
                      <MoreHorizontal />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      {editable && (
                        <DropdownMenuItem onClick={() => setEditing({ id: m.id, body: m.body })}>
                          <Pencil /> Edit
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem variant="destructive" onClick={() => void remove(m.id)}>
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <div
                  className={cn(
                    "flex max-w-[85%] flex-col sm:max-w-[70%]",
                    mine ? "items-end" : "items-start",
                  )}
                >
                  {isEditing ? (
                    <div className="w-72 max-w-full space-y-2 rounded-2xl border bg-card p-2">
                      <label htmlFor="edit-message" className="sr-only">
                        Edit message
                      </label>
                      <textarea
                        id="edit-message"
                        value={editing.body}
                        onChange={(event) => setEditing({ id: m.id, body: event.target.value })}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void saveEdit();
                          }
                          if (event.key === "Escape") setEditing(null);
                        }}
                        maxLength={MESSAGE_MAX}
                        rows={3}
                        autoFocus
                        className="w-full resize-none rounded-xl bg-surface-tint p-2 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <div className="flex justify-end gap-1.5">
                        <Button size="xs" variant="ghost" onClick={() => setEditing(null)}>
                          Cancel
                        </Button>
                        <Button size="xs" onClick={() => void saveEdit()}>
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "rounded-[18px] px-3.5 py-2 text-[15px] leading-relaxed break-words whitespace-pre-wrap",
                        deleted
                          ? "border border-dashed bg-transparent text-muted-foreground italic"
                          : mine
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground",
                        m.pending && "opacity-70",
                        m.failed && "ring-2 ring-destructive",
                      )}
                    >
                      {deleted
                        ? "Message deleted"
                        : linkifyParts(m.body).map((part, index) =>
                            part.href ? (
                              <a
                                key={index}
                                href={part.href}
                                target="_blank"
                                rel="noopener noreferrer nofollow"
                                className="underline underline-offset-2"
                              >
                                {part.text}
                              </a>
                            ) : (
                              <Fragment key={index}>{part.text}</Fragment>
                            ),
                          )}
                    </div>
                  )}
                  {showMeta && (
                    <p className="mt-0.5 px-1 text-[11px] text-muted-foreground">
                      {m.failed ? (
                        <button
                          type="button"
                          className="font-semibold text-destructive"
                          onClick={() => retry(m)}
                        >
                          Not sent · Edit and retry
                        </button>
                      ) : m.pending ? (
                        "Sending…"
                      ) : (
                        <>
                          <time dateTime={m.createdAt}>{formatCampus(m.createdAt, "time")}</time>
                          {m.editedAt && !deleted && " · edited"}
                          {lastMine?.id === m.id && seen && (
                            <span className="inline-flex items-center gap-0.5">
                              {" · "}
                              <Check className="size-3" aria-hidden /> Seen
                            </span>
                          )}
                        </>
                      )}
                    </p>
                  )}
                </div>
                {!mine && !deleted && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Message options"
                          className="opacity-100 sm:opacity-0 sm:group-hover/msg:opacity-100 sm:focus-visible:opacity-100 sm:aria-expanded:opacity-100"
                        />
                      }
                    >
                      <MoreHorizontal />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-44">
                      <DropdownMenuItem onClick={() => setReporting(m.id)}>
                        <Flag /> Report message
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </Fragment>
          );
        })}
      </div>

      {reporting && (
        <ReportDialog
          targetType="message"
          targetId={reporting}
          open
          onOpenChange={(open) => !open && setReporting(null)}
        />
      )}

      {closedReason ? (
        <p className="flex items-center gap-2 border-t bg-surface-tint px-4 py-3.5 text-sm text-muted-foreground">
          <Ban className="size-4 shrink-0" aria-hidden />
          {closedReason}
        </p>
      ) : (
        <form
          className="flex items-end gap-2 border-t p-2.5 sm:p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <label htmlFor="message-composer" className="sr-only">
            Message {first}
          </label>
          <textarea
            id="message-composer"
            ref={composer}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void send();
              }
            }}
            rows={1}
            maxLength={MESSAGE_MAX}
            placeholder={`Message ${first}…`}
            className="[field-sizing:content] max-h-40 min-h-11 flex-1 resize-none rounded-[18px] border-[1.5px] border-input bg-card px-3.5 py-2.5 text-[15px] leading-snug outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30"
          />
          <Button type="submit" size="icon-lg" aria-label="Send message" disabled={!draft.trim()}>
            <SendHorizontal />
          </Button>
        </form>
      )}
    </section>
  );
}
