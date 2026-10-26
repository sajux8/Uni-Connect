"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { DepartmentOption } from "@/components/auth/application-fields";
import { describedBy, Field, SelectInput, TextArea, TextInput } from "@/components/forms/field";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { TagPicker } from "@/components/profile/tag-picker";
import { UsernameField } from "@/components/profile/username-field";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { INTEREST_SUGGESTIONS, YEAR_OPTIONS } from "@/lib/campus";
import { updateProfile } from "@/server/actions/profile";

export interface ProfileFormUser {
  id: string;
  fullName: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  departmentId: string | null;
  yearOfStudy: number | null;
  interests: string[];
  expertise: string[];
  isStaff: boolean;
}

export function ProfileForm({
  user,
  departments,
}: {
  user: ProfileFormUser;
  departments: DepartmentOption[];
}) {
  const [fullName, setFullName] = useState(user.fullName);
  const [username, setUsername] = useState(user.username);
  const [bio, setBio] = useState(user.bio ?? "");
  const [departmentId, setDepartmentId] = useState(user.departmentId ?? "");
  const [yearOfStudy, setYearOfStudy] = useState(
    user.yearOfStudy === null ? "" : String(user.yearOfStudy),
  );
  const [interests, setInterests] = useState(user.interests);
  const [expertise, setExpertise] = useState(user.expertise);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [pending, startTransition] = useTransition();

  function save(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateProfile({
        fullName,
        username,
        bio,
        departmentId,
        yearOfStudy,
        interests,
        expertise,
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
    });
  }

  return (
    <div className="space-y-6">
      <SettingsSection title="Photo" description="Shown next to everything you post.">
        <AvatarUploader userId={user.id} name={fullName} initialUrl={user.avatarUrl} />
      </SettingsSection>

      <form onSubmit={save} noValidate>
        <SettingsSection
          title="About you"
          description="Your name, department and year help classmates find you. We never show your email or student ID."
          footer={
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save profile"}
            </Button>
          }
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="fullName" label="Full name" error={errors.fullName}>
              <TextInput
                id="fullName"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                maxLength={80}
                autoComplete="name"
                {...describedBy("fullName", errors.fullName)}
              />
            </Field>
            <UsernameField
              value={username}
              original={user.username}
              onChange={setUsername}
              error={errors.username}
            />
            <Field
              id="departmentId"
              label="Department"
              hint="Your coordinator can move you to another department."
              error={errors.departmentId}
            >
              <SelectInput
                id="departmentId"
                value={departmentId}
                disabled
                onChange={(event) => setDepartmentId(event.target.value)}
                {...describedBy("departmentId", errors.departmentId, true)}
              >
                <option value="" disabled>
                  Choose…
                </option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
            {!user.isStaff && (
              <Field id="yearOfStudy" label="Year of study">
                <SelectInput
                  id="yearOfStudy"
                  value={yearOfStudy}
                  onChange={(event) => setYearOfStudy(event.target.value)}
                >
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y.value} value={y.value}>
                      {y.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            )}
          </div>
          <Field
            id="bio"
            label="Short bio"
            optional
            hint={`${bio.length}/160 characters`}
            error={errors.bio}
          >
            <TextArea
              id="bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={160}
              rows={3}
              {...describedBy("bio", errors.bio, true)}
            />
          </Field>
          <TagPicker
            id="interests"
            label="Interests"
            suggestions={INTEREST_SUGGESTIONS}
            value={interests}
            onChange={setInterests}
            error={errors.interests}
          />
          <TagPicker
            id="expertise"
            label="Things you can help others with"
            suggestions={[]}
            value={expertise}
            onChange={setExpertise}
            error={errors.expertise}
          />
        </SettingsSection>
      </form>
    </div>
  );
}
