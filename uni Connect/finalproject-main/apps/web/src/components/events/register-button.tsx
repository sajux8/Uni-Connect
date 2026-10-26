"use client";

import { CalendarCheck, Check, Clock, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmAction } from "@/components/community/confirm-dialogs";
import { Button } from "@/components/ui/button";
import type { Availability, RegistrationStatus } from "@/lib/events";
import { cn } from "@/lib/utils";
import { cancelRegistration, registerForEvent } from "@/server/actions/events";

/**
 * Every registration state: Register → Registered ✓ [Cancel] /
 * Join waitlist / Waitlisted #3 / Registration closed / Full / Not eligible.
 */
export function RegisterButton({
  eventId,
  eventTitle,
  availability,
  registration,
  eligible,
  size = "default",
  className,
}: {
  eventId: string;
  eventTitle: string;
  availability: Availability;
  registration: { status: RegistrationStatus; waitlistPosition: number | null } | null;
  eligible: boolean;
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();
  const live = ["open", "few", "waitlist"].includes(availability);

  function register() {
    startTransition(async () => {
      const result = await registerForEvent(eventId);
      if (result.ok) {
        toast.success(result.message ?? "Registered.");
        router.refresh();
      } else toast.error(result.error);
    });
  }

  if (registration && availability !== "cancelled" && availability !== "past") {
    const waitlisted = registration.status === "waitlisted";
    return (
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        <span
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold",
            waitlisted ? "tint tint-amber" : "tint tint-emerald",
          )}
        >
          {waitlisted ? (
            <Clock className="size-4" aria-hidden />
          ) : (
            <Check className="size-4" aria-hidden />
          )}
          {waitlisted ? `Waitlisted #${registration.waitlistPosition}` : "Registered"}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => setConfirm(true)}
          className="text-muted-foreground"
        >
          {waitlisted ? "Leave waitlist" : "Cancel"}
        </Button>
        <ConfirmAction
          open={confirm}
          onOpenChange={setConfirm}
          title={waitlisted ? "Leave the waitlist?" : "Cancel your registration?"}
          description={
            waitlisted
              ? `You'll lose your place in the queue for “${eventTitle}”.`
              : `Your seat at “${eventTitle}” will go to the next person on the waitlist.`
          }
          confirmLabel={waitlisted ? "Leave waitlist" : "Cancel registration"}
          onConfirm={async () => {
            const result = await cancelRegistration(eventId);
            if (result.ok) {
              toast.success(result.message ?? "Cancelled.");
              router.refresh();
            } else toast.error(result.error);
          }}
        />
      </div>
    );
  }

  if (live && !eligible) {
    return (
      <Button variant="outline" size={size} disabled className={className}>
        <Lock data-icon="inline-start" /> Not eligible
      </Button>
    );
  }
  if (availability === "open" || availability === "few") {
    return (
      <Button size={size} onClick={register} disabled={pending} className={className}>
        <CalendarCheck data-icon="inline-start" />
        {pending ? "Registering…" : "Register"}
      </Button>
    );
  }
  if (availability === "waitlist") {
    return (
      <Button
        variant="outline"
        size={size}
        onClick={register}
        disabled={pending}
        className={className}
      >
        <Clock data-icon="inline-start" />
        {pending ? "Joining…" : "Join waitlist"}
      </Button>
    );
  }
  const label: Partial<Record<Availability, string>> = {
    full: "Full",
    closed: "Registration closed",
  };
  if (!label[availability]) return null;
  return (
    <Button variant="outline" size={size} disabled className={className}>
      {label[availability]}
    </Button>
  );
}
