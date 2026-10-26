import "server-only";

import { buildChunks, hashText, sourceHeader } from "@/lib/ai/chunk";
import { aiConfigured, type SourceType } from "@/lib/ai/config";
import { formatCampus } from "@/lib/campus-time";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedTexts, toVector } from "@/server/ai/provider";

/**
 * Keeps the Ask AI index in step with the platform. Triggers queue changed
 * posts, replies, announcements, events and resources (migration 0045); this module reads each one
 * with the service role, splits it into chunks and embeds the chunks whose text changed.
 *
 * Only content that is visible on the platform is indexed. Private messages, profiles, tickets and
 * feedback answers never are; who may read a chunk is decided later by RLS on its source.
 */

type Admin = ReturnType<typeof createAdminClient>;

interface Prepared {
  parentId: string | null;
  title: string;
  date: string | null;
  /** Texts to embed, header included. Empty = the source isn't indexable: remove its chunks. */
  chunks: string[];
}

const NOT_INDEXABLE: Prepared = { parentId: null, title: "", date: null, chunks: [] };

async function prepare(admin: Admin, type: SourceType, id: string): Promise<Prepared> {
  switch (type) {
    case "post": {
      const { data: p } = await admin
        .from("posts")
        .select(
          "title, body_text, type, status, created_at, accepted_reply_id, spaces!posts_space_id_fkey(name), post_tags(tags(name))",
        )
        .eq("id", id)
        .maybeSingle();
      if (!p || p.status !== "visible") return NOT_INDEXABLE;
      const { data: accepted } = p.accepted_reply_id
        ? await admin
            .from("replies")
            .select("body_text, status")
            .eq("id", p.accepted_reply_id)
            .maybeSingle()
        : { data: null };
      const tags = p.post_tags.map((t) => t.tags?.name).filter(Boolean);
      const header = sourceHeader({
        label: p.type === "question" ? "Question" : "Discussion",
        title: p.title,
        context: p.spaces ? `Space: ${p.spaces.name}` : null,
        date: p.created_at,
      });
      const body = [
        p.body_text,
        tags.length ? `Tags: ${tags.join(", ")}` : null,
        accepted?.status === "visible" ? `Accepted answer: ${accepted.body_text}` : null,
      ]
        .filter(Boolean)
        .join("\n\n");
      return {
        parentId: null,
        title: p.title,
        date: p.created_at,
        chunks: buildChunks(header, body),
      };
    }
    case "reply": {
      const { data: r } = await admin
        .from("replies")
        .select(
          "body_text, status, post_id, created_at, posts!replies_post_id_fkey(title, status, accepted_reply_id, spaces!posts_space_id_fkey(name))",
        )
        .eq("id", id)
        .maybeSingle();
      if (!r || r.status !== "visible" || r.posts?.status !== "visible") return NOT_INDEXABLE;
      const header = sourceHeader({
        label: r.posts.accepted_reply_id === id ? "Accepted answer" : "Reply",
        title: r.posts.title,
        context: r.posts.spaces ? `Space: ${r.posts.spaces.name}` : null,
        date: r.created_at,
      });
      return {
        parentId: r.post_id,
        title: r.posts.title,
        date: r.created_at,
        chunks: buildChunks(header, r.body_text),
      };
    }
    case "announcement": {
      const { data: a } = await admin
        .from("announcements")
        .select("title, body_text, publishing_unit, status, publish_at, published_at")
        .eq("id", id)
        .maybeSingle();
      if (!a || a.status !== "published") return NOT_INDEXABLE;
      const date = a.published_at ?? a.publish_at;
      const header = sourceHeader({
        label: "Announcement",
        title: a.title,
        context: `Official · ${a.publishing_unit}`,
        date,
      });
      return { parentId: null, title: a.title, date, chunks: buildChunks(header, a.body_text) };
    }
    case "event": {
      const { data: e } = await admin
        .from("events")
        .select(
          "title, description_text, status, starts_at, ends_at, venue, format, registration_deadline, eligibility_note, organizing_unit, cancel_reason",
        )
        .eq("id", id)
        .maybeSingle();
      if (!e || (e.status !== "published" && e.status !== "cancelled")) return NOT_INDEXABLE;
      const header = sourceHeader({
        label: "Event",
        title: e.title,
        context: `Organised by ${e.organizing_unit}`,
        date: e.starts_at,
      });
      const body = [
        e.status === "cancelled"
          ? `CANCELLED: ${e.cancel_reason ?? "this event is not happening"}`
          : null,
        `When: ${formatCampus(e.starts_at, "dayTime")} to ${formatCampus(e.ends_at, "dayTime")} (Sri Lanka time)`,
        `Where: ${e.format === "online" ? "Online" : (e.venue ?? "To be announced")}`,
        e.registration_deadline
          ? `Registration closes: ${formatCampus(e.registration_deadline, "dayTime")}`
          : null,
        e.eligibility_note ? `Who can come: ${e.eligibility_note}` : null,
        e.description_text,
      ]
        .filter(Boolean)
        .join("\n\n");
      return {
        parentId: null,
        title: e.title,
        date: e.starts_at,
        chunks: buildChunks(header, body),
      };
    }
    case "resource": {
      const { data: r } = await admin
        .from("resources")
        .select("title, description, module_code, kind, status, created_at")
        .eq("id", id)
        .maybeSingle();
      if (!r || r.status !== "approved") return NOT_INDEXABLE;
      const header = sourceHeader({
        label: "Resource",
        title: r.title,
        context: r.module_code ? `Module: ${r.module_code}` : null,
        date: r.created_at,
      });
      const body = [
        r.description,
        r.kind === "link" ? "A link shared in the resource library." : null,
      ]
        .filter(Boolean)
        .join("\n\n");
      return {
        parentId: null,
        title: r.title,
        date: r.created_at,
        chunks: buildChunks(header, body),
      };
    }
  }
}

export interface IndexRun {
  configured: boolean;
  claimed: number;
  embedded: number;
  removed: number;
  failed: boolean;
}

/**
 * Indexes up to `limit` queued sources: one embedding request for all their changed chunks.
 * If anything fails the sources go back on the queue. `newestFirst` is for Ask AI: whoever just
 * posted and then asks should find their own post, even behind a backlog.
 */
export async function processIndexQueue(limit = 40, newestFirst = false): Promise<IndexRun> {
  const run: IndexRun = {
    configured: aiConfigured(),
    claimed: 0,
    embedded: 0,
    removed: 0,
    failed: false,
  };
  if (!run.configured) return run;
  const admin = createAdminClient();
  const { data: claimed, error } = await admin.rpc("claim_ai_index_batch", {
    p_limit: limit,
    p_newest_first: newestFirst,
  });
  if (error) {
    console.error("processIndexQueue claim", error);
    run.failed = true;
    return run;
  }
  const sources = (claimed ?? []) as { source_type: SourceType; source_id: string }[];
  run.claimed = sources.length;
  if (sources.length === 0) return run;

  try {
    // What each source should look like, and which chunks are new or changed.
    const pending: {
      source_type: SourceType;
      source_id: string;
      parent_id: string | null;
      chunk_index: number;
      title: string;
      content: string;
      content_hash: string;
      source_date: string | null;
    }[] = [];
    for (const s of sources) {
      const prepared = await prepare(admin, s.source_type, s.source_id);
      const { data: existing } = await admin
        .from("content_chunks")
        .select("chunk_index, content_hash")
        .eq("source_type", s.source_type)
        .eq("source_id", s.source_id);
      const known = new Map((existing ?? []).map((c) => [c.chunk_index, c.content_hash]));
      prepared.chunks.forEach((content, index) => {
        const hash = hashText(content);
        if (known.get(index) === hash) return;
        pending.push({
          source_type: s.source_type,
          source_id: s.source_id,
          parent_id: prepared.parentId,
          chunk_index: index,
          title: prepared.title.slice(0, 300),
          content,
          content_hash: hash,
          source_date: prepared.date,
        });
      });
      // Chunks past the new length (or all of them, when the source is no longer indexable).
      if ((existing ?? []).some((c) => c.chunk_index >= prepared.chunks.length)) {
        const { count } = await admin
          .from("content_chunks")
          .delete({ count: "exact" })
          .eq("source_type", s.source_type)
          .eq("source_id", s.source_id)
          .gte("chunk_index", prepared.chunks.length);
        run.removed += count ?? 0;
      }
    }

    for (let i = 0; i < pending.length; i += 100) {
      const batch = pending.slice(i, i + 100);
      const embeddings = await embedTexts(
        batch.map((c) => c.content),
        "document",
      );
      const { error: upsertError } = await admin.from("content_chunks").upsert(
        batch.map((c, j) => ({
          ...c,
          embedding: toVector(embeddings[j]),
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "source_type,source_id,chunk_index" },
      );
      if (upsertError) throw upsertError;
      run.embedded += batch.length;
    }
  } catch (caught) {
    console.error("processIndexQueue", caught);
    run.failed = true;
    // Try these again on the next run.
    await admin
      .from("ai_index_queue")
      .upsert(sources, { onConflict: "source_type,source_id", ignoreDuplicates: true });
  }
  return run;
}

/** True when something is waiting to be indexed. */
export async function indexQueueWaiting(): Promise<boolean> {
  const { count } = await createAdminClient()
    .from("ai_index_queue")
    .select("source_id", { count: "exact", head: true });
  return (count ?? 0) > 0;
}
