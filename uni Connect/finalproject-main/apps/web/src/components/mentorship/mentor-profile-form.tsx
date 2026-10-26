"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmAction } from "@/components/community/confirm-dialogs";
import { describedBy, Field, SelectInput, TextArea, TextInput } from "@/components/forms/field";
import { TagPicker } from "@/components/profile/tag-picker";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { MAX_MENTEES_LIMIT, SUBJECT_SUGGESTIONS } from "@/lib/mentorship";
import { removeMentorProfile, saveMentorProfile } from "@/server/actions/mentorship";
import type { MyMentorProfile } from "@/server/queries/mentorship";

/** /settings/mentor: create, edit, pause or remove the viewer's mentor profile. */
export function MentorProfileForm({ initial }: { initial: MyMentorProfile | null }) {
  const router = useRouter();
  const [headline, setHeadline] = useState(initial?.headline ?? "");
  const [about, setAbout] = useState(initial?.about ?? "");
  const [subjects, setSubjects] = useState(initial?.subjects ?? []);
  const [skills, setSkills] = useState(initial?.skills ?? []);
  const [availabilityNote, setAvailability] = useState(initial?.availabilityNote ?? "");
  const [maxActiveMentees, setMax] = useState(String(initial?.maxActiveMentees ?? 3));
  const [isAccepting, setAccepting] = useState(initial?.isAccepting ?? true);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [removeOpen, setRemoveOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function save(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveMentorProfile({
        headline,
        about,
        subjects,
        skills,
        availabilityNote,
        maxActiveMentees,
        isAccepting,
      });
      if (!result.ok) {
        setErrors(
          Object.fromEntries(Object.entries(result.fieldErrors ?? {}).map(([k, v]) => [k, v?.[0]])),
        );
        toast.error(result.error);
        return;
      }
      setErrors({});
      toast.success(result.message ?? "Saved.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={save} noValidate className="space-y-6">
      <SettingsSection
        title={initial ? "Your mentor profile" : "Offer to mentor"}
        description="This is what students see on the mentor directory, next to your name, department and year."
        footer={
          <>
            {initial && (
              <Button
                type="button"
                variant="destructive"
                className="mr-auto"
                onClick={() => setRemoveOpen(true)}
              >
                Remove mentor profile
              </Button>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : initial ? "Save changes" : "Publish my mentor profile"}
            </Button>
          </>
        }
      >
        <Field
          id="headline"
          label="Headline"
          error={errors.headline}
          hint="One line, e.g. “Final-year Computing student, happy to help with databases”."
        >
          <TextInput
            id="headline"
            value={headline}
            onChange={(event) => setHeadline(event.target.value)}
            maxLength={100}
            {...describedBy("headline", errors.headline, true)}
          />
        </Field>
        <Field
          id="about"
          label="About you as a mentor"
          optional
          error={errors.about}
          hint={`${about.length}/1000 characters`}
        >
          <TextArea
            id="about"
            value={about}
            onChange={(event) => setAbout(event.target.value)}
            maxLength={1000}
            rows={4}
            placeholder="What have you done that juniors could learn from? How do you like to help?"
            {...describedBy("about", errors.about, true)}
          />
        </Field>
        <TagPicker
          id="subjects"
          label="Subjects you can help with"
          description="Pick at least one. Students filter the directory by these."
          suggestions={SUBJECT_SUGGESTIONS}
          value={subjects}
          onChange={setSubjects}
          max={8}
          error={errors.subjects}
        />
        <TagPicker
          id="skills"
          label="Skills"
          description="Optional: tools, languages or anything specific (e.g. SQL, Figma, CV writing)."
          suggestions={[]}
          value={skills}
          onChange={setSkills}
          max={8}
          error={errors.skills}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="availabilityNote"
            label="Availability"
            optional
            error={errors.availabilityNote}
            hint="e.g. “Weekday evenings, replies within a day”."
          >
            <TextInput
              id="availabilityNote"
              value={availabilityNote}
              onChange={(event) => setAvailability(event.target.value)}
              maxLength={200}
              {...describedBy("availabilityNote", errors.availabilityNote, true)}
            />
          </Field>
          <Field
            id="maxActiveMentees"
            label="Mentees at a time"
            error={errors.maxActiveMentees}
            hint={
              initial
                ? `You have ${initial.activeMenteeCount} active right now.`
                : "You can change this later."
            }
          >
            <SelectInput
              id="maxActiveMentees"
              value={maxActiveMentees}
              onChange={(event) => setMax(event.target.value)}
              {...describedBy("maxActiveMentees", errors.maxActiveMentees, true)}
            >
              {Array.from({ length: MAX_MENTEES_LIMIT }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <label className="flex items-start justify-between gap-4 rounded-2xl border p-4">
          <span className="space-y-0.5">
            <span className="block font-bold">Accepting new requests</span>
            <span className="block text-sm text-muted-foreground">
              Turn this off to pause new requests. Your current mentees aren&apos;t affected.
            </span>
          </span>
          <Switch
            checked={isAccepting}
            onCheckedChange={setAccepting}
            aria-label="Accepting new requests"
          />
        </label>
      </SettingsSection>

      <ConfirmAction
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title="Remove your mentor profile?"
        description="You'll disappear from the directory and any requests still waiting are declined. Your active mentorships and conversations carry on."
        confirmLabel="Remove"
        onConfirm={async () => {
          const result = await removeMentorProfile();
          if (result.ok) {
            toast.success(result.message ?? "Removed.");
            router.refresh();
          } else toast.error(result.error);
        }}
      />
    </form>
  );
}
