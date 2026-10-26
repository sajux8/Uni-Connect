import * as z from "zod";

import { getSessionProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * A ticket's photo (Phase F). The ticket is read as the signed-in member, so RLS decides who may see
 * it (its owner and handlers); then a 60-second signed URL from the private bucket.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/tickets/[id]/photo">) {
  const { id } = await params;
  const user = await getSessionProfile();
  if (!user || user.status !== "approved") return new Response("Unauthorized", { status: 401 });
  if (!z.uuid().safeParse(id).success) return new Response("Not found", { status: 404 });

  const supabase = await createClient();
  const { data: ticket } = await supabase
    .from("tickets")
    .select("photo_path")
    .eq("id", id)
    .maybeSingle();
  if (!ticket?.photo_path) return new Response("Not found", { status: 404 });

  const { data } = await createAdminClient()
    .storage.from("ticket-photos")
    .createSignedUrl(ticket.photo_path, 60);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(null, {
    status: 302,
    headers: { Location: data.signedUrl, "Cache-Control": "private, no-store" },
  });
}
