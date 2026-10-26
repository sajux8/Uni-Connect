import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

import { isUndeliverableAddress, renderEmail } from "@/lib/email/templates";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Sends queued email from `email_outbox` over SMTP. Called by
 * /api/cron/outbox (every 5 minutes from pg_cron) and straight after actions that queue
 * mail, via `after()`. Without SMTP settings it does nothing and the mail stays queued.
 */

const MAX_ATTEMPTS = 3;

let transporter: Transporter | null = null;

export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter(): Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

/** EMAIL_FROM if it's been set to a real sender, otherwise the SMTP account itself. */
function fromAddress(): string {
  const configured = process.env.EMAIL_FROM?.trim();
  if (configured && !configured.includes("example.com")) return configured;
  return `"UniConnect" <${process.env.SMTP_USER}>`;
}

export function appUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3100";
}

export interface OutboxRun {
  configured: boolean;
  claimed: number;
  sent: number;
  skipped: number;
  failed: number;
}

export async function processOutbox(limit = 25): Promise<OutboxRun> {
  const run: OutboxRun = {
    configured: smtpConfigured(),
    claimed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  };
  if (!run.configured) return run;

  const admin = createAdminClient();
  const { data: batch, error } = await admin.rpc("claim_email_batch", { p_limit: limit });
  if (error) {
    console.error("processOutbox claim", error);
    return run;
  }
  run.claimed = batch.length;

  const base = appUrl();
  for (const email of batch) {
    if (isUndeliverableAddress(email.to_email)) {
      await admin
        .from("email_outbox")
        .update({ status: "failed", last_error: "Reserved test address; not sent." })
        .eq("id", email.id);
      run.skipped++;
      continue;
    }

    try {
      const message = renderEmail(
        email.template,
        (email.payload ?? {}) as Record<string, unknown>,
        base,
      );
      await getTransporter().sendMail({
        from: fromAddress(),
        to: email.to_email,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      await admin
        .from("email_outbox")
        .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
        .eq("id", email.id);
      run.sent++;
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : String(sendError);
      console.error("processOutbox send", email.id, message);
      await admin
        .from("email_outbox")
        .update({
          status: email.attempts >= MAX_ATTEMPTS ? "failed" : "queued",
          last_error: message.slice(0, 1000),
        })
        .eq("id", email.id);
      run.failed++;
    }
  }
  return run;
}

/** For `after()` in actions: send what was just queued, never throwing into the request. */
export async function flushOutboxSoon(): Promise<void> {
  try {
    await processOutbox(25);
  } catch (error) {
    console.error("flushOutboxSoon", error);
  }
}
