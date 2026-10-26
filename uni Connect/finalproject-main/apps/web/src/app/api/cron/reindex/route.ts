import { timingSafeEqual } from "node:crypto";

import { processIndexQueue } from "@/server/ai/indexer";

/**
 * Indexes queued content for Ask AI. Called every 5 minutes by pg_cron (migration 0045) with
 * `Authorization: Bearer <CRON_SECRET>`; anything else gets a 401. The queue is also worked through
 * when someone asks a question, so the site works without the scheduled job.
 */
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return false;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  // A few batches per call: each is one embedding request.
  const totals = { configured: true, claimed: 0, embedded: 0, removed: 0, failed: false };
  for (let i = 0; i < 4; i++) {
    const run = await processIndexQueue(50);
    totals.configured = run.configured;
    totals.claimed += run.claimed;
    totals.embedded += run.embedded;
    totals.removed += run.removed;
    totals.failed ||= run.failed;
    if (!run.configured || run.failed || run.claimed === 0) break;
  }
  return Response.json(totals, { status: totals.configured ? 200 : 503 });
}
