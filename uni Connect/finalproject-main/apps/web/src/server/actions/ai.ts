"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { aiConfig, aiConfigured } from "@/lib/ai/config";
import {
  buildFormPrompt,
  buildThreadPrompt,
  cleanThreadSummary,
  FORM_SUMMARY_INSTRUCTIONS,
  formSummarySchema,
  SUMMARY_INSTRUCTIONS,
  threadSummarySchema,
  type FormSummary,
  type ThreadReply,
  type ThreadSummary,
} from "@/lib/ai/prompts";
import { requireApproved, requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateStructured } from "@/server/ai/provider";

/**
 * AI summaries: a discussion thread for any member who can read it, and the
 * written answers of a feedback form for the people who can see its results. Content is read as
 * the member (RLS); the finished summary is cached with the service role and reused until the
 * thread or the answers change, so most views cost nothing.
 */

const id = z.uuid();
const BUSY = "The AI service is busy right now. Please try again in a minute.";

async function takeSummaryQuota(): Promise<string | null> {
  const supabase = await createClient();
  const { data: remaining, error } = await supabase.rpc("consume_ai_quota", {
    p_kind: "summary",
    p_limit: aiConfig.dailySummaryLimit,
  });
  if (error) return "Something went wrong. Please try again.";
  return remaining < 0
    ? `You've used today's ${aiConfig.dailySummaryLimit} summaries. They reset at midnight.`
    : null;
}

export interface StoredThreadSummary {
  summary: ThreadSummary;
  replyCount: number;
  generatedAt: string;
}

export async function summarizeThread(postId: string): Promise<ActionResult<StoredThreadSummary>> {
  await requireApproved();
  if (!id.safeParse(postId).success) return fail("That post doesn't exist.");
  if (!aiConfigured()) return fail("AI summaries aren't set up on this site yet.");

  const supabase = await createClient();
  const [{ data: post }, { data: replies }] = await Promise.all([
    supabase
      .from("posts")
      .select("id, title, body_text, accepted_reply_id")
      .eq("id", postId)
      .eq("status", "visible")
      .maybeSingle(),
    supabase
      .from("replies")
      .select("id, body_text, helpful_count, created_at")
      .eq("post_id", postId)
      .eq("status", "visible")
      .order("created_at"),
  ]);
  if (!post) return fail("That post doesn't exist.");
  const all = replies ?? [];
  if (all.length < aiConfig.minRepliesForSummary) {
    return fail(
      `Summaries are for threads with at least ${aiConfig.minRepliesForSummary} replies.`,
    );
  }

  const { data: cached } = await supabase
    .from("ai_summaries")
    .select("summary, reply_count_at_generation, generated_at")
    .eq("post_id", postId)
    .maybeSingle();
  if (cached && cached.reply_count_at_generation === all.length) {
    return ok({
      summary: cached.summary as ThreadSummary,
      replyCount: cached.reply_count_at_generation,
      generatedAt: cached.generated_at,
    });
  }

  const quotaProblem = await takeSummaryQuota();
  if (quotaProblem) return fail(quotaProblem);

  // Long threads: keep the accepted answer, the most helpful and the most recent replies.
  const BUDGET = 40_000;
  const ranked = [...all].sort(
    (a, b) =>
      Number(b.id === post.accepted_reply_id) - Number(a.id === post.accepted_reply_id) ||
      b.helpful_count - a.helpful_count ||
      b.created_at.localeCompare(a.created_at),
  );
  const kept = new Set<string>();
  let used = 0;
  for (const r of ranked) {
    const size = Math.min(r.body_text.length, 1500);
    if (used + size > BUDGET) break;
    kept.add(r.id);
    used += size;
  }
  const refs = new Map<string, string>();
  const input: ThreadReply[] = all
    .filter((r) => kept.has(r.id))
    .map((r, i) => {
      const ref = `r${i + 1}`;
      refs.set(ref, r.id);
      return {
        ref,
        text: r.body_text.slice(0, 1500),
        helpful: r.helpful_count,
        accepted: r.id === post.accepted_reply_id,
      };
    });

  let generated;
  try {
    generated = await generateStructured({
      schema: threadSummarySchema,
      instructions: SUMMARY_INSTRUCTIONS,
      prompt: buildThreadPrompt({ title: post.title, text: post.body_text.slice(0, 4000) }, input),
    });
  } catch (error) {
    console.error("summarizeThread", error);
    return fail(BUSY);
  }
  const cleaned = cleanThreadSummary(generated.output, new Set(refs.keys()));
  const toIds = (items: ThreadSummary["main_advice"]) =>
    items.map((i) => ({ text: i.text, reply_ids: i.reply_ids.map((ref) => refs.get(ref)!) }));
  const summary: ThreadSummary = {
    main_advice: toIds(cleaned.main_advice),
    differing_views: toIds(cleaned.differing_views),
    open_questions: toIds(cleaned.open_questions),
  };

  const generatedAt = new Date().toISOString();
  // Trusted server step: members can't write summaries themselves.
  const { error } = await createAdminClient().from("ai_summaries").upsert({
    post_id: postId,
    summary,
    reply_count_at_generation: all.length,
    model: generated.model,
    generated_at: generatedAt,
  });
  if (error) console.error("summarizeThread save", error);
  revalidatePath(`/posts/${postId}`);
  return ok({ summary, replyCount: all.length, generatedAt });
}

export interface StoredFormSummary {
  summary: FormSummary;
  answerCount: number;
  generatedAt: string;
}

export async function summarizeForm(formId: string): Promise<ActionResult<StoredFormSummary>> {
  await requireRole("lecturer");
  if (!id.safeParse(formId).success) return fail("That form doesn't exist.");
  if (!aiConfigured()) return fail("AI summaries aren't set up on this site yet.");

  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("can_see_form_results", { p_form_id: formId });
  if (allowed !== true)
    return fail("Only people who can see this form's results can summarise it.");

  const [{ data: form }, { data: questions }, { data: answers }] = await Promise.all([
    supabase.from("forms").select("title").eq("id", formId).maybeSingle(),
    supabase
      .from("form_questions")
      .select("id, prompt, type, position")
      .eq("form_id", formId)
      .in("type", ["short", "paragraph"])
      .order("position"),
    supabase
      .from("form_answers")
      .select("question_id, value_text")
      .eq("form_id", formId)
      .not("value_text", "is", null)
      .limit(5000),
  ]);
  if (!form) return fail("That form doesn't exist.");
  const written = (questions ?? [])
    .map((q) => ({
      prompt: q.prompt,
      answers: (answers ?? [])
        .filter((a) => a.question_id === q.id && a.value_text?.trim())
        .map((a) => a.value_text!.trim().slice(0, 1000)),
    }))
    .filter((q) => q.answers.length > 0);
  const answerCount = written.reduce((n, q) => n + q.answers.length, 0);
  if (answerCount < aiConfig.minAnswersForFormSummary) {
    return fail(
      `Summaries need at least ${aiConfig.minAnswersForFormSummary} written answers, so no single student stands out.`,
    );
  }

  const { data: cached } = await supabase
    .from("ai_form_summaries")
    .select("summary, answer_count, generated_at")
    .eq("form_id", formId)
    .maybeSingle();
  if (cached && cached.answer_count === answerCount) {
    return ok({
      summary: cached.summary as FormSummary,
      answerCount: cached.answer_count,
      generatedAt: cached.generated_at,
    });
  }

  const quotaProblem = await takeSummaryQuota();
  if (quotaProblem) return fail(quotaProblem);

  // Keep the prompt bounded: the first ~200 answers per question are plenty for themes.
  let generated;
  try {
    generated = await generateStructured({
      schema: formSummarySchema,
      instructions: FORM_SUMMARY_INSTRUCTIONS,
      prompt: buildFormPrompt(
        form.title,
        written.map((q) => ({ prompt: q.prompt, answers: q.answers.slice(0, 200) })),
      ),
    });
  } catch (error) {
    console.error("summarizeForm", error);
    return fail(BUSY);
  }
  const trim = (items: string[]) => items.map((i) => i.trim()).filter(Boolean);
  const summary: FormSummary = {
    themes: trim(generated.output.themes),
    positives: trim(generated.output.positives),
    concerns: trim(generated.output.concerns),
    suggestions: trim(generated.output.suggestions),
  };

  const generatedAt = new Date().toISOString();
  const { error } = await createAdminClient().from("ai_form_summaries").upsert({
    form_id: formId,
    summary,
    answer_count: answerCount,
    model: generated.model,
    generated_at: generatedAt,
  });
  if (error) console.error("summarizeForm save", error);
  revalidatePath(`/forms/${formId}/results`);
  return ok({ summary, answerCount, generatedAt });
}
