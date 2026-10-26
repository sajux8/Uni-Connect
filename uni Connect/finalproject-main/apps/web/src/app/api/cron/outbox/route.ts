import { timingSafeEqual } from "node:crypto";

import { processOutbox } from "@/server/email/outbox";

/**
 * Sends queued email. Called every 5 minutes by pg_cron (migration 0012) with
 * `Authorization: Bearer <CRON_SECRET>`; anything else gets a 401.
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
  const run = await processOutbox(50);
  return Response.json(run, { status: run.configured ? 200 : 503 });
}
