"use client";

import { RelatedDraft } from "@/components/ai/related-draft";
import { CircleHelp, MessagesSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { RichTextEditor } from "@/components/community/rich-text-editor";
import { TagSelect } from "@/components/community/tag-select";
import {
  describedBy,
  Field,
  FormErrorSummary,
  focusField,
  SelectInput,
  TextInput,
  type FieldErrorMap,
} from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MIN_POST_BODY, postSchema, roughTextLength, type PostInput } from "@/lib/validation/posts";
import * as z from "zod";

import { createPost, updatePost } from "@/server/actions/posts";

const DRAFT_KEY = "uniconnect:draft:new-post";

const LABELS: Record<string, string> = {
  spaceId: "Space",
  title: "Title",
  bodyHtml: "Details",
  tagIds: "Tags",
};

const TYPES = [
  {
    value: "question",
    label: "Question",
    hint: "Ask for help or advice. People can mark helpful answers.",
    icon: CircleHelp,
  },
  {
    value: "discussion",
    label: "Discussion",
    hint: "Share news, ideas or start a conversation.",
    icon: MessagesSquare,
  },
] as const;

export function PostComposer({
  spaces,
  tags,
  initial,
  postId,
}: {
  /** `batchOf`: for batch spaces, the department the post can be shared with. */
  spaces: { id: string; name: string; batchOf?: string | null }[];
  tags: { id: string; name: string }[];
  initial: PostInput;
  /** Editing an existing post (type and space are fixed). */
  postId?: string;
}) {
  const router = useRouter();
  const editing = Boolean(postId);
  const [form, setForm] = useState<PostInput>(initial);
  const [errors, setErrors] = useState<FieldErrorMap | null>(null);
  const [dirty, setDirty] = useState(false);
  const [restored, setRestored] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const loaded = useRef(false);

  // New posts: offer the saved draft back (once), then keep saving as you type.
  useEffect(() => {
    if (editing || loaded.current) return;
    loaded.current = true;
    try {
      const saved = window.localStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      const draft = JSON.parse(saved) as Partial<PostInput>;
      if (!draft.title && !draft.bodyHtml) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from storage
      setForm((f) => ({ ...f, ...draft, spaceId: f.spaceId || draft.spaceId || "" }));
      setEditorKey((k) => k + 1);
      setRestored(true);
    } catch {
      // Storage unavailable: no draft.
    }
  }, [editing]);

  useEffect(() => {
    if (editing || !dirty) return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      } catch {}
    }, 600);
    return () => window.clearTimeout(timer);
  }, [form, dirty, editing]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update<K extends keyof PostInput>(key: K, value: PostInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
    if (errors?.[key]) setErrors({ ...errors, [key]: undefined });
  }

  function discardDraft() {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {}
    setForm(initial);
    setEditorKey((k) => k + 1);
    setRestored(false);
    setDirty(false);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = postSchema.safeParse(form);
    const fieldErrors: FieldErrorMap = parsed.success
      ? {}
      : (z.flattenError(parsed.error).fieldErrors as FieldErrorMap);
    if (roughTextLength(form.bodyHtml) < MIN_POST_BODY) {
      fieldErrors.bodyHtml = [`Add a bit more detail (at least ${MIN_POST_BODY} characters).`];
    }
    if (Object.values(fieldErrors).some((e) => e?.[0])) {
      setErrors(fieldErrors);
      const first = Object.keys(LABELS).find((k) => fieldErrors[k]?.[0]);
      if (first) focusField(first);
      return;
    }

    startTransition(async () => {
      const result = postId ? await updatePost(postId, form) : await createPost(form);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? null);
        toast.error(result.error);
        return;
      }
      setDirty(false);
      if (!editing) {
        try {
          window.localStorage.removeItem(DRAFT_KEY);
        } catch {}
      }
      toast.success(result.message ?? "Saved.");
      router.push(`/posts/${result.data.id}`);
    });
  }

  const err = (key: string) => errors?.[key]?.[0];

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {errors && Object.values(errors).some((e) => e?.[0]) && (
        <FormErrorSummary errors={errors} labels={LABELS} />
      )}
      {restored && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-accent px-3.5 py-2.5 text-sm text-accent-foreground">
          <span>We restored your unsaved draft.</span>
          <button
            type="button"
            onClick={discardDraft}
            className="font-bold underline underline-offset-2"
          >
            Start over
          </button>
        </div>
      )}

      {!editing && (
        <fieldset>
          <legend className="mb-2 text-[13.5px] font-bold">What are you posting?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {TYPES.map((t) => (
              <label
                key={t.value}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-2xl border-[1.5px] bg-card p-4 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/30",
                  form.type === t.value
                    ? "border-primary bg-accent"
                    : "border-input hover:border-border-strong",
                )}
              >
                <input
                  type="radio"
                  name="type"
                  value={t.value}
                  checked={form.type === t.value}
                  onChange={() => update("type", t.value)}
                  className="sr-only"
                />
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-xl",
                    form.type === t.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <t.icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block font-bold">{t.label}</span>
                  <span className="block text-[13px] text-muted-foreground">{t.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {!editing && (
        <Field
          id="spaceId"
          label="Space"
          hint="Posting in a space you haven't joined will join it for you."
          error={err("spaceId")}
        >
          <SelectInput
            id="spaceId"
            value={form.spaceId}
            onChange={(event) => update("spaceId", event.target.value)}
            {...describedBy("spaceId", err("spaceId"), true)}
          >
            <option value="" disabled>
              Choose a space…
            </option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectInput>
        </Field>
      )}

      {(() => {
        const department = spaces.find((s) => s.id === form.spaceId)?.batchOf;
        if (!department) return null;
        const audience = form.audience ?? "batch";
        return (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-bold">Who can see this?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  {
                    value: "batch",
                    label: "My batch only",
                    hint: "Your batch, its lecturers and the coordinator.",
                  },
                  {
                    value: "department",
                    label: `Whole ${department} department`,
                    hint: "Also shown in the department space.",
                  },
                ] as const
              ).map((o) => (
                <label
                  key={o.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-2xl border-[1.5px] p-3.5 transition-colors",
                    audience === o.value
                      ? "border-primary/50 bg-accent"
                      : "border-input hover:border-border-strong",
                  )}
                >
                  <input
                    type="radio"
                    name="audience"
                    value={o.value}
                    checked={audience === o.value}
                    onChange={() => update("audience", o.value)}
                    className="mt-1 accent-primary"
                  />
                  <span>
                    <span className="block text-sm font-bold">{o.label}</span>
                    <span className="block text-xs text-muted-foreground">{o.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        );
      })()}

      <Field
        id="title"
        label="Title"
        hint={
          form.type === "question"
            ? "Ask it like you would to a friend: specific and clear."
            : "A short summary of what this is about."
        }
        error={err("title")}
      >
        <TextInput
          id="title"
          value={form.title}
          onChange={(event) => update("title", event.target.value)}
          maxLength={150}
          placeholder={
            form.type === "question"
              ? "e.g. How do I choose a final-year project supervisor?"
              : "e.g. Study group for the databases exam"
          }
          {...describedBy("title", err("title"), true)}
        />
      </Field>

      {!editing && form.type === "question" && <RelatedDraft title={form.title} />}

      <Field
        id="bodyHtml"
        label="Details"
        hint={
          form.type === "question"
            ? "Explain what you've tried and what you need help with."
            : undefined
        }
        error={err("bodyHtml")}
      >
        <RichTextEditor
          key={editorKey}
          id="bodyHtml"
          initialHtml={form.bodyHtml}
          onChange={(html) => update("bodyHtml", html)}
          placeholder={form.type === "question" ? "Add the details…" : "Write your post…"}
          minHeight="min-h-52"
          invalid={Boolean(err("bodyHtml"))}
          describedBy={err("bodyHtml") ? "bodyHtml-error" : undefined}
        />
      </Field>

      <TagSelect
        id="tagIds"
        tags={tags}
        value={form.tagIds}
        onChange={(ids) => update("tagIds", ids)}
        error={err("tagIds")}
      />

      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-5">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={pending}>
          {pending
            ? "Saving…"
            : editing
              ? "Save changes"
              : form.type === "question"
                ? "Post question"
                : "Publish post"}
        </Button>
      </div>
    </form>
  );
}
