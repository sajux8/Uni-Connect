"use client";

import { ArrowDown, ArrowUp, Copy, Eye, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { FormAnswerer } from "@/components/feedback/form-answerer";
import { describedBy, Field, SelectInput, TextArea, TextInput } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { fromCampusInput, toCampusInput } from "@/lib/campus-time";
import {
  blankQuestion,
  hasOptions,
  QUESTION_TYPES,
  type FormQuestion,
  type QuestionType,
} from "@/lib/forms";
import { cn } from "@/lib/utils";
import { saveForm, setFormStatus } from "@/server/actions/forms";
import type { AudienceDepartment } from "@/server/queries/forms";

type Keyed = FormQuestion & { key: string };

export interface FormBuilderInitial {
  formId: string;
  title: string;
  description: string;
  departmentId: string;
  batchIds: string[];
  aboutLecturerId: string;
  closesAt: string | null;
  questions: FormQuestion[];
}

/**
 * Google Forms-style builder (Phase E): settings, who it's for, and the questions (add, reorder,
 * duplicate, delete, preview). Once students have answered, only the title, description and
 * closing time can change (`locked`).
 */
export function FormBuilder({
  audiences,
  canAskAboutLecturer,
  initial,
  locked = false,
}: {
  audiences: AudienceDepartment[];
  canAskAboutLecturer: boolean;
  initial?: FormBuilderInitial;
  locked?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [departmentId, setDepartmentId] = useState(initial?.departmentId ?? audiences[0]?.id ?? "");
  const [batchIds, setBatchIds] = useState<string[]>(initial?.batchIds ?? []);
  const [aboutLecturerId, setAboutLecturerId] = useState(initial?.aboutLecturerId ?? "");
  const [closesAt, setClosesAt] = useState(toCampusInput(initial?.closesAt ?? null, "datetime"));
  // Keys only tell the editors apart: the first ones match on the server and in the browser.
  const nextKey = useRef(initial?.questions.length || 1);
  const keyed = (q: FormQuestion): Keyed => ({ ...q, key: `q${nextKey.current++}` });
  const [questions, setQuestions] = useState<Keyed[]>(() =>
    (initial?.questions.length ? initial.questions : [blankQuestion("rating")]).map((q, i) => ({
      ...q,
      key: `q${i}`,
    })),
  );
  const [preview, setPreview] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const department = audiences.find((d) => d.id === departmentId) ?? audiences[0];
  const wholeDepartment = !!department?.wholeDepartment && batchIds.length === 0;
  const lecturers = useMemo(() => {
    if (!department) return [];
    if (batchIds.length === 0) return department.lecturers;
    const seen = new Map<string, string>();
    for (const b of department.batches) {
      if (!batchIds.includes(b.id)) continue;
      for (const l of b.lecturers) seen.set(l.id, l.name);
    }
    return [...seen]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [department, batchIds]);

  function update(key: string, patch: Partial<FormQuestion>) {
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  }
  function move(index: number, by: number) {
    setQuestions((qs) => {
      const next = [...qs];
      const [q] = next.splice(index, 1);
      next.splice(index + by, 0, q);
      return next;
    });
  }

  function save(publish: boolean) {
    const closes = closesAt ? fromCampusInput(closesAt, "datetime") : "";
    startTransition(async () => {
      const result = await saveForm({
        formId: initial?.formId ?? "",
        title,
        description,
        departmentId,
        batchIds,
        aboutLecturerId: lecturers.some((l) => l.id === aboutLecturerId) ? aboutLecturerId : "",
        closesAt: closes,
        questions, // the editor's `key` is dropped by the schema
      });
      if (!result.ok) {
        const fields = result.fieldErrors ?? {};
        setErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v?.[0]])));
        toast.error(result.error);
        return;
      }
      setErrors({});
      if (publish) {
        const published = await setFormStatus(result.data.id, "open");
        if (!published.ok) {
          toast.error(published.error);
          router.push(`/forms/${result.data.id}`);
          return;
        }
        toast.success(published.message ?? "Published.");
      } else {
        toast.success(result.message ?? "Saved.");
      }
      router.push(`/forms/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-[22px] border bg-card p-5 shadow-soft sm:p-7">
        <Field id="formTitle" label="Title" error={errors.title}>
          <TextInput
            id="formTitle"
            value={title}
            maxLength={150}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Database Systems: mid-term feedback"
            {...describedBy("formTitle", errors.title)}
          />
        </Field>
        <Field
          id="formDescription"
          label="Description"
          optional
          hint="Shown to students above the questions. Say what the feedback is for."
        >
          <TextArea
            id="formDescription"
            rows={3}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            {...describedBy("formDescription", undefined, true)}
          />
        </Field>
        <Field
          id="formCloses"
          label="Closes"
          optional
          hint="No more answers after this time (Sri Lanka time). Leave empty to close it yourself."
        >
          <TextInput
            id="formCloses"
            type="datetime-local"
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
            className="sm:max-w-xs"
            {...describedBy("formCloses", undefined, true)}
          />
        </Field>
      </section>

      <section
        aria-labelledby="audience"
        className="space-y-4 rounded-[22px] border bg-card p-5 shadow-soft sm:p-7"
      >
        <h2 id="audience" className="text-[15px] font-extrabold">
          Who is it for?
        </h2>
        {locked ? (
          <p className="text-sm text-muted-foreground">
            Students have already answered, so the audience and questions can&apos;t change.
          </p>
        ) : (
          <>
            {audiences.length > 1 && (
              <Field id="formDepartment" label="Department">
                <SelectInput
                  id="formDepartment"
                  value={departmentId}
                  onChange={(e) => {
                    setDepartmentId(e.target.value);
                    setBatchIds([]);
                    setAboutLecturerId("");
                  }}
                >
                  {audiences.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            )}
            <fieldset className="space-y-1">
              <legend className="mb-1 text-[13.5px] font-bold">Students</legend>
              {department?.wholeDepartment && (
                <label className="flex min-h-11 items-center gap-3 rounded-xl px-2 hover:bg-accent/50">
                  <input
                    type="checkbox"
                    className="size-4.5 accent-primary"
                    checked={wholeDepartment}
                    onChange={() => setBatchIds([])}
                  />
                  <span className="text-[15px]">Everyone in {department.name}</span>
                </label>
              )}
              {department?.batches.map((b) => (
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
              {department && !department.wholeDepartment && batchIds.length === 0 && (
                <p className="text-[13px] text-muted-foreground">
                  Choose at least one batch you teach.
                </p>
              )}
            </fieldset>
            {canAskAboutLecturer && (
              <Field
                id="formAbout"
                label="Is this about a lecturer?"
                hint="If you pick one, they can see the results too. Students' answers stay anonymous."
              >
                <SelectInput
                  id="formAbout"
                  value={aboutLecturerId}
                  onChange={(e) => setAboutLecturerId(e.target.value)}
                  {...describedBy("formAbout", undefined, true)}
                >
                  <option value="">No, it&apos;s general feedback</option>
                  {lecturers.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            )}
          </>
        )}
      </section>

      {!locked && (
        <section aria-labelledby="questions" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="questions" className="text-[15px] font-extrabold">
              Questions
            </h2>
            <Button variant="outline" onClick={() => setPreview((p) => !p)}>
              {preview ? (
                <>
                  <Pencil data-icon="inline-start" /> Back to editing
                </>
              ) : (
                <>
                  <Eye data-icon="inline-start" /> Preview as a student
                </>
              )}
            </Button>
          </div>
          {errors.questions && (
            <p role="alert" className="text-[13px] font-medium text-destructive">
              {errors.questions}
            </p>
          )}

          {preview ? (
            <FormAnswerer
              preview
              questions={questions.map((q) => ({
                ...q,
                id: q.key,
                options: q.options.filter(Boolean),
                minLabel: q.minLabel,
                maxLabel: q.maxLabel,
              }))}
            />
          ) : (
            <>
              {questions.map((q, i) => (
                <QuestionEditor
                  key={q.key}
                  index={i}
                  count={questions.length}
                  question={q}
                  onChange={(patch) => update(q.key, patch)}
                  onMove={(by) => move(i, by)}
                  onDuplicate={() =>
                    setQuestions((qs) => [
                      ...qs.slice(0, i + 1),
                      keyed({ ...q }),
                      ...qs.slice(i + 1),
                    ])
                  }
                  onDelete={() => setQuestions((qs) => qs.filter((x) => x.key !== q.key))}
                />
              ))}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => setQuestions((qs) => [...qs, keyed(blankQuestion("choice"))])}
                  disabled={questions.length >= 50}
                >
                  <Plus data-icon="inline-start" /> Add question
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setQuestions((qs) => [...qs, keyed(blankQuestion("section"))])}
                  disabled={questions.length >= 50}
                >
                  <Plus data-icon="inline-start" /> Add section heading
                </Button>
              </div>
            </>
          )}
        </section>
      )}

      <div className="flex flex-wrap justify-end gap-2 border-t pt-5">
        {!initial ? (
          <>
            <Button variant="outline" onClick={() => save(false)} disabled={pending}>
              Save draft
            </Button>
            <Button onClick={() => save(true)} disabled={pending}>
              {pending ? "Saving…" : "Save and publish"}
            </Button>
          </>
        ) : (
          <Button onClick={() => save(false)} disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        )}
      </div>
    </div>
  );
}

function QuestionEditor({
  index,
  count,
  question: q,
  onChange,
  onMove,
  onDuplicate,
  onDelete,
}: {
  index: number;
  count: number;
  question: Keyed;
  onChange: (patch: Partial<FormQuestion>) => void;
  onMove: (by: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const id = (name: string) => `${q.key}-${name}`;
  const section = q.type === "section";
  const label = `question ${index + 1}`;

  function changeType(type: QuestionType) {
    onChange({
      type,
      required: type === "section" ? false : q.required,
      options: hasOptions(type) ? (q.options.length >= 2 ? q.options : ["", ""]) : [],
    });
  }

  return (
    <article
      aria-label={`Question ${index + 1}`}
      className={cn(
        "space-y-4 rounded-[22px] border bg-card p-5 shadow-soft",
        section && "border-dashed bg-accent/30",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-extrabold text-muted-foreground">{index + 1}</span>
        <SelectInput
          aria-label={`Type of ${label}`}
          value={q.type}
          onChange={(e) => changeType(e.target.value as QuestionType)}
          className="h-10 w-auto min-w-44 rounded-full text-sm font-semibold"
        >
          {QUESTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </SelectInput>
        <div className="ml-auto flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Move ${label} up`}
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Move ${label} down`}
            disabled={index === count - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Duplicate ${label}`}
            onClick={onDuplicate}
          >
            <Copy />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${label}`}
            disabled={count === 1}
            onClick={onDelete}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <Field id={id("prompt")} label={section ? "Heading" : "Question"}>
        <TextInput
          id={id("prompt")}
          value={q.prompt}
          maxLength={300}
          onChange={(e) => onChange({ prompt: e.target.value })}
          placeholder={section ? "e.g. About the lectures" : "e.g. How clear were the lectures?"}
        />
      </Field>
      <Field id={id("help")} label="Description" optional>
        <TextInput
          id={id("help")}
          value={q.help}
          maxLength={500}
          onChange={(e) => onChange({ help: e.target.value })}
        />
      </Field>

      {hasOptions(q.type) && (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-[13.5px] font-bold">Options</legend>
          {q.options.map((option, i) => (
            <div key={i} className="flex items-center gap-2">
              <TextInput
                aria-label={`Option ${i + 1} of ${label}`}
                value={option}
                maxLength={120}
                onChange={(e) =>
                  onChange({ options: q.options.map((o, j) => (j === i ? e.target.value : o)) })
                }
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove option ${i + 1}`}
                disabled={q.options.length <= 2}
                onClick={() => onChange({ options: q.options.filter((_, j) => j !== i) })}
              >
                <X />
              </Button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            disabled={q.options.length >= 20}
            onClick={() => onChange({ options: [...q.options, ""] })}
          >
            <Plus data-icon="inline-start" /> Add option
          </Button>
        </fieldset>
      )}

      {q.type === "scale" && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id={id("max")} label="Scale">
            <SelectInput
              id={id("max")}
              value={String(q.scaleMax)}
              onChange={(e) => onChange({ scaleMax: Number(e.target.value) as 5 | 10 })}
            >
              <option value="5">1 to 5</option>
              <option value="10">1 to 10</option>
            </SelectInput>
          </Field>
          <Field id={id("minLabel")} label="Label for 1" optional>
            <TextInput
              id={id("minLabel")}
              value={q.minLabel}
              maxLength={40}
              onChange={(e) => onChange({ minLabel: e.target.value })}
              placeholder="e.g. Not at all"
            />
          </Field>
          <Field id={id("maxLabel")} label={`Label for ${q.scaleMax}`} optional>
            <TextInput
              id={id("maxLabel")}
              value={q.maxLabel}
              maxLength={40}
              onChange={(e) => onChange({ maxLabel: e.target.value })}
              placeholder="e.g. Very"
            />
          </Field>
        </div>
      )}

      {!section && (
        <label className="flex min-h-10 w-fit items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            className="size-4.5 accent-primary"
            checked={q.required}
            onChange={(e) => onChange({ required: e.target.checked })}
          />
          Required
        </label>
      )}
    </article>
  );
}
