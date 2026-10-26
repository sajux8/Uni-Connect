import { Hash } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { NotifySelect } from "@/components/community/space-controls";
import { SpaceIcon } from "@/components/community/space-icon";
import { NotificationPreferencesForm } from "@/components/settings/notification-preferences-form";
import { SettingsNav } from "@/components/settings/settings-nav";
import { SettingsSection } from "@/components/settings/settings-section";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { requireApproved } from "@/lib/auth/session";
import { NOTIFY_LEVELS } from "@/lib/community";
import { ROUTES } from "@/lib/routes";
import { getNotificationPreferences } from "@/server/queries/notifications";
import { listJoinedSpaces } from "@/server/queries/spaces";

export const metadata: Metadata = { title: ROUTES["/settings/notifications"].title };

export default async function Page() {
  const user = await requireApproved();
  const [prefs, spaces] = await Promise.all([
    getNotificationPreferences(user.id),
    listJoinedSpaces(user.id),
  ]);

  return (
    <>
      <PageHeader title="Notifications" description={ROUTES["/settings/notifications"].description}>
        <SettingsNav />
      </PageHeader>
      <div className="max-w-3xl space-y-6">
        <NotificationPreferencesForm initial={prefs} role={user.role} />

        <SettingsSection
          title="Spaces"
          description={`How much to hear from each space you've joined. ${NOTIFY_LEVELS.map((n) => `${n.label}: ${n.description.toLowerCase()}`).join(" ")}`}
        >
          {spaces.length === 0 ? (
            <EmptyState
              icon={Hash}
              title="You haven't joined any spaces"
              className="py-8"
              action={
                <Link href="/spaces" className={buttonVariants({ variant: "outline" })}>
                  Browse spaces
                </Link>
              }
            />
          ) : (
            <ul className="divide-y rounded-2xl border">
              {spaces.map((space) => (
                <li key={space.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <SpaceIcon icon={space.icon} type={space.type} size="sm" />
                  <Link
                    href={`/spaces/${space.slug}`}
                    className="min-w-32 flex-1 truncate py-2 font-semibold hover:text-primary"
                  >
                    {space.name}
                  </Link>
                  <NotifySelect
                    spaceId={space.id}
                    initial={space.membership?.notifyLevel ?? "important"}
                  />
                </li>
              ))}
            </ul>
          )}
        </SettingsSection>
      </div>
    </>
  );
}
