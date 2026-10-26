import { UserX } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { UserAvatar } from "@/components/shared/user-avatar";
import { UnblockButton } from "@/components/profile/block-user-dialog";
import { PrivacyForm } from "@/components/settings/privacy-form";
import { SettingsNav } from "@/components/settings/settings-nav";
import { SettingsSection } from "@/components/settings/settings-section";
import { requireApproved } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: ROUTES["/settings/privacy"].title };

export default async function Page() {
  await requireApproved();
  const supabase = await createClient();
  const [{ data: settings }, { data: blocks }] = await Promise.all([
    supabase.rpc("my_profile").maybeSingle(),
    supabase
      .from("user_blocks")
      .select("blocked_id, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const blockedIds = (blocks ?? []).map((b) => b.blocked_id);
  const { data: blocked } = blockedIds.length
    ? await supabase
        .from("profile_cards")
        .select("id, full_name, username, avatar_url")
        .in("id", blockedIds)
    : { data: [] };

  return (
    <>
      <PageHeader title="Privacy" description={ROUTES["/settings/privacy"].description}>
        <SettingsNav />
      </PageHeader>
      <div className="max-w-3xl space-y-6">
        <PrivacyForm
          initial={{
            profileVisibility: settings?.profile_visibility ?? "everyone",
            showYear: settings?.show_year ?? true,
            mentorshipRequestsFrom: settings?.mentorship_requests_from ?? "everyone",
          }}
        />
        <SettingsSection
          title="Blocked people"
          description="People you block can't message you or send you mentorship requests. Block someone from the ⋯ menu on their profile or in a conversation."
        >
          {blocked && blocked.length > 0 ? (
            <ul className="divide-y rounded-2xl border">
              {blocked.map((person) => (
                <li key={person.id} className="flex items-center gap-3 px-4 py-3">
                  <UserAvatar name={person.full_name ?? "?"} src={person.avatar_url} size="sm" />
                  <span className="min-w-0 flex-1 truncate font-semibold">{person.full_name}</span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    @{person.username}
                  </span>
                  <UnblockButton userId={person.id!} name={person.full_name ?? "this person"} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={UserX} title="You haven't blocked anyone" className="py-8" />
          )}
        </SettingsSection>
      </div>
    </>
  );
}
