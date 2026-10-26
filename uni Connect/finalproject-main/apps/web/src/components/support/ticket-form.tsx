"use client";

import { ImagePlus, ShieldCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { describedBy, Field, SelectInput, TextArea, TextInput } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { categoriesFor, MAX_PHOTO_BYTES, PHOTO_TYPES, type TicketKind } from "@/lib/support";
import { createTicket, preparePhotoUpload } from "@/server/actions/support";

/**
 * Contact support or file a complaint (Phase F). Complaints can hide the sender's name, go to
 * campus management instead of the coordinator, and carry one photo.
 */
export function TicketForm({ kind, hasDepartment }: { kind: TicketKind; hasDepartment: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [toManagement, setToManagement] = useState(!hasDepartment);
  const [photo, setPhoto] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const complaint = kind === "complaint";
  const categories = categoriesFor(kind);
  const groups = [...new Set(categories.map((c) => c.group ?? ""))];
  const urgent = categories.find((c) => c.value === category)?.urgent;

  function pickPhoto(file: File | undefined) {
    if (!file) return setPhoto(null);
    if (!(file.type in PHOTO_TYPES)) {
      setErrors((e) => ({ ...e, photo: "Photos must be PNG or JPEG." }));
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setErrors((e) => ({ ...e, photo: "Photos can be up to 5 MB." }));
      return;
    }
    setErrors((e) => ({ ...e, photo: undefined }));
    setPhoto(file);
  }

  function submit() {
    startTransition(async () => {
      let photoPath = "";
      if (complaint && photo) {
        const prepared = await preparePhotoUpload(photo.type);
        if (!prepared.ok) return void setErrors((e) => ({ ...e, photo: prepared.error }));
        const { error } = await createClient()
          .storage.from("ticket-photos")
          .uploadToSignedUrl(prepared.data.path, prepared.data.token, photo, {
            contentType: photo.type,
          });
        if (error)
          return void setErrors((e) => ({ ...e, photo: "The photo didn't upload. Try again." }));
        photoPath = prepared.data.path;
      }
      const result = await createTicket({
        kind,
        category,
        subject,
        body,
        anonymous: complaint && anonymous,
        toManagement,
        photoPath,
      });
      if (!result.ok) {
        const fields = result.fieldErrors ?? {};
        setErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v?.[0]])));
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Sent.");
      router.push(`/support/${result.data.id}`);
    });
  }

  return (
    <div className="max-w-2xl space-y-5 rounded-[22px] border bg-card p-5 shadow-soft sm:p-7">
      <Field id="ticketCategory" label="What is it about?" error={errors.category}>
        <SelectInput
          id="ticketCategory"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setErrors((x) => ({ ...x, category: undefined }));
          }}
          {...describedBy("ticketCategory", errors.category)}
        >
          <option value="" disabled>
            Choose a category…
          </option>
          {groups.map((g) =>
            g ? (
              <optgroup key={g} label={g}>
                {categories
                  .filter((c) => c.group === g)
                  .map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
              </optgroup>
            ) : (
              categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))
            ),
          )}
        </SelectInput>
      </Field>
      {urgent && (
        <p className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          Campus management is always told about safety and harassment complaints. If you&apos;re in
          danger right now, contact campus security first.
        </p>
      )}
      <Field id="ticketSubject" label="Subject" error={errors.subject}>
        <TextInput
          id="ticketSubject"
          value={subject}
          maxLength={150}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={
            complaint ? "e.g. Air conditioning broken in Lab 4" : "e.g. Can't change my password"
          }
          {...describedBy("ticketSubject", errors.subject)}
        />
      </Field>
      <Field
        id="ticketBody"
        label="Details"
        error={errors.body}
        hint={
          complaint ? "Where and when, and what's wrong." : "What happened, and what you've tried."
        }
      >
        <TextArea
          id="ticketBody"
          rows={6}
          maxLength={4000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          {...describedBy("ticketBody", errors.body, true)}
        />
      </Field>

      {complaint && (
        <>
          <Field
            id="ticketPhoto"
            label="Photo"
            optional
            error={errors.photo}
            hint="PNG or JPEG up to 5 MB, e.g. of the broken projector."
          >
            {photo ? (
              <div className="flex items-center gap-2 rounded-[14px] border px-3.5 py-2 text-sm">
                <ImagePlus className="size-4 text-primary" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{photo.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove photo"
                  onClick={() => setPhoto(null)}
                >
                  <X />
                </Button>
              </div>
            ) : (
              <input
                id="ticketPhoto"
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => pickPhoto(e.target.files?.[0])}
                className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-4 file:py-2 file:font-semibold file:text-accent-foreground"
                {...describedBy("ticketPhoto", errors.photo, true)}
              />
            )}
          </Field>
          <label className="flex items-start gap-3 rounded-2xl border px-4 py-3">
            <input
              type="checkbox"
              className="mt-0.5 size-4.5 accent-primary"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
            />
            <span className="text-sm">
              <span className="flex items-center gap-1.5 font-bold">
                <ShieldCheck className="size-4 text-primary" aria-hidden /> Hide my name
              </span>
              <span className="text-muted-foreground">
                Staff won&apos;t see who sent it, not even your batch. You&apos;ll still get status
                updates, but nobody can reply to you.
              </span>
            </span>
          </label>
        </>
      )}
      {hasDepartment && (
        <label className="flex items-start gap-3 rounded-2xl border px-4 py-3">
          <input
            type="checkbox"
            className="mt-0.5 size-4.5 accent-primary"
            checked={toManagement}
            onChange={(e) => setToManagement(e.target.checked)}
          />
          <span className="text-sm">
            <span className="font-bold">Send to campus management instead</span>
            <span className="block text-muted-foreground">
              It goes to the super admins rather than your department&apos;s coordinator.
            </span>
          </span>
        </label>
      )}
      <div className="flex justify-end">
        <Button size="lg" onClick={submit} disabled={pending}>
          {pending ? "Sending…" : complaint ? "Send complaint" : "Send"}
        </Button>
      </div>
    </div>
  );
}
