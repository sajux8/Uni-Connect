import * as z from "zod";

import { getSessionProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getResource } from "@/server/queries/resources";

/**
 * Feature 7, criterion 5: files are only reachable through a 60-second signed URL, issued
 * after row-level security has confirmed the viewer may see the resource.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/resources/[id]/download">,
) {
  const { id } = await params;
  const user = await getSessionProfile();
  if (!user || user.status !== "approved") {
    return new Response("Sign in to download this resource.", { status: 401 });
  }
  if (!z.uuid().safeParse(id).success) return new Response("Not found", { status: 404 });

  // Read as the user: RLS hides pending resources from others and private-space ones from non-members.
  const resource = await getResource(id);
  if (!resource) return new Response("Not found", { status: 404 });

  const supabase = await createClient();
  await supabase.rpc("record_resource_download", { p_resource_id: id });

  if (resource.kind === "link" && resource.url) {
    return Response.redirect(resource.url, 302);
  }
  if (!resource.filePath) return new Response("Not found", { status: 404 });

  const { data, error } = await createAdminClient()
    .storage.from("resources")
    .createSignedUrl(resource.filePath, 60, { download: resource.fileName ?? true });
  if (error || !data) {
    console.error("resource download", error);
    return new Response("Couldn't prepare the download. Please try again.", { status: 500 });
  }
  return new Response(null, {
    status: 302,
    headers: { Location: data.signedUrl, "Cache-Control": "private, no-store" },
  });
}
