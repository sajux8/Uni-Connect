"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { RichTextEditor } from "@/components/community/rich-text-editor";
import { Button } from "@/components/ui/button";
import { roughTextLength } from "@/lib/validation/posts";
import { createReply, updateReply } from "@/server/actions/replies";

/** New reply, nested reply, or editing an existing reply. */
export function ReplyComposer({
  postId,
  parentReplyId,
  replyId,
  initialHtml = "",
  placeholder = "Write a reply…",
  autoFocus,
  onDone,
  onCancel,
}: {
  postId: string;
  parentReplyId?: string;
  /** Set when editing. */
  replyId?: string;
  initialHtml?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [html, setHtml] = useState(initialHtml);
  const [error, setError] = useState<string>();
  const [editorKey, setEditorKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const id = replyId
    ? `edit-${replyId}`
    : parentReplyId
      ? `reply-to-${parentReplyId}`
      : "new-reply";

  function submit() {
    if (roughTextLength(html) < 2) {
      setError("Write a reply first.");
      return;
    }
    startTransition(async () => {
      const result = replyId
        ? await updateReply(replyId, html)
        : await createReply({ postId, parentReplyId: parentReplyId ?? null, bodyHtml: html });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Saved.");
      setHtml("");
      setEditorKey((k) => k + 1);
      setError(undefined);
      onDone?.();
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="sr-only">
        {replyId ? "Edit your reply" : "Your reply"}
      </label>
      <RichTextEditor
        key={editorKey}
        id={id}
        initialHtml={initialHtml}
        onChange={(value) => {
          setHtml(value);
          if (error) setError(undefined);
        }}
        placeholder={placeholder}
        minHeight={parentReplyId || replyId ? "min-h-24" : "min-h-32"}
        invalid={Boolean(error)}
        describedBy={error ? `${id}-error` : undefined}
        autoFocus={autoFocus}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[13px] font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        )}
        <Button
          type="button"
          size={parentReplyId || replyId ? "sm" : "default"}
          onClick={submit}
          disabled={pending}
        >
          {pending ? "Posting…" : replyId ? "Save" : "Post reply"}
        </Button>
      </div>
    </div>
  );
}
