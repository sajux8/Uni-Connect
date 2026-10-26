import * as z from "zod";

import { aiConfig, aiConfigured } from "@/lib/ai/config";
import { ASK_INSTRUCTIONS, buildAskPrompt, NOT_FOUND_TEXT } from "@/lib/ai/prompts";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { processIndexQueue } from "@/server/ai/indexer";
import { embedTexts, streamAnswer } from "@/server/ai/provider";
import { retrieve } from "@/server/ai/retrieve";

/**
 * Ask AI. Answers only from content the asking member can read, with
 * numbered sources. The response is plain text: the first line is JSON (sources, how many
 * questions are left today, whether anything was found), the rest is the answer as it streams.
 * Nothing about the question or the answer is stored; only today's count.
 */
export const maxDuration = 60;

const bodySchema = z.object({
  question: z.string().trim().min(3).max(500),
  previous: z.object({ question: z.string().max(500), answer: z.string().max(4000) }).optional(),
});

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await getSessionProfile();
  if (!user || user.status !== "approved") return json({ error: "Sign in to ask." }, 401);
  if (!aiConfigured()) return json({ error: "Ask AI isn't set up on this site yet." }, 503);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Ask a question of 3 to 500 characters." }, 400);
  const { question, previous } = parsed.data;

  const supabase = await createClient();
  const { data: remaining, error: quotaError } = await supabase.rpc("consume_ai_quota", {
    p_kind: "ask",
    p_limit: aiConfig.dailyAskLimit,
  });
  if (quotaError) {
    console.error("ask quota", quotaError);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
  if (remaining < 0) {
    return json(
      {
        error: `You've used today's ${aiConfig.dailyAskLimit} questions. They reset at midnight (Sri Lanka time).`,
        remaining: 0,
      },
      429,
    );
  }

  let retrieval;
  try {
    // New posts become searchable here even without the scheduled job; the question is embedded
    // at the same time.
    const embedding = embedTexts([question], "query");
    embedding.catch(() => {});
    await processIndexQueue(30, true).catch((error) => console.error("ask index", error));
    retrieval = await retrieve(question, embedding);
  } catch (error) {
    console.error("ask retrieve", error);
    return json({ error: "The AI service is busy right now. Please try again in a minute." }, 502);
  }

  const meta = {
    found: retrieval.found,
    remaining,
    limit: aiConfig.dailyAskLimit,
    // The text of each source stays on the server; the page only needs what to show and link.
    sources: retrieval.sources.map((s) => ({
      n: s.n,
      type: s.type,
      id: s.id,
      title: s.title,
      url: s.url,
      label: s.label,
      date: s.date,
    })),
  };
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(`${JSON.stringify(meta)}\n`));
      if (!retrieval.found) {
        controller.enqueue(
          encoder.encode(
            `${NOT_FOUND_TEXT} Nothing I can see answers this. You could ask the community: someone may know.`,
          ),
        );
        controller.close();
        return;
      }
      let said = false;
      const answer = streamAnswer({
        instructions: ASK_INSTRUCTIONS,
        prompt: buildAskPrompt(retrieval.sources, question, previous),
        onFailure: (error) => console.error("ask generate", error),
      });
      for await (const part of answer) {
        said = true;
        controller.enqueue(encoder.encode(part));
      }
      if (!said) {
        controller.enqueue(
          encoder.encode(
            "The AI service is busy right now. The sources below may still help; please try again in a minute.",
          ),
        );
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
