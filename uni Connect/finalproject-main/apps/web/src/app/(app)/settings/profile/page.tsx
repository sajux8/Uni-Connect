import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { ProfileForm } from "@/components/settings/profile-form";
import { SettingsNav } from "@/components/settings/settings-nav";
import { requireApproved } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { listDepartments } from "@/server/queries/departments";

export const metadata: Metadata = { title: ROUTES["/settings/profile"].title };

export default async function Page() {
  const [user, departments] = await Promise.all([requireApproved(), listDepartments()]);

  return (
    <>
      <PageHeader title="Your profile" description={ROUTES["/settings/profile"].description}>
        <SettingsNav />
      </PageHeader>
      <div className="max-w-3xl">
        <ProfileForm
          departments={departments}
          user={{
            id: user.id,
            fullName: user.fullName,
            username: user.username,
            avatarUrl: user.avatarUrl,
            bio: user.bio,
            departmentId: user.departmentId,
            yearOfStudy: user.yearOfStudy,
            interests: user.interests,
            expertise: user.expertise,
            isStaff: user.requestedRole === "staff",
          }}
        />
      </div>
    </>
  );
}
