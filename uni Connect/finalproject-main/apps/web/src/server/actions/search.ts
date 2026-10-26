"use server";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireApproved } from "@/lib/auth/session";
import { normaliseQuery } from "@/lib/search";
import { search, type SearchHit } from "@/server/queries/search";

/** Top results for the ⌘K palette while typing. */
export async function quickSearch(raw: string): Promise<ActionResult<SearchHit[]>> {
  await requireApproved();
  const q = normaliseQuery(raw);
  if (q.length < 2) return ok([]);
  try {
    const { hits } = await search({ q, limit: 6 });
    return ok(hits);
  } catch {
    return fail("Search isn't working right now.");
  }
}
