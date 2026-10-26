import "server-only";

import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Posting or replying in an open space you haven't joined joins it for you
 * (can_post_in_space requires an active membership).
 */
export async function ensureMembership(
  supabase: Supabase,
  spaceId: string,
  userId: string,
): Promise<string | null> {
  const { data: member } = await supabase
    .from("space_members")
    .select("status")
    .eq("space_id", spaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (member?.status === "active") return null;
  if (member?.status === "pending")
    return "Your request to join this space is still waiting for a moderator.";
  if (member?.status === "banned") return "You can't post in this space.";

  const { data: space } = await supabase
    .from("spaces")
    .select("join_policy, type")
    .eq("id", spaceId)
    .maybeSingle();
  if (!space) return "That space doesn't exist.";
  // Department and batch spaces: belonging is enough (lecturers and coordinators included).
  if (space.type === "department" || space.type === "batch") {
    const { data: allowed } = await supabase.rpc("can_post_in_space", { p_space_id: spaceId });
    return allowed ? null : "Only members of this department or batch can post here.";
  }
  if (space.join_policy !== "open")
    return "Join this space before posting. Its moderators approve new members.";

  const { error } = await supabase
    .from("space_members")
    .insert({ space_id: spaceId, user_id: userId, status: "active" });
  if (error && error.code !== "23505") {
    console.error("ensureMembership", error);
    return "We couldn't join you to this space. Please try again.";
  }
  return null;
}
