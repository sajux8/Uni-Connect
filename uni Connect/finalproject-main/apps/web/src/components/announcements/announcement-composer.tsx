"use client";

import { CalendarClock, FileText, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import * as z from "zod";

import { RichTextEditor } from "@/components/community/rich-text-editor";
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
import {
  ANNOUNCEMENT_CATEGORIES,
  audienceLabel,
  PUBLISHING_UNIT_SUGGESTIONS,
  type AnnouncementCategory,
} from "@/lib/announcements";
import { fromCampusInput, toCampusInput } from "@/lib/campus-time";
import { YEAR_OPTIONS } from "@/lib/campus";
import { cn } from "@/lib/utils";
import {
  announcementSchema,
  MIN_ANNOUNCEMENT_BODY,
  type AnnouncementInput,
} from "@/lib/validation/announcements";
import { roughTextLength } from "@/lib/validation/posts";
import { createAnnouncement, updateAnnouncement } from "@/server/actions/announcements";

/** What the form edits. Dates are campus time (see toCampusInput), as the inputs show them. */
export interface AnnouncementFormValues {
  title: string;
  bodyHtml: string;
  category: AnnouncementCategory;
  publishingUnit: string;
  audienceAll: boolean;
  departmentIds: string[];
  years: number[];
  pinned: boolean;
  /** yyyy-MM-dd or "" */
  pinnedUntil: string;
  important: boolean;
  mode: "publish" | "schedule" | "draft";
  /** yyyy-MM-ddTHH:mm or "" */
  publishAt: string;
}

const LABELS: Record<string, string> = {
  title: "Title",
  bodyHtml: "Message",
  category: "Category",
  publishingUnit: "From",
  audience: "Audience",
  pinnedUntil: "Pin until",
  publishAt: "Publish at",
};

/** A checkbox row that's comfortable to tap on a phone. */
const CHOICE_ROW =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 text-sm hover:bg-card has-checked:font-semibold sm:min-h-9";

const MODES = [
  { value: "publish", label: "Publish now", icon: Send },
  { value: "schedule", label: "Schedule", icon: CalendarClock },
  { value: "draft", label: "Save as draft", icon: FileText },
] as const;

function toInput(form: AnnouncementFormValues): AnnouncementInput {
  return {
    ...form,
    // A pin "until" date lasts to the end of that day.
    pinnedUntil: form.pinned ? fromCampusInput(form.pinnedUntil, "date") : "",
    publishAt: form.mode === "schedule" ? fromCampusInput(form.publishAt, "datetime") : "",
  };
}

export function AnnouncementComposer({
  initial,
  departments,
  announcementId,
  published = false,
}: {
  initial: AnnouncementFormValues;
  departments: { id: string; name: string }[];
  /** Editing an existing announcement. */
  announcementId?: string;
  /** It has gone live before: it can only stay published (archive it instead). */
  published?: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<AnnouncementFormValues>(initial);
  const [errors, setErrors] = useState<FieldErrorMap | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update<K extends keyof AnnouncementFormValues>(
    key: K,
    value: AnnouncementFormValues[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
    const errorKey =
      key === "departmentIds" || key === "years" || key === "audienceAll" ? "audience" : key;
    if (errors?.[errorKey]) setErrors({ ...errors, [errorKey]: undefined });
  }

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const input = toInput(form);
    const parsed = announcementSchema.safeParse(input);
    const fieldErrors: FieldErrorMap = parsed.success
      ? {}
      : (z.flattenError(parsed.error).fieldErrors as FieldErrorMap);
    if (roughTextLength(form.bodyHtml) < MIN_ANNOUNCEMENT_BODY) {
      fieldErrors.bodyHtml = [
        `Add a bit more detail (at least ${MIN_ANNOUNCEMENT_BODY} characters).`,
      ];
    }
    if (Object.values(fieldErrors).some((e) => e?.[0])) {
      setErrors(fieldErrors);
      const first = Object.keys(LABELS).find((k) => fieldErrors[k]?.[0]);
      if (first) focusField(first === "audience" ? "audienceAll" : first);
      return;
    }

    startTransition(async () => {
      const result = announcementId
        ? await updateAnnouncement(announcementId, input)
        : await createAnnouncement(input);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? null);
        toast.error(result.error);
        return;
      }
      setDirty(false);
      toast.success(result.message ?? "Saved.");
      router.push(
        form.mode === "publish" ? `/announcements/${result.data.id}` : "/admin/announcements",
      );
    });
  }

  const err = (key: string) => errors?.[key]?.[0];
  const submitLabel = published
    ? "Save changes"
    : form.mode === "publish"
      ? "Publish announcement"
      : form.mode === "schedule"
        ? "Schedule announcement"
        : "Save draft";

  return (
    <form onSubmit={submit} noValidate className="space-y-7">
      {errors && Object.values(errors).some((e) => e?.[0]) && (
        <FormErrorSummary errors={errors} labels={LABELS} />
      )}

      <Field id="title" label="Title" error={err("title")}>
        <TextInput
          id="title"
          value={form.title}
          maxLength={150}
          onChange={(event) => update("title", event.target.value)}
          placeholder="e.g. Semester 2 exam timetable released"
          {...describedBy("title", err("title"))}
        />
      </Field>

      <Field
        id="bodyHtml"
        label="Message"
        hint="Keep it clear: what changed, who it affects, and any deadline."
        error={err("bodyHtml")}
      >
        <RichTextEditor
          id="bodyHtml"
          initialHtml={form.bodyHtml}
          onChange={(html) => update("bodyHtml", html)}
          placeholder="Write the announcement…"
          minHeight="min-h-52"
          invalid={Boolean(err("bodyHtml"))}
          describedBy={err("bodyHtml") ? "bodyHtml-error" : undefined}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="category" label="Category" error={err("category")}>
          <SelectInput
            id="category"
            value={form.category}
            onChange={(event) => update("category", event.target.value as AnnouncementCategory)}
            {...describedBy("category", err("category"))}
          >
            {ANNOUNCEMENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field
          id="publishingUnit"
          label="From"
          hint="The office or unit publishing this."
          error={err("publishingUnit")}
        >
          <TextInput
            id="publishingUnit"
            list="publishing-units"
            value={form.publishingUnit}
            maxLength={60}
            onChange={(event) => update("publishingUnit", event.target.value)}
            {...describedBy("publishingUnit", err("publishingUnit"), true)}
          />
          <datalist id="publishing-units">
            {PUBLISHING_UNIT_SUGGESTIONS.map((unit) => (
              <option key={unit} value={unit} />
            ))}
          </datalist>
        </Field>
      </div>

      <fieldset
        className="space-y-3"
        aria-describedby={err("audience") ? "audience-error" : "audience-hint"}
      >
        <legend className="mb-1 text-[13.5px] font-bold">Audience</legend>
        <p id="audience-hint" className="text-[13px] text-muted-foreground">
          Everyone can read published announcements. The audience decides who is notified and who
          sees it under “For me”.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { value: true, label: "Everyone", hint: "All students and staff" },
            { value: false, label: "Specific groups", hint: "Choose departments and/or years" },
          ].map((option) => (
            <label
              key={String(option.value)}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-2xl border-[1.5px] p-4 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/30",
                form.audienceAll === option.value
                  ? "border-primary bg-accent"
                  : "border-input hover:border-border-strong",
              )}
            >
              <input
                type="radio"
                name="audienceAll"
                id={option.value ? "audienceAll" : undefined}
                checked={form.audienceAll === option.value}
                onChange={() => update("audienceAll", option.value)}
                className="mt-1 size-4 accent-primary"
              />
              <span>
                <span className="block font-bold">{option.label}</span>
                <span className="block text-[13px] text-muted-foreground">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>

        {!form.audienceAll && (
          <div className="grid gap-5 rounded-2xl border bg-surface-tint p-3 sm:grid-cols-2 sm:p-4">
            <fieldset>
              <legend className="mb-2 text-[13px] font-bold">Departments</legend>
              <div className="space-y-1">
                {departments.map((d) => (
                  <label key={d.id} className={CHOICE_ROW}>
                    <input
                      type="checkbox"
                      checked={form.departmentIds.includes(d.id)}
                      onChange={() => update("departmentIds", toggle(form.departmentIds, d.id))}
                      className="size-[18px] accent-primary"
                    />
                    {d.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-[13px] font-bold">Years</legend>
              <div className="space-y-1">
                {YEAR_OPTIONS.map((y) => (
                  <label key={y.value} className={CHOICE_ROW}>
                    <input
                      type="checkbox"
                      checked={form.years.includes(y.value)}
                      onChange={() => update("years", toggle(form.years, y.value))}
                      className="size-[18px] accent-primary"
                    />
                    {y.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="text-[13px] text-muted-foreground sm:col-span-2">
              Goes to:{" "}
              <strong className="text-foreground">
                {audienceLabel(
                  { all: false, departmentIds: form.departmentIds, years: form.years },
                  departments,
                )}
              </strong>
              . Leave departments or years empty to include all of them.
            </p>
          </div>
        )}
        {err("audience") && (
          <p id="audience-error" role="alert" className="text-[13px] font-medium text-destructive">
            {err("audience")}
          </p>
        )}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 text-[13.5px] font-bold">Options</legend>
        <label className="flex items-start gap-3 text-[14px]">
          <input
            id="important"
            type="checkbox"
            checked={form.important}
            onChange={(event) => update("important", event.target.checked)}
            className="mt-0.5 size-[18px] shrink-0 accent-primary"
          />
          <span>
            <span className="block font-bold">Mark as important</span>
            <span className="block text-[13px] text-muted-foreground">
              Also emails everyone in the audience (unless they turned announcement emails off). Use
              it for deadlines and urgent changes.
            </span>
          </span>
        </label>
        <div className="space-y-3">
          <label className="flex items-start gap-3 text-[14px]">
            <input
              id="pinned"
              type="checkbox"
              checked={form.pinned}
              onChange={(event) => update("pinned", event.target.checked)}
              className="mt-0.5 size-[18px] shrink-0 accent-primary"
            />
            <span>
              <span className="block font-bold">Pin to the top</span>
              <span className="block text-[13px] text-muted-foreground">
                Shown on Home and above other announcements.
              </span>
            </span>
          </label>
          {form.pinned && (
            <Field
              id="pinnedUntil"
              label="Pin until"
              optional
              hint="Leave empty to keep it pinned until you unpin it."
              error={err("pinnedUntil")}
              className="max-w-xs pl-[30px]"
            >
              <TextInput
                id="pinnedUntil"
                type="date"
                value={form.pinnedUntil}
                min={toCampusInput(new Date().toISOString(), "date")}
                onChange={(event) => update("pinnedUntil", event.target.value)}
                {...describedBy("pinnedUntil", err("pinnedUntil"), true)}
              />
            </Field>
          )}
        </div>
      </fieldset>

      {!published && (
        <fieldset className="space-y-3">
          <legend className="mb-1 text-[13.5px] font-bold">When</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {MODES.map((m) => (
              <label
                key={m.value}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-2xl border-[1.5px] p-3.5 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/30",
                  form.mode === m.value
                    ? "border-primary bg-accent"
                    : "border-input hover:border-border-strong",
                )}
              >
                <input
                  type="radio"
                  name="mode"
                  value={m.value}
                  checked={form.mode === m.value}
                  onChange={() => update("mode", m.value)}
                  className="sr-only"
                />
                <m.icon
                  className={cn(
                    "size-4.5",
                    form.mode === m.value ? "text-primary" : "text-muted-foreground",
                  )}
                  aria-hidden
                />
                <span className="text-sm font-bold">{m.label}</span>
              </label>
            ))}
          </div>
          {form.mode === "schedule" && (
            <Field
              id="publishAt"
              label="Publish at"
              hint="Sri Lanka time. It goes live within 5 minutes of this, and the audience is notified then."
              error={err("publishAt")}
              className="max-w-xs"
            >
              <TextInput
                id="publishAt"
                type="datetime-local"
                value={form.publishAt}
                onChange={(event) => update("publishAt", event.target.value)}
                {...describedBy("publishAt", err("publishAt"), true)}
              />
            </Field>
          )}
        </fieldset>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-5">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
