"use client";

import {
  CircleCheck,
  EllipsisVertical,
  EyeOff,
  Flag,
  Pencil,
  Reply,
  RotateCcw,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmAction, ReasonDialog } from "@/components/community/confirm-dialogs";
import { RelativeTime } from "@/components/community/relative-time";
import { ReplyComposer } from "@/components/community/reply-composer";
import { RichTextContent } from "@/components/community/rich-text-content";
import { RoleBadge } from "@/components/shared/badges";
import { ReportDialog } from "@/components/shared/report-dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { acceptReply, deleteReply, moderateReply, toggleHelpful } from "@/server/actions/replies";
import type { ReplyItem as ReplyData } from "@/server/queries/posts";

export interface ThreadContext {
  postId: string;
  isQuestion: boolean;
  isLocked: boolean;
  viewerId: string;
  /** Question author or moderator. */
  canAccept: boolean;
  isModerator: boolean;
}

export function ReplyItem({
  reply,
  thread,
  accepted,
  nested,
  children,
}: {
  reply: ReplyData;
  thread: ThreadContext;
  accepted: boolean;
  nested?: boolean;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [helpful, setHelpful] = useState(reply.viewerFoundHelpful);
  const [count, setCount] = useState(reply.helpfulCount);
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hideOpen, setHideOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const own = reply.author?.id === thread.viewerId;
  const removed =
    reply.status === "deleted" || (reply.status !== "visible" && !thread.isModerator && !own);

  function toggle() {
    const next = !helpful;
    setHelpful(next);
    setCount((c) => c + (next ? 1 : -1));
    startTransition(async () => {
      const result = await toggleHelpful(reply.id, next);
      if (!result.ok) {
        setHelpful(!next);
        setCount((c) => c + (next ? -1 : 1));
        toast.error(result.error);
      }
    });
  }

  function accept() {
    startTransition(async () => {
      const result = await acceptReply(reply.id, thread.postId);
      if (!result.ok) return void toast.error(result.error);
      toast.success(result.message ?? "Done.");
      router.refresh();
    });
  }

  if (removed) {
    return (
      <div className={cn("space-y-3", nested && "ml-6 sm:ml-12")}>
        <p className="rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground italic">
          {reply.status === "deleted"
            ? "This reply was deleted."
            : "This reply was hidden by a moderator."}
        </p>
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn("space-y-3", nested && "ml-6 border-l-2 border-border pl-4 sm:ml-10 sm:pl-6")}
    >
      <article
        id={`reply-${reply.id}`}
        aria-label={`Reply from ${reply.author?.fullName ?? "a former member"}`}
        className={cn(
          "scroll-mt-24 rounded-[22px] border bg-card p-5 shadow-soft",
          accepted && "border-success/50 bg-success/[0.04] ring-1 ring-success/30",
          reply.status === "hidden" && "border-dashed opacity-75",
        )}
      >
        {accepted && (
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-success/12 px-2.5 py-1 text-xs font-extrabold text-success">
            <CircleCheck className="size-3.5" aria-hidden /> Accepted answer
          </p>
        )}
        {reply.status === "hidden" && (
          <p className="mb-3 text-xs font-bold text-warning">
            Hidden by a moderator · only you and moderators see this
          </p>
        )}

        <header className="mb-3 flex items-center gap-3">
          <UserAvatar
            name={reply.author?.fullName ?? "Former member"}
            src={reply.author?.avatarUrl}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5 text-sm">
              {reply.author ? (
                <Link
                  href={`/u/${reply.author.username}`}
                  className={cn(
                    "truncate font-bold hover:text-primary",
                    reply.author.isClassRep && "text-rep-foreground",
                  )}
                >
                  {reply.author.fullName}
                </Link>
              ) : (
                <span className="font-bold">Former member</span>
              )}
              {reply.author && reply.author.role !== "student" && (
                <RoleBadge role={reply.author.role} />
              )}
              {reply.author?.isClassRep && <RoleBadge role="rep" />}
            </p>
            <p className="text-xs text-muted-foreground">
              <RelativeTime date={reply.createdAt} />
              {reply.editedAt && <span title="This reply was edited"> · Edited</span>}
            </p>
          </div>
          {!removed && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="max-sm:size-10"
                    aria-label="Reply options"
                  />
                }
              >
                <EllipsisVertical />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {own && reply.status === "visible" && (
                  <DropdownMenuItem onClick={() => setEditing(true)}>
                    <Pencil /> Edit
                  </DropdownMenuItem>
                )}
                {own && (
                  <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                )}
                {thread.isModerator && !own && reply.status === "visible" && (
                  <DropdownMenuItem onClick={() => setHideOpen(true)}>
                    <EyeOff /> Hide reply
                  </DropdownMenuItem>
                )}
                {thread.isModerator && reply.status === "hidden" && (
                  <DropdownMenuItem
                    onClick={() =>
                      startTransition(async () => {
                        const r = await moderateReply(reply.id, thread.postId, "restore");
                        if (r.ok) {
                          toast.success(r.message ?? "Restored.");
                          router.refresh();
                        } else toast.error(r.error);
                      })
                    }
                  >
                    <RotateCcw /> Restore reply
                  </DropdownMenuItem>
                )}
                {!own && reply.status === "visible" && (
                  <DropdownMenuItem onClick={() => setReportOpen(true)}>
                    <Flag /> Report reply
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>

        {editing ? (
          <ReplyComposer
            postId={thread.postId}
            replyId={reply.id}
            initialHtml={reply.bodyHtml}
            autoFocus
            onDone={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <RichTextContent html={reply.bodyHtml} />
        )}

        {!editing && reply.status === "visible" && (
          <footer className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant={helpful ? "secondary" : "ghost"}
              size="sm"
              onClick={toggle}
              disabled={own || pending}
              aria-pressed={helpful}
              aria-label={
                own
                  ? `${count} people found this helpful`
                  : helpful
                    ? "Remove helpful vote"
                    : "Mark as helpful"
              }
              title={own ? "You can't vote on your own reply" : undefined}
              className={cn(helpful && "text-primary dark:text-accent-foreground")}
            >
              <ThumbsUp data-icon="inline-start" className={cn(helpful && "fill-current")} />
              Helpful{count > 0 ? ` · ${count}` : ""}
            </Button>
            {!nested && !thread.isLocked && (
              <Button variant="ghost" size="sm" onClick={() => setReplying((r) => !r)}>
                <Reply data-icon="inline-start" /> Reply
              </Button>
            )}
            {thread.isQuestion && thread.canAccept && !nested && (
              <Button
                variant={accepted ? "secondary" : "outline"}
                size="sm"
                onClick={accept}
                disabled={pending}
                className={cn("ml-auto", accepted && "text-success")}
              >
                <CircleCheck data-icon="inline-start" />
                {accepted ? "Unaccept" : "Accept answer"}
              </Button>
            )}
          </footer>
        )}
      </article>

      {replying && (
        <div className="ml-6 sm:ml-10">
          <ReplyComposer
            postId={thread.postId}
            parentReplyId={reply.id}
            placeholder={`Reply to ${reply.author?.fullName ?? "this reply"}…`}
            autoFocus
            onDone={() => setReplying(false)}
            onCancel={() => setReplying(false)}
          />
        </div>
      )}
      {children}

      <ConfirmAction
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this reply?"
        description="It will show as deleted in the thread. This can't be undone."
        confirmLabel="Delete reply"
        onConfirm={async () => {
          const r = await deleteReply(reply.id, thread.postId);
          if (r.ok) {
            toast.success(r.message ?? "Deleted.");
            router.refresh();
          } else toast.error(r.error);
        }}
      />
      <ReportDialog
        targetType="reply"
        targetId={reply.id}
        open={reportOpen}
        onOpenChange={setReportOpen}
      />
      <ReasonDialog
        open={hideOpen}
        onOpenChange={setHideOpen}
        title="Hide this reply?"
        description="Only moderators and the author will see it. The reason is recorded in the moderation log."
        confirmLabel="Hide reply"
        onConfirm={async (reason) => {
          const r = await moderateReply(reply.id, thread.postId, "hide", reason);
          if (r.ok) {
            toast.success(r.message ?? "Hidden.");
            router.refresh();
          } else toast.error(r.error);
          return r.ok;
        }}
      />
    </div>
  );
}
