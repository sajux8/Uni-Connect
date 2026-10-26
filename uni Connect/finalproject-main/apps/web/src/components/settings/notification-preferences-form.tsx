"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { roleAtLeast, type UserRole } from "@/lib/campus";
import {
  NOTIFICATION_GROUP_LABELS,
  NOTIFICATION_TYPE_INFO,
  type NotificationGroup,
} from "@/lib/notifications";
import { updateNotificationPreferences } from "@/server/actions/notifications";
import type { PreferenceRow } from "@/server/queries/notifications";

/** The type × channel matrix on /settings/notifications. */
export function NotificationPreferencesForm({
  initial,
  role,
}: {
  initial: PreferenceRow[];
  role: UserRole;
}) {
  const [prefs, setPrefs] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  const visible = prefs.filter((p) => {
    const info = NOTIFICATION_TYPE_INFO[p.type];
    return info && (!info.minRole || roleAtLeast(role, info.minRole));
  });
  const groups = (Object.keys(NOTIFICATION_GROUP_LABELS) as NotificationGroup[])
    .map((group) => ({
      group,
      rows: visible.filter((p) => NOTIFICATION_TYPE_INFO[p.type].group === group),
    }))
    .filter((g) => g.rows.length > 0);

  function set(type: string, channel: "inApp" | "email", value: boolean) {
    setPrefs((current) => current.map((p) => (p.type === type ? { ...p, [channel]: value } : p)));
    setDirty(true);
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateNotificationPreferences(
        prefs
          .filter((p) => !p.locked)
          .map((p) => ({ type: p.type, inApp: p.inApp, email: p.email })),
      );
      if (result.ok) {
        setDirty(false);
        toast.success(result.message ?? "Saved.");
      } else toast.error(result.error);
    });
  }

  return (
    <form onSubmit={save}>
      <SettingsSection
        title="What you hear about"
        description="In-app notifications appear under the bell. Email is only offered for things that matter outside the app."
        footer={
          <Button type="submit" disabled={pending || !dirty}>
            {pending ? "Saving…" : "Save notification settings"}
          </Button>
        }
      >
        <div className="space-y-6">
          {groups.map(({ group, rows }) => (
            <fieldset key={group}>
              <legend className="mb-2 text-xs font-extrabold tracking-[0.14em] text-muted-foreground uppercase">
                {NOTIFICATION_GROUP_LABELS[group]}
              </legend>
              <div className="divide-y rounded-2xl border">
                <div
                  aria-hidden
                  className="hidden grid-cols-[1fr_72px_72px] gap-3 px-4 py-2 text-xs font-bold text-muted-foreground sm:grid"
                >
                  <span />
                  <span className="text-center">In app</span>
                  <span className="text-center">Email</span>
                </div>
                {rows.map((p) => {
                  const info = NOTIFICATION_TYPE_INFO[p.type];
                  return (
                    <div
                      key={p.type}
                      className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-3 sm:grid-cols-[1fr_72px_72px] sm:px-4"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{info.label}</p>
                        <p className="text-[13px] text-muted-foreground">{info.description}</p>
                      </div>
                      <label className="flex min-w-11 flex-col items-center gap-1.5 py-1 text-[11px] text-muted-foreground">
                        <Switch
                          checked={p.inApp}
                          disabled={p.locked}
                          onCheckedChange={(value) => set(p.type, "inApp", value)}
                          aria-label={`${info.label}: in app`}
                        />
                        <span className="sm:hidden">In app</span>
                      </label>
                      <label className="flex min-w-11 flex-col items-center gap-1.5 py-1 text-[11px] text-muted-foreground">
                        {p.emailAvailable ? (
                          <Switch
                            checked={p.email}
                            disabled={p.locked}
                            onCheckedChange={(value) => set(p.type, "email", value)}
                            aria-label={`${info.label}: email`}
                          />
                        ) : (
                          <span className="text-xs" aria-label={`${info.label}: no email`}>
                            —
                          </span>
                        )}
                        <span className="sm:hidden">Email</span>
                      </label>
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      </SettingsSection>
      {/* On phones the footer is far below the switches: offer the save right where you are. */}
      {dirty && (
        <div className="fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex items-center justify-between gap-3 rounded-full border bg-card py-2 pr-2 pl-5 shadow-lift md:hidden">
          <span className="text-sm font-semibold">Unsaved changes</span>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
    </form>
  );
}
