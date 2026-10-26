import { GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { MentorProfileForm } from "@/components/mentorship/mentor-profile-form";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { SettingsNav } from "@/components/settings/settings-nav";
import { buttonVariants } from "@/components/ui/button";
import { requireApproved } from "@/lib/auth/session";
import { canBeMentor } from "@/lib/mentorship";
import { ROUTES } from "@/lib/routes";
import { getMyMentorProfile } from "@/server/queries/mentorship";

export const metadata: Metadata = { title: ROUTES["/settings/mentor"].title };

export default async function Page() {
  const user = await requireApproved();
  const profile = await getMyMentorProfile(user.id);
  const eligible = canBeMentor(user.yearOfStudy);

  return (
    <>
      <PageHeader title="Mentoring" description={ROUTES["/settings/mentor"].description}>
        <SettingsNav />
      </PageHeader>
      <div className="max-w-3xl space-y-6">
        {eligible || profile ? (
          <>
            {profile && (
              <p className="rounded-xl bg-surface-tint px-4 py-3 text-sm text-muted-foreground">
                {profile.isAccepting
                  ? "You're listed on the mentor directory."
                  : "You're on the directory but not taking new requests."}{" "}
                <Link
                  href="/mentorship?tab=incoming"
                  className="font-semibold text-primary hover:underline dark:text-accent-foreground"
                >
                  See your requests
                </Link>
              </p>
            )}
            <MentorProfileForm initial={profile} />
          </>
        ) : (
          <EmptyState
            icon={GraduationCap}
            title="Mentoring opens in Year 2"
            description="Senior students (Year 2 and above) can offer to mentor. Until then, you can find a mentor yourself."
            action={
              <Link href="/mentors" className={buttonVariants({ variant: "outline" })}>
                Find a mentor
              </Link>
            }
          />
        )}
      </div>
    </>
  );
}
