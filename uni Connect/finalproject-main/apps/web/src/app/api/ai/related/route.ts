import * as z from "zod";

import { aiConfig, aiConfigured } from "@/lib/ai/config";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { relatedToDraft } from "@/server/ai/retrieve";

/**
 * Questions similar to a draft, shown while someone writes a new question.
 * Runs as the member, so only questions they can read come back. Doesn't count as an Ask AI
 * question, but is limited per day to protect the free tier.
 */
const bodySchema = z.object({
  title: z.string().trim().min(15).max(150),
  body: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  const empty = Response.json({ questions: [] }, { headers: { "Cache-Control": "no-store" } });
  const user = await getSessionProfile();
  if (!user || user.status !== "approved") return Response.json({ questions: [] }, { status: 401 });
  if (!aiConfigured()) return empty;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return empty;

  const supabase = await createClient();
  const { data: remaining } = await supabase.rpc("consume_ai_quota", {
    p_kind: "related",
    p_limit: aiConfig.dailyRelatedLimit,
  });
  if (remaining === null || remaining < 0) return empty;

  try {
    const text = [parsed.data.title, parsed.data.body?.trim().slice(0, 300)]
      .filter(Boolean)
      .join("\n");
    const questions = await relatedToDraft(text);
    return Response.json({ questions }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("related", error);
    return empty;
  }
}
