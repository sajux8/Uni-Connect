import { format } from "date-fns";
import { Ban, CircleX } from "lucide-react";

import { AuthCard } from "@/components/auth/auth-card";
import { SignOutButton } from "@/components/auth/sign-out-button";
import type { SessionProfile } from "@/lib/auth/session";

/** Shared body of /rejected and /suspended: the reason, what to do next, log out. */
export function AccountBlocked({
  user,
  kind,
}: {
  user: SessionProfile;
  kind: "rejected" | "suspended";
}) {
  const rejected = kind === "rejected";
  const until = !rejected && user.suspendedUntil ? new Date(user.suspendedUntil) : null;

  return (
    <AuthCard
      icon={rejected ? <CircleX aria-hidden /> : <Ban aria-hidden />}
      eyebrow={rejected ? "Application reviewed" : "Account suspended"}
      title={rejected ? "Your application wasn't approved" : "Your account is suspended"}
      description={
        rejected
          ? "Your coordinator reviewed your details and couldn't approve this account."
          : until
            ? `You can't use UniConnect until ${format(until, "d MMMM yyyy, h:mm a")}.`
            : "You can't use UniConnect until an administrator lifts the suspension."
      }
    >
      <div className="mb-5 rounded-2xl border bg-surface-tint p-4">
        <h2 className="mb-1.5 text-xs font-extrabold tracking-[0.14em] text-muted-foreground uppercase">
          Reason given
        </h2>
        <p className="text-[15px] font-medium">{user.statusReason ?? "No reason was recorded."}</p>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        {rejected
          ? "If you think this is a mistake, contact Student Services with your student or staff ID and the email you registered with."
          : "If you'd like to appeal, contact Student Services with the email you registered with."}
      </p>
      <SignOutButton />
    </AuthCard>
  );
}
