"use client";

import { ImagePlus, MapPin, Monitor, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
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
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { audienceLabel } from "@/lib/announcements";
import { YEAR_OPTIONS } from "@/lib/campus";
import { fromCampusInput, toCampusInput } from "@/lib/campus-time";
import {
  EVENT_CATEGORIES,
  EVENT_FORMATS,
  ORGANIZING_UNIT_SUGGESTIONS,
  type EventCategory,
  type EventFormat,
} from "@/lib/events";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { eventSchema, MIN_EVENT_DESCRIPTION, type EventInput } from "@/lib/validation/events";
import { roughTextLength } from "@/lib/validation/posts";
import { createEvent, updateEvent } from "@/server/actions/events";

/** What the form edits; dates are campus-time input values ("2026-10-14T10:00"). */
export interface EventFormValues {
  title: string;
  descriptionHtml: string;
  category: EventCategory;
  organizingUnit: string;
  format: EventFormat;
  venue: string;
  locationDetails: string;
  onlineUrl: string;
  startsAt: string;
  endsAt: string;
  registrationDeadline: string;
  /** "" = unlimited */
  capacity: string;
  waitlistEnabled: boolean;
  departmentIds: string[];
  years: number[];
  eligibilityNote: string;
  coverUrl: string;
  spaceId: string;
}

export interface EventPlacement {
  /** "" = campus-wide (super admins only). */
  id: string;
  name: string;
  /** Publishing here goes to the club captain or the coordinator first. */
  needsReview: boolean;
}

const LABELS: Record<string, string> = {
  spaceId: "Where should this appear?",
  title: "Title",
  descriptionHtml: "Description",
  category: "Category",
  organizingUnit: "Organised by",
  venue: "Venue",
  onlineUrl: "Online link",
  startsAt: "Starts",
  endsAt: "Ends",
  registrationDeadline: "Registration closes",
  capacity: "Seats",
  eligibilityNote: "Eligibility note",
};

const FORMAT_ICONS = { in_person: MapPin, online: Monitor, hybrid: Users } as const;

/** Fields whose change is announced to registrants (the database logs and sends them). */
const NOTIFIED: { key: keyof EventFormValues; label: string }[] = [
  { key: "startsAt", label: "Start time" },
  { key: "endsAt", label: "End time" },
  { key: "format", label: "Format" },
  { key: "venue", label: "Venue" },
  { key: "locationDetails", label: "Location details" },
  { key: "onlineUrl", label: "Online link" },
  { key: "registrationDeadline", label: "Registration deadline" },
];

const CHOICE_ROW =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 text-sm hover:bg-card has-checked:font-semibold sm:min-h-9";

function toInput(form: EventFormValues, status: "draft" | "published"): EventInput {
  const capacity = form.capacity.trim();
  return {
    title: form.title,
    descriptionHtml: form.descriptionHtml,
    category: form.category,
    organizingUnit: form.organizingUnit,
    format: form.format,
    venue: form.venue,
    locationDetails: form.locationDetails,
    onlineUrl: form.onlineUrl.trim(),
    startsAt: fromCampusInput(form.startsAt, "datetime"),
    endsAt: fromCampusInput(form.endsAt, "datetime"),
    registrationDeadline: fromCampusInput(form.registrationDeadline, "datetime"),
    capacity: capacity === "" ? null : Number(capacity),
    waitlistEnabled: form.waitlistEnabled,
    departmentIds: form.departmentIds,
    years: form.years,
    eligibilityNote: form.eligibilityNote,
    coverUrl: form.coverUrl,
    spaceId: form.spaceId,
    status,
  };
}

export function EventComposer({
  userId,
  initial,
  departments,
  placements,
  eventId,
  published = false,
}: {
  userId: string;
  initial: EventFormValues;
  departments: { id: string; name: string }[];
  /** Where this member may place the event. */
  placements: EventPlacement[];
  eventId?: string;
  /** Already published: it stays published, and time/place changes notify registrants. */
  published?: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<FieldErrorMap | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmChanges, setConfirmChanges] = useState<string[] | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      // A new start time with no end yet: suggest two hours later.
      if (key === "startsAt" && value && !f.endsAt) {
        const start = fromCampusInput(value as string, "datetime");
        if (start)
          next.endsAt = toCampusInput(
            new Date(Date.parse(start) + 2 * 3_600_000).toISOString(),
            "datetime",
          );
      }
      return next;
    });
    setDirty(true);
    if (errors?.[key]) setErrors({ ...errors, [key]: undefined });
  }

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  async function uploadCover(file: File | undefined) {
    if (!file) return;
    const ext = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[file.type];
    if (!ext) return void toast.error("Choose a PNG, JPG or WebP image.");
    if (file.size > 5 * 1024 * 1024) return void toast.error("That image is over 5 MB.");
    setUploading(true);
    const supabase = createClient();
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("event-covers")
      .upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    setUploading(false);
    if (error) return void toast.error("Upload failed. Please try again.");
    update("coverUrl", supabase.storage.from("event-covers").getPublicUrl(path).data.publicUrl);
  }

  function validate(status: "draft" | "published"): EventInput | null {
    const input = toInput(form, status);
    const parsed = eventSchema.safeParse(input);
    const fieldErrors: FieldErrorMap = parsed.success
      ? {}
      : (z.flattenError(parsed.error).fieldErrors as FieldErrorMap);
    if (roughTextLength(form.descriptionHtml) < MIN_EVENT_DESCRIPTION) {
      fieldErrors.descriptionHtml = [
        `Describe it in a bit more detail (at least ${MIN_EVENT_DESCRIPTION} characters).`,
      ];
    }
    if (!placements.some((p) => p.id === form.spaceId)) {
      fieldErrors.spaceId = ["Choose where the event appears."];
    }
    if (form.capacity.trim() && !/^\d+$/.test(form.capacity.trim())) {
      fieldErrors.capacity = ["Enter a whole number, or leave it empty for no limit."];
    }
    if (Object.values(fieldErrors).some((e) => e?.[0])) {
      setErrors(fieldErrors);
      const first = Object.keys(LABELS).find((k) => fieldErrors[k]?.[0]);
      if (first) focusField(first);
      return null;
    }
    return input;
  }

  function save(status: "draft" | "published", confirmed = false) {
    const input = validate(status);
    if (!input) return;
    if (published && !confirmed) {
      const changed = NOTIFIED.filter((f) => form[f.key] !== initial[f.key]).map((f) => f.label);
      if (changed.length > 0) {
        setConfirmChanges(changed);
        return;
      }
    }
    startTransition(async () => {
      const result = eventId ? await updateEvent(eventId, input) : await createEvent(input);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? null);
        toast.error(result.error);
        return;
      }
      setDirty(false);
      setConfirmChanges(null);
      toast.success(result.message ?? "Saved.");
      router.push(`/events/${result.data.id}`);
    });
  }

  const err = (key: string) => errors?.[key]?.[0];
  const placement = placements.find((p) => p.id === form.spaceId);
  const deptLabel = audienceLabel(
    { all: false, departmentIds: form.departmentIds, years: form.years },
    departments,
  );

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        save("published");
      }}
      className="space-y-7"
    >
      {errors && Object.values(errors).some((e) => e?.[0]) && (
        <FormErrorSummary errors={errors} labels={LABELS} />
      )}

      <Field
        id="spaceId"
        label="Where should this appear?"
        hint={
          placement?.needsReview
            ? "Club events are approved by the club captain; batch and department events by the coordinator. You'll be told when it's published."
            : placement
              ? "You can publish here straight away."
              : "Your batch, your department or a club you belong to."
        }
        error={err("spaceId")}
      >
        <SelectInput
          id="spaceId"
          value={form.spaceId}
          onChange={(e) => update("spaceId", e.target.value)}
          {...describedBy("spaceId", err("spaceId"), true)}
        >
          {!placements.some((p) => p.id === "") && (
            <option value="" disabled>
              Choose…
            </option>
          )}
          {placements.map((p) => (
            <option key={p.id || "campus"} value={p.id}>
              {p.name}
              {p.needsReview ? " (needs approval)" : ""}
            </option>
          ))}
        </SelectInput>
      </Field>

      <Field id="title" label="Title" error={err("title")}>
        <TextInput
          id="title"
          value={form.title}
          maxLength={150}
          onChange={(e) => update("title", e.target.value)}
          placeholder="e.g. Career Fair 2026"
          {...describedBy("title", err("title"))}
        />
      </Field>

      <Field id="descriptionHtml" label="Description" error={err("descriptionHtml")}>
        <RichTextEditor
          id="descriptionHtml"
          initialHtml={form.descriptionHtml}
          onChange={(html) => update("descriptionHtml", html)}
          placeholder="What will happen, who it's for, what to bring…"
          minHeight="min-h-44"
          invalid={Boolean(err("descriptionHtml"))}
          describedBy={err("descriptionHtml") ? "descriptionHtml-error" : undefined}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="category" label="Category">
          <SelectInput
            id="category"
            value={form.category}
            onChange={(e) => update("category", e.target.value as EventCategory)}
          >
            {EVENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="organizingUnit" label="Organised by" error={err("organizingUnit")}>
          <TextInput
            id="organizingUnit"
            list="organizing-units"
            value={form.organizingUnit}
            maxLength={60}
            onChange={(e) => update("organizingUnit", e.target.value)}
            {...describedBy("organizingUnit", err("organizingUnit"))}
          />
          <datalist id="organizing-units">
            {ORGANIZING_UNIT_SUGGESTIONS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </Field>
      </div>

      <div className="space-y-2">
        <p className="text-[13.5px] font-bold">
          Cover image <span className="text-xs font-medium text-muted-foreground">Optional</span>
        </p>
        {form.coverUrl ? (
          <div className="relative overflow-hidden rounded-2xl border">
            {/* eslint-disable-next-line @next/next/no-img-element -- just-uploaded preview */}
            <img
              src={form.coverUrl}
              alt="Cover preview"
              className="aspect-[16/7] w-full object-cover"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => update("coverUrl", "")}
              className="absolute top-2 right-2 bg-card"
            >
              <Trash2 data-icon="inline-start" /> Remove
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-2xl border-[1.5px] border-dashed border-border-strong bg-surface-tint text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary"
          >
            <ImagePlus className="size-5" aria-hidden />
            {uploading ? "Uploading…" : "Add a cover image (PNG, JPG or WebP, up to 5 MB)"}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-label="Cover image"
          onChange={(e) => void uploadCover(e.target.files?.[0])}
        />
      </div>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-[13.5px] font-bold">Where</legend>
        <div className="grid grid-cols-3 gap-2">
          {EVENT_FORMATS.map((f) => {
            const Icon = FORMAT_ICONS[f.value];
            return (
              <label
                key={f.value}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-2xl border-[1.5px] px-1.5 text-[13px] font-bold whitespace-nowrap has-focus-visible:ring-3 has-focus-visible:ring-ring/30 sm:gap-2 sm:text-sm",
                  form.format === f.value
                    ? "border-primary bg-accent"
                    : "border-input hover:border-border-strong",
                )}
              >
                <input
                  type="radio"
                  name="format"
                  value={f.value}
                  checked={form.format === f.value}
                  onChange={() => update("format", f.value)}
                  className="sr-only"
                />
                <Icon className="size-4" aria-hidden />
                {f.label}
              </label>
            );
          })}
        </div>
        {form.format !== "online" && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="venue" label="Venue" error={err("venue")}>
              <TextInput
                id="venue"
                value={form.venue}
                maxLength={120}
                onChange={(e) => update("venue", e.target.value)}
                placeholder="e.g. Main Hall"
                {...describedBy("venue", err("venue"))}
              />
            </Field>
            <Field id="locationDetails" label="Location details" optional>
              <TextInput
                id="locationDetails"
                value={form.locationDetails}
                maxLength={200}
                onChange={(e) => update("locationDetails", e.target.value)}
                placeholder="e.g. Level 2, next to the library"
              />
            </Field>
          </div>
        )}
        {form.format !== "in_person" && (
          <Field
            id="onlineUrl"
            label="Online link"
            hint="Only people who register see it."
            error={err("onlineUrl")}
          >
            <TextInput
              id="onlineUrl"
              type="url"
              inputMode="url"
              value={form.onlineUrl}
              maxLength={500}
              onChange={(e) => update("onlineUrl", e.target.value)}
              placeholder="https://"
              {...describedBy("onlineUrl", err("onlineUrl"), true)}
            />
          </Field>
        )}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-[13.5px] font-bold">When (Sri Lanka time)</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="startsAt" label="Starts" error={err("startsAt")}>
            <TextInput
              id="startsAt"
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => update("startsAt", e.target.value)}
              {...describedBy("startsAt", err("startsAt"))}
            />
          </Field>
          <Field id="endsAt" label="Ends" error={err("endsAt")}>
            <TextInput
              id="endsAt"
              type="datetime-local"
              value={form.endsAt}
              min={form.startsAt || undefined}
              onChange={(e) => update("endsAt", e.target.value)}
              {...describedBy("endsAt", err("endsAt"))}
            />
          </Field>
        </div>
        <Field
          id="registrationDeadline"
          label="Registration closes"
          optional
          hint="Leave empty to keep registration open until it starts."
          error={err("registrationDeadline")}
          className="sm:max-w-[calc(50%-0.625rem)]"
        >
          <TextInput
            id="registrationDeadline"
            type="datetime-local"
            value={form.registrationDeadline}
            max={form.startsAt || undefined}
            onChange={(e) => update("registrationDeadline", e.target.value)}
            {...describedBy("registrationDeadline", err("registrationDeadline"), true)}
          />
        </Field>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-[13.5px] font-bold">Seats</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="capacity"
            label="Number of seats"
            optional
            hint="Leave empty for no limit."
            error={err("capacity")}
          >
            <TextInput
              id="capacity"
              inputMode="numeric"
              value={form.capacity}
              onChange={(e) => update("capacity", e.target.value.replace(/[^\d]/g, ""))}
              placeholder="No limit"
              {...describedBy("capacity", err("capacity"), true)}
            />
          </Field>
          <label className="flex items-start gap-3 self-center text-[14px] sm:pt-6">
            <input
              type="checkbox"
              checked={form.waitlistEnabled}
              onChange={(e) => update("waitlistEnabled", e.target.checked)}
              className="mt-0.5 size-[18px] shrink-0 accent-primary"
            />
            <span>
              <span className="block font-bold">Waitlist when full</span>
              <span className="block text-[13px] text-muted-foreground">
                People move up automatically when someone cancels.
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-[13.5px] font-bold">Who can register</legend>
        <p className="text-[13px] text-muted-foreground">
          Leave everything unticked to open it to everyone.
        </p>
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
            Open to:{" "}
            <strong className="text-foreground">
              {form.departmentIds.length === 0 && form.years.length === 0 ? "Everyone" : deptLabel}
            </strong>
          </p>
        </div>
        <Field
          id="eligibilityNote"
          label="Eligibility note"
          optional
          error={err("eligibilityNote")}
        >
          <TextInput
            id="eligibilityNote"
            value={form.eligibilityNote}
            maxLength={200}
            onChange={(e) => update("eligibilityNote", e.target.value)}
            placeholder="e.g. Bring your student ID"
          />
        </Field>
      </fieldset>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-5">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        {!published && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={pending}
            onClick={() => save("draft")}
          >
            Save draft
          </Button>
        )}
        <Button type="submit" size="lg" disabled={pending || uploading}>
          {pending
            ? "Saving…"
            : published
              ? "Save changes"
              : placement?.needsReview
                ? "Submit for approval"
                : "Publish event"}
        </Button>
      </div>

      <AlertDialog
        open={confirmChanges !== null}
        onOpenChange={(open) => !open && setConfirmChanges(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tell registrants about these changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Everyone registered or on the waitlist will be notified (and emailed) about:{" "}
              {confirmChanges?.join(", ")}. The change also appears in the event&apos;s Updates.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <Button disabled={pending} onClick={() => save("published", true)}>
              {pending ? "Saving…" : "Save and notify"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
