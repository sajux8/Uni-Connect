import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OnboardingWizard } from "@/components/profile/onboarding-wizard";
import { homeFor } from "@/lib/auth/routing";
import { requireUser } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { listSpaces } from "@/server/queries/spaces";

export const metadata: Metadata = { title: ROUTES["/onboarding"].title };

export default async function Page() {
  const user = await requireUser("/onboarding");
  if (user.status !== "approved" || user.onboardingCompleted) redirect(homeFor(user));
  const spaces = await listSpaces(user.id);

  return (
    <OnboardingWizard
      spaces={spaces
        // Department and batch spaces need no joining: members are in theirs already.
        .filter((s) => s.joinPolicy === "open" && s.type !== "department" && s.type !== "batch")
        .map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          icon: s.icon,
          type: s.type,
          // The campus-wide general spaces.
          suggested: s.type === "general",
        }))
        .sort((a, b) => Number(b.suggested) - Number(a.suggested))}
      user={{
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
      }}
    />
  );
}
