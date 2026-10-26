"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { SelectInput } from "@/components/forms/field";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  MENTORSHIP_REQUEST_OPTIONS,
  VISIBILITY_OPTIONS,
  type RequestPermission,
  type VisibilityLevel,
} from "@/lib/campus";
import { cn } from "@/lib/utils";
import { updatePrivacy } from "@/server/actions/profile";

export function PrivacyForm({
  initial,
}: {
  initial: {
    profileVisibility: VisibilityLevel;
    showYear: boolean;
    mentorshipRequestsFrom: RequestPermission;
  };
}) {
  const [profileVisibility, setVisibility] = useState(initial.profileVisibility);
  const [showYear, setShowYear] = useState(initial.showYear);
  const [mentorshipRequestsFrom, setRequests] = useState(initial.mentorshipRequestsFrom);
  const [pending, startTransition] = useTransition();

  function save(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updatePrivacy({ profileVisibility, showYear, mentorshipRequestsFrom });
      if (result.ok) toast.success(result.message ?? "Saved.");
      else toast.error(result.error);
    });
  }

  return (
    <form onSubmit={save}>
      <SettingsSection
        title="Who can see your profile"
        description="Your name and photo are always visible to approved members so they know who posted. Your email, phone and student ID are never shown."
        footer={
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save privacy settings"}
          </Button>
        }
      >
        <fieldset className="space-y-2.5">
          <legend className="sr-only">Profile visibility</legend>
          {VISIBILITY_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-2xl border-[1.5px] p-4 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/30",
                profileVisibility === option.value
                  ? "border-primary bg-accent"
                  : "border-input hover:border-border-strong",
              )}
            >
              <input
                type="radio"
                name="profileVisibility"
                value={option.value}
                checked={profileVisibility === option.value}
                onChange={() => setVisibility(option.value)}
                className="mt-0.5 size-[18px] shrink-0 accent-primary"
              />
              <span>
                <span className="block text-[15px] font-bold">{option.label}</span>
                <span className="block text-sm text-muted-foreground">{option.description}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="flex items-center justify-between gap-4 rounded-2xl border p-4">
          <label htmlFor="showYear" className="space-y-0.5">
            <span className="block text-[15px] font-bold">Show my year of study</span>
            <span className="block text-sm text-muted-foreground">
              Helps juniors find seniors who can help.
            </span>
          </label>
          <Switch id="showYear" checked={showYear} onCheckedChange={setShowYear} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="mentorshipRequestsFrom" className="block text-[13.5px] font-bold">
            Who can send you mentorship requests
          </label>
          <SelectInput
            id="mentorshipRequestsFrom"
            value={mentorshipRequestsFrom}
            onChange={(event) => setRequests(event.target.value as RequestPermission)}
            className="sm:max-w-sm"
          >
            {MENTORSHIP_REQUEST_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>
        </div>
      </SettingsSection>
    </form>
  );
}
