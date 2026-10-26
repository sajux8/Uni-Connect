"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";

import { databaseErrorMessage, fail, ok, type ActionResult } from "@/lib/action-result";
import { requireApproved } from "@/lib/auth/session";
import { presetPreferences, type NotificationPreset } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";
import {
  notificationPreferencesSchema,
  notificationPresetSchema,
  type NotificationPreferenceInput,
} from "@/lib/validation/notifications";
import {
  listNotifications,
  unreadNotificationCount,
  type NotificationItem,
} from "@/server/queries/notifications";

/** The bell's popover: the latest few, plus the unread count. */
export async function fetchRecentNotifications(): Promise<
  ActionResult<{ items: NotificationItem[]; unread: number }>
> {
  const user = await requireApproved();
  try {
    const [{ items }, unread] = await Promise.all([
      listNotifications(user.id, { limit: 8 }),
      unreadNotificationCount(user.id),
    ]);
    return ok({ items, unread });
  } catch {
    return fail("Couldn't load notifications.");
  }
}

export async function markNotificationRead(notificationId: string): Promise<ActionResult> {
  const user = await requireApproved();
  if (!z.uuid().safeParse(notificationId).success) return fail("That notification doesn't exist.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) return fail(databaseErrorMessage(error));
  revalidatePath("/", "layout");
  return ok();
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  await requireApproved();
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_all_notifications_read");
  if (error) return fail(databaseErrorMessage(error));
  revalidatePath("/", "layout");
  return ok(undefined, "All caught up.");
}

export async function deleteNotification(notificationId: string): Promise<ActionResult> {
  const user = await requireApproved();
  if (!z.uuid().safeParse(notificationId).success) return fail("That notification doesn't exist.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("user_id", user.id);
  if (error) return fail(databaseErrorMessage(error));
  revalidatePath("/", "layout");
  return ok(undefined, "Notification removed.");
}

/** Saves the settings matrix. Locked types are skipped (the database refuses them anyway). */
export async function updateNotificationPreferences(
  input: NotificationPreferenceInput,
): Promise<ActionResult> {
  const user = await requireApproved();
  const parsed = notificationPreferencesSchema.safeParse(input);
  if (!parsed.success) return fail("Those settings aren't valid.");

  const supabase = await createClient();
  const { data: types } = await supabase
    .from("notification_types")
    .select("type, email_available, locked");
  const known = new Map((types ?? []).map((t) => [t.type, t]));
  const rows = parsed.data
    .filter((p) => known.has(p.type) && !known.get(p.type)!.locked)
    .map((p) => ({
      user_id: user.id,
      type: p.type,
      in_app: p.inApp,
      email: known.get(p.type)!.email_available && p.email,
    }));
  if (rows.length === 0) return ok(undefined, "Nothing to save.");

  const { error } = await supabase
    .from("notification_preferences")
    .upsert(rows, { onConflict: "user_id,type" });
  if (error) {
    console.error("updateNotificationPreferences", error);
    return fail(databaseErrorMessage(error));
  }
  revalidatePath("/settings/notifications");
  return ok(undefined, "Notification settings saved.");
}

/** Onboarding presets: replace the user's preferences with the preset's. */
export async function applyNotificationPreset(preset: string): Promise<ActionResult> {
  const user = await requireApproved({ allowOnboarding: true });
  const parsed = notificationPresetSchema.safeParse(preset);
  if (!parsed.success) return fail("Choose one of the options.");
  const value = parsed.data as NotificationPreset;

  const supabase = await createClient();
  const { error: clearError } = await supabase
    .from("notification_preferences")
    .delete()
    .eq("user_id", user.id);
  if (clearError) return fail(databaseErrorMessage(clearError));

  const rows = presetPreferences(value).map((p) => ({ ...p, user_id: user.id }));
  if (rows.length > 0) {
    const { error } = await supabase.from("notification_preferences").insert(rows);
    if (error) return fail(databaseErrorMessage(error));
  }
  if (value === "everything") {
    await supabase
      .from("space_members")
      .update({ notify_level: "all" })
      .eq("user_id", user.id)
      .eq("status", "active");
  }
  return ok();
}
