"use client";

import { ArrowLeft, ArrowRight, Bell, Check, PartyPopper } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { SpaceIcon } from "@/components/community/space-icon";
import { describedBy, Field, FormMessage, TextArea } from "@/components/forms/field";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { TagPicker } from "@/components/profile/tag-picker";
import { UsernameField } from "@/components/profile/username-field";
import { Eyebrow } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { INTEREST_SUGGESTIONS } from "@/lib/campus";
import { NOTIFICATION_PRESETS, type NotificationPreset } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { onboardingSchema } from "@/lib/validation/profile";
import { applyNotificationPreset } from "@/server/actions/notifications";
import { completeOnboarding } from "@/server/actions/profile";
import { joinSpaces } from "@/server/actions/spaces";

const STEPS = ["Your profile", "Interests", "Spaces", "Notifications", "All set"] as const;

export interface OnboardingSpace {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  type: "department" | "batch" | "module" | "club" | "general";
  suggested: boolean;
}

/** First-login setup: profile, interests, spaces, notifications. */
export function OnboardingWizard({
  user,
  spaces,
}: {
  spaces: OnboardingSpace[];
  user: {
    id: string;
    fullName: string;
    username: string;
    avatarUrl: string | null;
    bio: string | null;
  };
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState(user.username);
  const [bio, setBio] = useState(user.bio ?? "");
  const [interests, setInterests] = useState<string[]>([]);
  const [expertise, setExpertise] = useState<string[]>([]);
  const [chosen, setChosen] = useState<string[]>(
    spaces.filter((s) => s.suggested).map((s) => s.id),
  );
  const [preset, setPreset] = useState<NotificationPreset>("important");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const firstName = user.fullName.split(/\s+/)[0];

  function validateStep(target: number): boolean {
    const result = onboardingSchema.safeParse({ username, bio, interests, expertise });
    if (result.success) return true;
    const fieldsForStep: Record<number, string[]> = {
      0: ["username", "bio"],
      1: ["interests", "expertise"],
    };
    const relevant = result.error.issues.filter((issue) =>
      fieldsForStep[target]?.includes(String(issue.path[0])),
    );
    setErrors(Object.fromEntries(relevant.map((issue) => [String(issue.path[0]), issue.message])));
    return relevant.length === 0;
  }

  function next() {
    if (!validateStep(step)) return;
    setErrors({});
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function finish() {
    setFormError(undefined);
    startTransition(async () => {
      const joined = await joinSpaces(chosen);
      if (!joined.ok) {
        setFormError(joined.error);
        setStep(2);
        return;
      }
      // Spaces first, so "Everything" can set the new memberships to "All posts".
      const notifications = await applyNotificationPreset(preset);
      if (!notifications.ok) {
        setFormError(notifications.error);
        setStep(3);
        return;
      }
      const result = await completeOnboarding({ username, bio, interests, expertise });
      if (!result.ok) {
        const fieldErrors = result.fieldErrors ?? {};
        setErrors(Object.fromEntries(Object.entries(fieldErrors).map(([k, v]) => [k, v?.[0]])));
        if (fieldErrors.username || fieldErrors.bio) setStep(0);
        else if (fieldErrors.interests || fieldErrors.expertise) setStep(1);
        setFormError(result.error);
        return;
      }
      toast.success(`Welcome to UniConnect, ${firstName}!`);
      router.replace("/home");
      router.refresh();
    });
  }

  return (
    <div className="rounded-[22px] border bg-card p-6 shadow-lift sm:p-8">
      {/* Progress */}
      <ol className="mb-7 grid grid-cols-5 gap-2" aria-label="Setup progress">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? "step" : undefined} className="space-y-1.5">
            <span
              className={cn(
                "block h-1.5 rounded-full transition-colors",
                i <= step ? "bg-primary" : "bg-muted",
              )}
            />
            <span
              className={cn(
                "block text-xs font-bold max-sm:sr-only",
                i === step ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {i + 1}. {label}
            </span>
          </li>
        ))}
      </ol>

      {formError && (
        <div className="mb-5">
          <FormMessage tone="error">{formError}</FormMessage>
        </div>
      )}

      {step === 0 && (
        <section className="space-y-6" aria-labelledby="step-title">
          <header className="space-y-2">
            <Eyebrow>Welcome, {firstName}</Eyebrow>
            <h1
              id="step-title"
              className="text-[26px] leading-tight font-extrabold tracking-[-0.02em]"
            >
              Set up your profile
            </h1>
            <p className="text-[15px] text-muted-foreground">
              This is how other students and staff will see you. You can change it any time in
              Settings.
            </p>
          </header>
          <AvatarUploader userId={user.id} name={user.fullName} initialUrl={user.avatarUrl} />
          <UsernameField
            value={username}
            original={user.username}
            onChange={setUsername}
            error={errors.username}
          />
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
              placeholder="e.g. Second-year computing student, into web development and robotics."
              {...describedBy("bio", errors.bio, true)}
            />
          </Field>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-7" aria-labelledby="step-title">
          <header className="space-y-2">
            <Eyebrow>What you&apos;re into</Eyebrow>
            <h1
              id="step-title"
              className="text-[26px] leading-tight font-extrabold tracking-[-0.02em]"
            >
              Pick your interests
            </h1>
            <p className="text-[15px] text-muted-foreground">
              We use these to suggest spaces, events and people. Choose at least three.
            </p>
          </header>
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
            description="Optional. Seniors who list expertise are easier to find for advice."
            suggestions={[]}
            value={expertise}
            onChange={setExpertise}
            error={errors.expertise}
          />
        </section>
      )}

      {step === 2 && (
        <section className="space-y-6" aria-labelledby="step-title">
          <header className="space-y-2">
            <Eyebrow>Find your people</Eyebrow>
            <h1
              id="step-title"
              className="text-[26px] leading-tight font-extrabold tracking-[-0.02em]"
            >
              Join some spaces
            </h1>
            <p className="text-[15px] text-muted-foreground">
              Spaces are where discussions and questions happen. We&apos;ve picked a few for you;
              change them any time.
            </p>
          </header>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {spaces.map((space) => {
              const selected = chosen.includes(space.id);
              return (
                <li key={space.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      setChosen((ids) =>
                        selected ? ids.filter((id) => id !== space.id) : [...ids, space.id],
                      )
                    }
                    className={cn(
                      "flex h-full w-full items-start gap-3 rounded-2xl border-[1.5px] p-3.5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                      selected
                        ? "border-primary bg-accent"
                        : "border-input bg-card hover:border-border-strong",
                    )}
                  >
                    <SpaceIcon
                      icon={space.icon}
                      type={space.type}
                      size="sm"
                      className="size-9 rounded-xl [&_svg]:size-4"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{space.name}</span>
                      {space.description && (
                        <span className="line-clamp-2 block text-xs text-muted-foreground">
                          {space.description}
                        </span>
                      )}
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-[1.5px]",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input",
                      )}
                    >
                      {selected && <Check className="size-3" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-muted-foreground">
            {chosen.length === 0
              ? "You can skip this and join spaces later."
              : `${chosen.length} selected`}
          </p>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-6" aria-labelledby="step-title">
          <header className="space-y-2">
            <Eyebrow>Stay in the loop</Eyebrow>
            <h1
              id="step-title"
              className="text-[26px] leading-tight font-extrabold tracking-[-0.02em]"
            >
              How much do you want to hear?
            </h1>
            <p className="text-[15px] text-muted-foreground">
              You can fine-tune this later in Settings → Notifications. Account emails (like
              approvals) are always sent.
            </p>
          </header>
          <fieldset className="space-y-2.5">
            <legend className="sr-only">Notification preset</legend>
            {NOTIFICATION_PRESETS.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-2xl border-[1.5px] p-4 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/30",
                  preset === option.value
                    ? "border-primary bg-accent"
                    : "border-input hover:border-border-strong",
                )}
              >
                <input
                  type="radio"
                  name="preset"
                  value={option.value}
                  checked={preset === option.value}
                  onChange={() => setPreset(option.value)}
                  className="mt-1 size-4 accent-primary"
                />
                <span>
                  <span className="flex items-center gap-2 font-bold">
                    {option.value === "everything" && <Bell className="size-4" aria-hidden />}
                    {option.label}
                    {option.value === "important" && (
                      <span className="text-xs font-semibold text-primary dark:text-accent-foreground">
                        Recommended
                      </span>
                    )}
                  </span>
                  <span className="block text-[13px] text-muted-foreground">
                    {option.description}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        </section>
      )}

      {step === 4 && (
        <section className="space-y-6 text-center" aria-labelledby="step-title">
          <span className="mx-auto grid size-16 place-items-center rounded-[18px] bg-accent text-accent-foreground">
            <PartyPopper className="size-7" aria-hidden />
          </span>
          <header className="space-y-2">
            <h1
              id="step-title"
              className="text-[26px] leading-tight font-extrabold tracking-[-0.02em]"
            >
              You&apos;re all set, {firstName}
            </h1>
            <p className="mx-auto max-w-md text-[15px] text-muted-foreground">
              Your profile is ready. Next, explore official announcements, upcoming events and the
              spaces for your department and batch.
            </p>
          </header>
          <p className="mx-auto max-w-sm rounded-2xl border bg-surface-tint p-4 text-sm text-muted-foreground">
            {chosen.length > 0
              ? `You'll join ${chosen.length} ${chosen.length === 1 ? "space" : "spaces"}. Their posts appear on your home feed.`
              : "Browse Spaces from the sidebar whenever you're ready."}
          </p>
        </section>
      )}

      <div className="mt-8 flex items-center justify-between gap-3 border-t pt-5">
        {step > 0 ? (
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={pending}>
            <ArrowLeft data-icon="inline-start" />
            Back
          </Button>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 ? (
          <Button onClick={next}>
            Continue
            <ArrowRight data-icon="inline-end" />
          </Button>
        ) : (
          <Button onClick={finish} disabled={pending} size="lg">
            {pending ? "Finishing…" : "Go to UniConnect"}
            <ArrowRight data-icon="inline-end" />
          </Button>
        )}
      </div>
    </div>
  );
}
