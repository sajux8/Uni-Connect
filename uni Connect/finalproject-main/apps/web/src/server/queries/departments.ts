import "server-only";

import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/** Active departments for the registration and profile forms (readable without signing in). */
export async function listDepartments(): Promise<{ id: string; name: string }[]> {
  if (!getSupabaseEnv()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("departments")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  if (error) {
    console.error("listDepartments", error);
    return [];
  }
  return data;
}
