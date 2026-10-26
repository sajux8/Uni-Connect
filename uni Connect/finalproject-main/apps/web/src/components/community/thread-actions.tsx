"use client";

import {
  Bell,
  BellOff,
  EllipsisVertical,
  EyeOff,
  Flag,
  FolderInput,
  Link2,
  Lock,
  LockOpen,
  Pencil,
  Pin,
  PinOff,
  RotateCcw,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmAction, ReasonDialog } from "@/components/community/confirm-dialogs";
import { ReportDialog } from "@/components/shared/report-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { deletePost, moderatePost, togglePostFollow, togglePostVote } from "@/server/actions/posts";

export function ThreadActions({
  post,
  moveTargets,
}: {
  post: {
    id: string;
    type: "discussion" | "question";
    status: "visible" | "hidden" | "removed" | "deleted";
    isPinned: boolean;
    isLocked: boolean;
    voteScore: number;
    spaceSlug: string;
    viewer: { hasVoted: boolean; isFollowing: boolean; isAuthor: boolean; isModerator: boolean };
  };
  moveTargets: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [voted, setVoted] = useState(post.viewer.hasVoted);
  const [score, setScore] = useState(post.voteScore);
  const [following, setFollowing] = useState(post.viewer.isFollowing);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reasonFor, setReasonFor] = useState<"hide" | "move" | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function vote() {
    const next = !voted;
    setVoted(next);
    setScore((s) => s + (next ? 1 : -1));
    startTransition(async () => {
      const r = await togglePostVote(post.id, next);
      if (!r.ok) {
        setVoted(!next);
        setScore((s) => s + (next ? -1 : 1));
        toast.error(r.error);
      }
    });
  }

  function follow() {
    const next = !following;
    setFollowing(next);
    startTransition(async () => {
      const r = await togglePostFollow(post.id, next);
      if (!r.ok) {
        setFollowing(!next);
        toast.error(r.error);
      } else toast.success(r.message ?? "Saved.");
    });
  }

  function moderate(action: string, reason?: string, spaceId?: string) {
    return new Promise<boolean>((resolve) =>
      startTransition(async () => {
        const r = await moderatePost(post.id, { action, reason, spaceId });
        if (r.ok) {
          toast.success(r.message ?? "Done.");
          router.refresh();
        } else toast.error(r.error);
        resolve(r.ok);
      }),
    );
  }

  async function share() {
    const url = `${window.location.origin}/posts/${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied.");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  const { viewer } = post;
  const canEdit = viewer.isAuthor && post.status === "visible" && !post.isLocked;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {post.type === "discussion" && (
        <Button
          variant={voted ? "secondary" : "outline"}
          size="sm"
          onClick={vote}
          disabled={viewer.isAuthor || pending}
          aria-pressed={voted}
          title={viewer.isAuthor ? "You can't vote on your own post" : undefined}
          className={cn(voted && "text-primary dark:text-accent-foreground")}
        >
          <ThumbsUp data-icon="inline-start" className={cn(voted && "fill-current")} />
          {score > 0 ? score : "Upvote"}
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={follow}
        disabled={pending}
        aria-pressed={following}
      >
        {following ? <BellOff data-icon="inline-start" /> : <Bell data-icon="inline-start" />}
        {following ? "Following" : "Follow"}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="max-sm:size-10"
        onClick={share}
        aria-label="Copy link to this post"
      >
        <Link2 />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="max-sm:size-10"
              aria-label="Post options"
            />
          }
        >
          <EllipsisVertical />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {viewer.isAuthor && (
            <DropdownMenuGroup>
              {canEdit && (
                <DropdownMenuItem render={<Link href={`/posts/${post.id}/edit`} />}>
                  <Pencil /> Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuGroup>
          )}
          {viewer.isModerator && (
            <>
              {viewer.isAuthor && <DropdownMenuSeparator />}
              <DropdownMenuGroup>
                <DropdownMenuLabel>Moderation</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => moderate(post.isPinned ? "unpin" : "pin")}>
                  {post.isPinned ? <PinOff /> : <Pin />} {post.isPinned ? "Unpin" : "Pin to top"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => moderate(post.isLocked ? "unlock" : "lock")}>
                  {post.isLocked ? <LockOpen /> : <Lock />}{" "}
                  {post.isLocked ? "Unlock replies" : "Lock replies"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setReasonFor("move")}>
                  <FolderInput /> Move to another space
                </DropdownMenuItem>
                {post.status === "hidden" ? (
                  <DropdownMenuItem onClick={() => moderate("restore")}>
                    <RotateCcw /> Restore post
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem variant="destructive" onClick={() => setReasonFor("hide")}>
                    <EyeOff /> Hide post
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
            </>
          )}
          {!viewer.isAuthor && (
            <>
              {viewer.isModerator && <DropdownMenuSeparator />}
              <DropdownMenuItem onClick={() => setReportOpen(true)}>
                <Flag /> Report post
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ReportDialog
        targetType="post"
        targetId={post.id}
        open={reportOpen}
        onOpenChange={setReportOpen}
      />

      <ConfirmAction
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this post?"
        description="It will be removed from the space. Replies stay with it and also disappear. This can't be undone."
        confirmLabel="Delete post"
        onConfirm={async () => {
          const r = await deletePost(post.id);
          if (r.ok) {
            toast.success(r.message ?? "Deleted.");
            router.push(`/spaces/${post.spaceSlug}`);
          } else toast.error(r.error);
        }}
      />
      <ReasonDialog
        open={reasonFor !== null}
        onOpenChange={(open) => !open && setReasonFor(null)}
        title={reasonFor === "move" ? "Move this post" : "Hide this post?"}
        description={
          reasonFor === "move"
            ? "The author can still find it in its new space. The reason is recorded in the moderation log."
            : "Only moderators and the author will see it. The reason is recorded in the moderation log."
        }
        confirmLabel={reasonFor === "move" ? "Move post" : "Hide post"}
        spaces={reasonFor === "move" ? moveTargets : undefined}
        onConfirm={(reason, spaceId) => moderate(reasonFor ?? "hide", reason, spaceId)}
      />
    </div>
  );
}
