import type { Metadata } from "next";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { PageHeader } from "@/components/shared/page-header";
import { ChangePasswordForm, DeleteAccountSection } from "@/components/settings/account-forms";
import { SettingsNav } from "@/components/settings/settings-nav";
import { SettingsSection } from "@/components/settings/settings-section";
import { requireApproved } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/campus";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: ROUTES["/settings/account"].title };

export default async function Page() {
  const user = await requireApproved();
  const supabase = await createClient();
  const { data: openRequest } = await supabase
    .from("account_deletion_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  return (
    <>
      <PageHeader title="Account" description={ROUTES["/settings/account"].description}>
        <SettingsNav />
      </PageHeader>
      <div className="max-w-3xl space-y-6">
        <SettingsSection
          title="Sign-in details"
          description="Only you and administrators can see your email."
        >
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Email</dt>
              <dd className="font-semibold break-all">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Role</dt>
              <dd className="font-semibold">{ROLE_LABELS[user.role]}</dd>
            </div>
          </dl>
        </SettingsSection>
        <ChangePasswordForm />
        <SettingsSection title="Log out" description="Sign out of UniConnect on this device.">
          <SignOutButton className="sm:w-48" />
        </SettingsSection>
        <DeleteAccountSection hasOpenRequest={Boolean(openRequest)} />
      </div>
    </>
  );
}
