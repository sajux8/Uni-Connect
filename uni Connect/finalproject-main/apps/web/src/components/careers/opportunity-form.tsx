"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { describedBy, Field, SelectInput, TextArea, TextInput } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { fromCampusInput, toCampusInput } from "@/lib/campus-time";
import { OPPORTUNITY_TYPES, WORK_MODES, type OpportunityType, type WorkMode } from "@/lib/careers";
import { saveOpportunity } from "@/server/actions/careers";
import type { Opportunity, PostingAudience } from "@/server/queries/careers";

/**
 * Post or edit an internship, part-time job or graduate role (Phase G). Coordinators post to their
 * department or some of its batches; super admins can also post campus-wide.
 */
export function OpportunityForm({
  audiences,
  campusWide,
  initial,
}: {
  audiences: PostingAudience[];
  /** Super admins may post to the whole campus. */
  campusWide: boolean;
  initial?: Opportunity;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [v, setV] = useState({
    title: initial?.title ?? "",
    company: initial?.company ?? "",
    type: (initial?.type ?? "internship") as OpportunityType,
    mode: (initial?.mode ?? "on_site") as WorkMode,
    location: initial?.location ?? "",
    description: initial?.description ?? "",
    applyUrl: initial?.applyUrl ?? "",
    applyEmail: initial?.applyEmail ?? "",
    deadline: toCampusInput(initial?.deadline ?? null, "datetime"),
    departmentId: initial ? (initial.departmentId ?? "") : (audiences[0]?.id ?? ""),
  });
  const [batchIds, setBatchIds] = useState<string[]>(initial?.batchIds ?? []);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const department = audiences.find((d) => d.id === v.departmentId);

  const set = (key: keyof typeof v) => (e: { target: { value: string } }) => {
    setV((x) => ({ ...x, [key]: e.target.value }));
    setErrors((x) => ({ ...x, [key]: undefined }));
  };

  function submit() {
    startTransition(async () => {
      const result = await saveOpportunity({
        ...v,
        id: initial?.id ?? "",
        deadline: v.deadline ? fromCampusInput(v.deadline, "datetime") : "",
        batchIds: v.departmentId ? batchIds : [],
      });
      if (!result.ok) {
        const fields = result.fieldErrors ?? {};
        setErrors(Object.fromEntries(Object.entries(fields).map(([k, x]) => [k, x?.[0]])));
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Saved.");
      router.push(`/careers/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <div className="max-w-3xl space-y-6">
      <section className="space-y-4 rounded-[22px] border bg-card p-5 shadow-soft sm:p-7">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="oppTitle" label="Role" error={errors.title}>
            <TextInput
              id="oppTitle"
              value={v.title}
              maxLength={150}
              onChange={set("title")}
              placeholder="e.g. Software engineering intern"
              {...describedBy("oppTitle", errors.title)}
            />
          </Field>
          <Field id="oppCompany" label="Company" error={errors.company}>
            <TextInput
              id="oppCompany"
              value={v.company}
              maxLength={120}
              onChange={set("company")}
              {...describedBy("oppCompany", errors.company)}
            />
          </Field>
          <Field id="oppType" label="Type">
            <SelectInput id="oppType" value={v.type} onChange={set("type")}>
              {OPPORTUNITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field id="oppMode" label="Where">
            <SelectInput id="oppMode" value={v.mode} onChange={set("mode")}>
              {WORK_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field id="oppLocation" label="Location" optional error={errors.location}>
            <TextInput
              id="oppLocation"
              value={v.location}
              maxLength={120}
              onChange={set("location")}
              placeholder="e.g. Colombo 03"
            />
          </Field>
          <Field
            id="oppDeadline"
            label="Apply by"
            optional
            hint="Sri Lanka time. It closes itself after this."
          >
            <TextInput
              id="oppDeadline"
              type="datetime-local"
              value={v.deadline}
              onChange={set("deadline")}
              {...describedBy("oppDeadline", undefined, true)}
            />
          </Field>
        </div>
        <Field id="oppDescription" label="About the role" error={errors.description}>
          <TextArea
            id="oppDescription"
            rows={7}
            maxLength={5000}
            value={v.description}
            onChange={set("description")}
            placeholder="What they'll do, who can apply, pay and duration…"
            {...describedBy("oppDescription", errors.description)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="oppUrl"
            label="Apply link"
            error={errors.applyUrl}
            hint="A link, an email, or both."
          >
            <TextInput
              id="oppUrl"
              type="url"
              value={v.applyUrl}
              maxLength={500}
              onChange={set("applyUrl")}
              placeholder="https://"
              {...describedBy("oppUrl", errors.applyUrl, true)}
            />
          </Field>
          <Field id="oppEmail" label="Apply by email" optional error={errors.applyEmail}>
            <TextInput
              id="oppEmail"
              type="email"
              value={v.applyEmail}
              maxLength={200}
              onChange={set("applyEmail")}
              {...describedBy("oppEmail", errors.applyEmail)}
            />
          </Field>
        </div>
      </section>

      <section
        aria-labelledby="oppAudience"
        className="space-y-4 rounded-[22px] border bg-card p-5 shadow-soft sm:p-7"
      >
        <h2 id="oppAudience" className="text-[15px] font-extrabold">
          Who is it for?
        </h2>
        {(campusWide || audiences.length > 1) && (
          <Field id="oppDepartment" label="Department">
            <SelectInput
              id="oppDepartment"
              value={v.departmentId}
              onChange={(e) => {
                set("departmentId")(e);
                setBatchIds([]);
              }}
            >
              {campusWide && <option value="">The whole campus</option>}
              {audiences.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </SelectInput>
          </Field>
        )}
        {department && (
          <fieldset className="space-y-1">
            <legend className="mb-1 text-[13.5px] font-bold">Students</legend>
            <label className="flex min-h-11 items-center gap-3 rounded-xl px-2 hover:bg-accent/50">
              <input
                type="checkbox"
                className="size-4.5 accent-primary"
                checked={batchIds.length === 0}
                onChange={() => setBatchIds([])}
              />
              <span className="text-[15px]">Everyone in {department.name}</span>
            </label>
            {department.batches.map((b) => (
              <label
                key={b.id}
                className="flex min-h-11 items-center gap-3 rounded-xl px-2 hover:bg-accent/50"
              >
                <input
                  type="checkbox"
                  className="size-4.5 accent-primary"
                  checked={batchIds.includes(b.id)}
                  onChange={(e) =>
                    setBatchIds((ids) =>
                      e.target.checked ? [...ids, b.id] : ids.filter((x) => x !== b.id),
                    )
                  }
                />
                <span className="text-[15px]">{b.name}</span>
              </label>
            ))}
          </fieldset>
        )}
        {!initial && (
          <p className="text-[13px] text-muted-foreground">
            Students it&apos;s for are told when you post it.
          </p>
        )}
      </section>

      <div className="flex justify-end">
        <Button size="lg" onClick={submit} disabled={pending}>
          {pending ? "Saving…" : initial ? "Save changes" : "Post opportunity"}
        </Button>
      </div>
    </div>
  );
}
