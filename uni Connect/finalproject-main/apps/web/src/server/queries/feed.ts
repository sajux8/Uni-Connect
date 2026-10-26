import "server-only";

import { createClient } from "@/lib/supabase/server";
import { listJoinedSpaces } from "@/server/queries/spaces";

/**
 * Which spaces feed a personal home tab.
 * - following: exactly the spaces you've joined.
 * - foryou: joined spaces plus your department's space(s), so new members see something.
 */
export async function feedSpaceIds(
  userId: string,
  scope: "following" | "foryou",
): Promise<string[]> {
  const joined = (await listJoinedSpaces(userId)).map((s) => s.id);
  if (scope === "following") return joined;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("department_id")
    .eq("id", userId)
    .single();
  if (!profile?.department_id) return joined;
  const { data: deptSpaces } = await supabase
    .from("spaces")
    .select("id")
    .eq("department_id", profile.department_id)
    .eq("join_policy", "open");
  return [...new Set([...joined, ...(deptSpaces ?? []).map((s) => s.id)])];
}
