"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { SpaceIcon, SPACE_ICON_NAMES } from "@/components/community/space-icon";
import { describedBy, Field, SelectInput, TextArea, TextInput } from "@/components/forms/field";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { YEAR_OPTIONS } from "@/lib/campus";
import { SPACE_TYPES, type SpaceType } from "@/lib/community";
import { cn } from "@/lib/utils";
import { slugify, type SpaceInput } from "@/lib/validation/moderation";
import { createSpace, updateSpace, updateSpaceDetails } from "@/server/actions/catalog";

export interface SpaceFormValues {
  id?: string;
  name: string;
  slug: string;
  description: string;
  type: SpaceType;
  departmentId: string;
  yearOfStudy: string;
  moduleCode: string;
  icon: string;
  joinPolicy: "open" | "approval";
  rules: string;
}

export const EMPTY_SPACE: SpaceFormValues = {
  name: "",
  slug: "",
  description: "",
  type: "club",
  departmentId: "",
  yearOfStudy: "",
  moduleCode: "",
  icon: "Hash",
  joinPolicy: "open",
  rules: "",
};

/**
 * Space settings. Admins edit everything; a space's own moderators (`detailsOnly`) can
 * change the description, rules and join policy.
 */
export function SpaceForm({
  initial,
  departments,
  detailsOnly = false,
  onSaved,
}: {
  initial: SpaceFormValues;
  departments: { id: string; name: string }[];
  detailsOnly?: boolean;
  onSaved?: (slug: string) => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof SpaceFormValues>(key: K, value: SpaceFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  function save(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const { id, ...input } = values;
      const result = detailsOnly
        ? await updateSpaceDetails(id!, {
            description: values.description,
            rules: values.rules,
            joinPolicy: values.joinPolicy,
          })
        : id
          ? await updateSpace(id, input as SpaceInput)
          : await createSpace(input as SpaceInput);
      if (!result.ok) {
        setErrors(
          Object.fromEntries(Object.entries(result.fieldErrors ?? {}).map(([k, v]) => [k, v?.[0]])),
        );
        toast.error(result.error);
        return;
      }
      setErrors({});
      toast.success(result.message ?? "Saved.");
      const slug = (result.data as { slug?: string } | undefined)?.slug ?? values.slug;
      if (onSaved) onSaved(slug);
      else if (slug !== initial.slug) router.push(`/spaces/${slug}/settings`);
      else router.refresh();
    });
  }

  return (
    <form onSubmit={save} noValidate>
      <SettingsSection
        title={detailsOnly ? "Space details" : initial.id ? "Space settings" : "New space"}
        description={
          detailsOnly
            ? "As a moderator of this space you can change what members see before joining."
            : "Spaces hold discussions, questions and resources for a department, batch, module or club."
        }
        footer={
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : initial.id ? "Save changes" : "Create space"}
          </Button>
        }
      >
        {!detailsOnly && (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="space-name" label="Name" error={errors.name}>
                <TextInput
                  id="space-name"
                  value={values.name}
                  maxLength={60}
                  onChange={(event) => {
                    set("name", event.target.value);
                    if (!slugTouched) set("slug", slugify(event.target.value));
                  }}
                  {...describedBy("space-name", errors.name)}
                />
              </Field>
              <Field
                id="space-slug"
                label="Web address"
                error={errors.slug}
                hint={`/spaces/${values.slug || "…"}`}
              >
                <TextInput
                  id="space-slug"
                  value={values.slug}
                  maxLength={60}
                  onChange={(event) => {
                    setSlugTouched(true);
                    set("slug", event.target.value.toLowerCase());
                  }}
                  {...describedBy("space-slug", errors.slug, true)}
                />
              </Field>
              <Field id="space-type" label="Type">
                <SelectInput
                  id="space-type"
                  value={values.type}
                  onChange={(event) => set("type", event.target.value as SpaceType)}
                >
                  {SPACE_TYPES.filter((t) => t.value !== "batch").map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field id="space-department" label="Department" optional>
                <SelectInput
                  id="space-department"
                  value={values.departmentId}
                  onChange={(event) => set("departmentId", event.target.value)}
                >
                  <option value="">None</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field id="space-year" label="Year" optional>
                <SelectInput
                  id="space-year"
                  value={values.yearOfStudy}
                  onChange={(event) => set("yearOfStudy", event.target.value)}
                >
                  <option value="">Any year</option>
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y.value} value={y.value}>
                      {y.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field id="space-module" label="Module code" optional error={errors.moduleCode}>
                <TextInput
                  id="space-module"
                  value={values.moduleCode}
                  maxLength={20}
                  placeholder="e.g. CS2041"
                  onChange={(event) => set("moduleCode", event.target.value)}
                  {...describedBy("space-module", errors.moduleCode)}
                />
              </Field>
            </div>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-[13.5px] font-bold">Icon</legend>
              <div className="flex flex-wrap gap-2">
                {SPACE_ICON_NAMES.map((name) => (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={values.icon === name}
                    aria-label={name}
                    onClick={() => set("icon", name)}
                    className={cn(
                      "rounded-[16px] p-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                      values.icon === name && "ring-2 ring-primary",
                    )}
                  >
                    <SpaceIcon icon={name} type={values.type} size="md" />
                  </button>
                ))}
              </div>
            </fieldset>
          </>
        )}
        <Field
          id="space-description"
          label="Description"
          optional
          error={errors.description}
          hint={`${values.description.length}/500 characters`}
        >
          <TextArea
            id="space-description"
            value={values.description}
            maxLength={500}
            rows={3}
            onChange={(event) => set("description", event.target.value)}
            {...describedBy("space-description", errors.description, true)}
          />
        </Field>
        <Field id="space-join" label="Who can join">
          <SelectInput
            id="space-join"
            value={values.joinPolicy}
            onChange={(event) => set("joinPolicy", event.target.value as "open" | "approval")}
          >
            <option value="open">Anyone (open)</option>
            <option value="approval">Members approved by a moderator</option>
          </SelectInput>
        </Field>
        <Field
          id="space-rules"
          label="Rules"
          optional
          error={errors.rules}
          hint="Shown on the space's About tab. One rule per line works well."
        >
          <TextArea
            id="space-rules"
            value={values.rules}
            maxLength={4000}
            rows={5}
            onChange={(event) => set("rules", event.target.value)}
            {...describedBy("space-rules", errors.rules, true)}
          />
        </Field>
      </SettingsSection>
    </form>
  );
}
