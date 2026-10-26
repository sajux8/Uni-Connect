import "server-only";

import { anyWordQuery, type SearchKind } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  snippet: string;
  url: string;
  context: string | null;
  createdAt: string | null;
}

/**
 * Runs search_all (RLS applies: only what the caller may read). If nothing matches every
 * word, tries again matching any word, and says so (`broadened`).
 */
export async function search(options: {
  q: string;
  kinds?: readonly string[] | null;
  /** Only results from the last n days. */
  sinceDays?: number | null;
  sort?: "relevance" | "date";
  limit?: number;
  offset?: number;
}): Promise<{ hits: SearchHit[]; hasMore: boolean; broadened: boolean }> {
  const supabase = await createClient();
  const limit = options.limit ?? 20;

  async function run(query: string) {
    const { data, error } = await supabase.rpc("search_all", {
      p_query: query,
      p_types: options.kinds ? [...options.kinds] : undefined,
      p_since: options.sinceDays
        ? new Date(Date.now() - options.sinceDays * 86_400_000).toISOString()
        : undefined,
      p_sort: options.sort ?? "relevance",
      p_limit: limit + 1,
      p_offset: options.offset ?? 0,
    });
    if (error) {
      console.error("search", error);
      throw new Error("Search isn't working right now. Please try again.");
    }
    return data;
  }

  let rows = await run(options.q);
  let broadened = false;
  if (rows.length === 0 && !options.offset) {
    const loose = anyWordQuery(options.q);
    if (loose) {
      rows = await run(loose);
      broadened = rows.length > 0;
    }
  }
  return {
    hits: rows.slice(0, limit).map((r) => ({
      kind: r.kind as SearchKind,
      id: r.id,
      title: r.title,
      snippet: r.snippet ?? "",
      url: r.url,
      context: r.context,
      createdAt: r.created_at,
    })),
    hasMore: rows.length > limit,
    broadened,
  };
}
