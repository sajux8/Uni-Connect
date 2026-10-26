import "server-only";

import type { FormSummary, ThreadSummary } from "@/lib/ai/prompts";
import { createClient } from "@/lib/supabase/server";
import type { StoredFormSummary, StoredThreadSummary } from "@/server/actions/ai";

/** Cached AI summaries, read as the member (RLS: only for content they can already see). */

export async function getThreadSummary(postId: string): Promise<StoredThreadSummary | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_summaries")
    .select("summary, reply_count_at_generation, generated_at")
    .eq("post_id", postId)
    .maybeSingle();
  return data
    ? {
        summary: data.summary as ThreadSummary,
        replyCount: data.reply_count_at_generation,
        generatedAt: data.generated_at,
      }
    : null;
}

export async function getFormSummary(formId: string): Promise<StoredFormSummary | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_form_summaries")
    .select("summary, answer_count, generated_at")
    .eq("form_id", formId)
    .maybeSingle();
  return data
    ? {
        summary: data.summary as FormSummary,
        answerCount: data.answer_count,
        generatedAt: data.generated_at,
      }
    : null;
}
