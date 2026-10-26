import "server-only";

import { unstable_cache } from "next/cache";

import { aiConfig, SOURCE_LABELS, type AiSource, type SourceType } from "@/lib/ai/config";
import { capPerKey, rrfMerge } from "@/lib/ai/retrieval";
import { createClient } from "@/lib/supabase/server";
import { embedTexts, toVector } from "@/server/ai/provider";
import { search } from "@/server/queries/search";

/**
 * Finds the sources for a question. Everything runs as the signed-in
 * member, so row-level security removes anything they can't read before the model sees it.
 */

interface Chunk {
  source_type: string;
  source_id: string;
  parent_id: string | null;
  chunk_index: number;
  title: string;
  content: string;
  source_date: string | null;
  similarity?: number;
}

const KEYWORD_KINDS = ["discussion", "question", "event", "announcement", "resource"] as const;

function urlFor(c: Chunk): string {
  switch (c.source_type as SourceType) {
    case "post":
      return `/posts/${c.source_id}`;
    case "reply":
      return `/posts/${c.parent_id}#reply-${c.source_id}`;
    case "announcement":
      return `/announcements/${c.source_id}`;
    case "event":
      return `/events/${c.source_id}`;
    case "resource":
      return `/resources/${c.source_id}`;
  }
}

/** "[Question] Title · Space…" → "Question" (the chunk's own header says what it is). */
function labelOf(c: Chunk): string {
  return (
    /^\[([^\]]+)\]/.exec(c.content)?.[1] ?? SOURCE_LABELS[c.source_type as SourceType] ?? "Source"
  );
}

function toSources(chunks: Chunk[]): AiSource[] {
  return chunks.map((c, i) => ({
    n: i + 1,
    type: c.source_type as SourceType,
    id: c.source_id,
    title: c.title,
    url: urlFor(c),
    label: labelOf(c),
    date: c.source_date,
    content: c.content,
  }));
}

export interface Retrieval {
  /** False when nothing on the platform looks relevant: the model isn't asked. */
  found: boolean;
  sources: AiSource[];
  bestSimilarity: number;
}

/**
 * `embedding` can be started by the caller so it runs alongside other work (the question's vector
 * doesn't depend on anything else).
 */
export async function retrieve(
  question: string,
  embedding: Promise<number[][]> = embedTexts([question], "query"),
): Promise<Retrieval> {
  const supabase = await createClient();
  const t0 = Date.now();
  const [vectorOfQuestion] = await embedding;
  const t1 = Date.now();
  const [{ data: vectorRows, error }, keyword] = await Promise.all([
    supabase.rpc("match_chunks", { p_embedding: toVector(vectorOfQuestion), p_count: 20 }),
    search({ q: question, kinds: KEYWORD_KINDS, limit: 20 }).catch(() => ({
      hits: [],
      hasMore: false,
      broadened: false,
    })),
  ]);
  if (error) console.error("retrieve match_chunks", error);
  const all = (vectorRows ?? []) as Chunk[];
  const bestSimilarity = all[0]?.similarity ?? 0;
  // Only chunks close to the best one count; the rest are noise at this point.
  const floor = Math.max(aiConfig.minSimilarity, bestSimilarity - aiConfig.similarityWindow);
  const close = all.filter((c) => (c.similarity ?? 0) >= floor);
  // A keyword match on every word of the question is evidence too; an any-word match isn't.
  const keywordMatch = keyword.hits.length > 0 && !keyword.broadened;
  const vector = close.length > 0 ? close : keywordMatch ? [] : all.slice(0, 3);
  const keyOf = (c: { source_type: string; source_id: string }) =>
    `${c.source_type}:${c.source_id}`;
  const keywordKeys = (keywordMatch ? keyword.hits : []).map(
    (h) => `${h.kind === "discussion" || h.kind === "question" ? "post" : h.kind}:${h.id}`,
  );

  // Rank sources by both searches, then take their best chunks (at most 2 per source).
  const ranked = rrfMerge([vector.map(keyOf), keywordKeys]).map((r) => r.key);
  const byKey = new Map<string, Chunk[]>();
  for (const c of vector) byKey.set(keyOf(c), [...(byKey.get(keyOf(c)) ?? []), c]);

  // Sources only the keyword search found: load their first chunk.
  const missing = ranked.filter((k) => !byKey.has(k)).slice(0, aiConfig.maxSources);
  if (missing.length > 0) {
    const { data: extra } = await supabase
      .from("content_chunks")
      .select("source_type, source_id, parent_id, chunk_index, title, content, source_date")
      .eq("chunk_index", 0)
      .in(
        "source_id",
        missing.map((k) => k.split(":")[1]),
      );
    for (const c of (extra ?? []) as Chunk[]) {
      if (missing.includes(keyOf(c))) byKey.set(keyOf(c), [c]);
    }
  }

  const chunks = capPerKey(
    ranked.flatMap((k) => byKey.get(k) ?? []),
    keyOf,
    2,
  ).slice(0, aiConfig.maxSources);
  const found = chunks.length > 0 && (close.length > 0 || keywordMatch);
  if (process.env.AI_DEBUG) {
    // For tuning: timings and how close the best chunks were.
    console.log(
      `[ai] "${question.slice(0, 60)}" embed ${t1 - t0} ms, search ${Date.now() - t1} ms, keyword ${keyword.hits.length}${keyword.broadened ? " (any word)" : ""}, found ${found}; similarity ${all
        .slice(0, 6)
        .map((c) => (c.similarity ?? 0).toFixed(3))
        .join(" ")}`,
    );
  }

  return { found, sources: toSources(found ? chunks : chunks.slice(0, 3)), bestSimilarity };
}

export interface RelatedQuestion {
  id: string;
  title: string;
  spaceName: string | null;
  replyCount: number;
  answered: boolean;
}

async function loadQuestions(
  ranked: { post_id: string; similarity: number }[],
): Promise<RelatedQuestion[]> {
  const ids = ranked
    .filter((r) => r.similarity >= aiConfig.relatedSimilarity)
    .map((r) => r.post_id);
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select("id, title, reply_count, accepted_reply_id, spaces!posts_space_id_fkey(name)")
    .in("id", ids)
    .eq("status", "visible");
  const byId = new Map((data ?? []).map((p) => [p.id, p]));
  return ids.flatMap((id) => {
    const p = byId.get(id);
    return p
      ? [
          {
            id: p.id,
            title: p.title,
            spaceName: p.spaces?.name ?? null,
            replyCount: p.reply_count,
            answered: !!p.accepted_reply_id,
          },
        ]
      : [];
  });
}

/** Questions like a draft title (and the start of its body). */
export async function relatedToDraft(text: string): Promise<RelatedQuestion[]> {
  const supabase = await createClient();
  const [embedding] = await embedTexts([text], "query");
  const { data, error } = await supabase.rpc("related_questions", {
    p_embedding: toVector(embedding),
    p_count: 5,
  });
  if (error) console.error("relatedToDraft", error);
  return loadQuestions(data ?? []);
}

/** A title's question-style vector, cached for a day (it doesn't depend on who is asking). */
const titleVector = unstable_cache(
  async (title: string) => toVector((await embedTexts([title], "query"))[0]),
  ["ai-title-vector"],
  { revalidate: 86_400 },
);

/**
 * Questions like an existing post. The post's title is embedded as a question (stored chunks are
 * all "documents" and look alike to each other), then matched as the member, so RLS applies.
 */
export async function relatedToPost(postId: string, title: string): Promise<RelatedQuestion[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("related_questions", {
      p_embedding: await titleVector(title),
      p_exclude: postId,
      p_count: 5,
    });
    if (error) console.error("relatedToPost", error);
    return await loadQuestions(data ?? []);
  } catch (error) {
    // Related questions are a nicety: the page must load even when the AI service is down.
    console.error("relatedToPost", error);
    return [];
  }
}
