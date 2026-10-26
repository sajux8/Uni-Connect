import * as z from "zod";

import { NOTIFICATION_PRESETS } from "@/lib/notifications";

export const notificationPreferencesSchema = z
  .array(
    z.object({
      type: z.string().regex(/^[a-z0-9_]{3,40}$/),
      inApp: z.boolean(),
      email: z.boolean(),
    }),
  )
  .max(50);
export type NotificationPreferenceInput = z.infer<typeof notificationPreferencesSchema>;

export const notificationPresetSchema = z.enum(
  NOTIFICATION_PRESETS.map((p) => p.value) as [string, ...string[]],
);
