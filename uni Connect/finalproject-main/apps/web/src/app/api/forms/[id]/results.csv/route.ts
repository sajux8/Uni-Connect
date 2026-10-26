import * as z from "zod";

import { getSessionProfile } from "@/lib/auth/session";
import { resultsCsv } from "@/lib/forms";
import { canSeeResults, getForm, getResults } from "@/server/queries/forms";

/** Byte-order mark so Excel opens UTF-8 answers correctly. */
const BOM = String.fromCharCode(0xfeff);

/** A feedback form's answers as CSV, one row per (anonymous) response, for results viewers. */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/forms/[id]/results.csv">,
) {
  const { id } = await params;
  const user = await getSessionProfile();
  if (!user || user.status !== "approved") return new Response("Unauthorized", { status: 401 });
  if (!z.uuid().safeParse(id).success) return new Response("Not found", { status: 404 });

  const form = await getForm(id);
  if (!form) return new Response("Not found", { status: 404 });
  if (!(await canSeeResults(id))) {
    return new Response(
      "Only the form's creator, the lecturer it's about or the coordinator can export results.",
      {
        status: 403,
      },
    );
  }
  const { answers } = await getResults(id);
  const filename = `feedback-${
    form.title
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "form"
  }.csv`;
  return new Response(BOM + resultsCsv(form.questions, answers), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
