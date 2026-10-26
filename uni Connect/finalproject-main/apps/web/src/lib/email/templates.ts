/**
 * Plain, accessible email templates for the outbox. Pure functions:
 * everything from the payload is escaped, and links only ever point back into the app.
 * Email clients don't support CSS variables, so the brand colours are inlined as hex here.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

type Payload = Record<string, unknown>;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function str(payload: Payload, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

/** An absolute URL inside the app, or the app's home page for anything suspicious. */
export function appLink(appUrl: string, path: string): string {
  const base = appUrl.replace(/\/+$/, "");
  return path.startsWith("/") && !path.startsWith("//") ? `${base}${path}` : `${base}/home`;
}

/** Addresses on reserved test domains (RFC 2606/6761) are never sent to. */
export function isUndeliverableAddress(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return (
    !domain ||
    /^example\.(com|net|org)$/.test(domain) ||
    /\.(test|example|invalid|localhost)$/.test(domain) ||
    domain === "localhost"
  );
}

interface Layout {
  subject: string;
  preheader: string;
  heading: string;
  paragraphs: string[];
  quote?: string;
  cta: { label: string; url: string };
  appUrl: string;
  canUnsubscribe: boolean;
}

function layout(l: Layout): RenderedEmail {
  const settingsUrl = appLink(l.appUrl, "/settings/notifications");
  const footer = l.canUnsubscribe
    ? `You can choose which emails you get in your notification settings: ${settingsUrl}`
    : "This is an account email, so it's always sent.";

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(l.subject)}</title></head>
<body style="margin:0;background:#f4f7fd;font-family:'Plus Jakarta Sans',Segoe UI,Arial,sans-serif;color:#0b1a3a;">
<span style="display:none;max-height:0;overflow:hidden;">${escapeHtml(l.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:22px;border:1px solid #dfe7f5;">
<tr><td style="padding:28px 32px 8px;font-size:15px;font-weight:800;color:#1d5fd1;">UniConnect</td></tr>
<tr><td style="padding:8px 32px 0;">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">${escapeHtml(l.heading)}</h1>
${l.paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">${escapeHtml(p)}</p>`).join("\n")}
${l.quote ? `<blockquote style="margin:0 0 18px;padding:12px 16px;border-left:4px solid #1d5fd1;background:#f4f7fd;border-radius:8px;font-size:14.5px;line-height:1.6;white-space:pre-line;">${escapeHtml(l.quote)}</blockquote>` : ""}
<p style="margin:8px 0 28px;"><a href="${escapeHtml(l.cta.url)}" style="display:inline-block;background:#1d5fd1;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px;font-size:15px;">${escapeHtml(l.cta.label)}</a></p>
</td></tr>
<tr><td style="padding:16px 32px 26px;border-top:1px solid #dfe7f5;font-size:12.5px;line-height:1.5;color:#5b6b8c;">${escapeHtml(footer)}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    l.heading,
    "",
    ...l.paragraphs.flatMap((p) => [p, ""]),
    ...(l.quote ? [l.quote, ""] : []),
    `${l.cta.label}: ${l.cta.url}`,
    "",
    "--",
    footer,
  ].join("\n");

  return { subject: l.subject, html, text };
}

export function renderEmail(template: string, payload: Payload, appUrl: string): RenderedEmail {
  const name = str(payload, "name").split(/\s+/)[0] || "there";
  const title = str(payload, "title");
  const body = str(payload, "body");
  const link = appLink(appUrl, str(payload, "link") || "/home");

  switch (template) {
    case "account_approved":
      return layout({
        subject: "Your UniConnect account is approved",
        preheader: "You can sign in now.",
        heading: `Welcome, ${name}!`,
        paragraphs: [
          "An administrator has approved your UniConnect account. Sign in to set up your profile, join your spaces and see the latest announcements.",
        ],
        cta: { label: "Set up my profile", url: link },
        appUrl,
        canUnsubscribe: false,
      });

    case "account_rejected": {
      const reason = str(payload, "reason");
      return layout({
        subject: "About your UniConnect application",
        preheader: "Your application wasn't approved.",
        heading: `Hi ${name},`,
        paragraphs: [
          "An administrator reviewed your application and couldn't approve it this time.",
          ...(reason ? ["The reason they gave:"] : []),
        ],
        quote: reason || undefined,
        cta: { label: "See the details", url: link },
        appUrl,
        canUnsubscribe: false,
      });
    }

    case "announcement": {
      const unit = str(payload, "unit");
      const important = payload.important === true;
      return layout({
        subject: `${important ? "Important: " : ""}${title}`,
        preheader: unit ? `From ${unit}` : "A new announcement",
        heading: title,
        paragraphs: [unit ? `Official announcement from ${unit}.` : "Official announcement."],
        quote: str(payload, "excerpt") || undefined,
        cta: { label: "Read the announcement", url: link },
        appUrl,
        canUnsubscribe: true,
      });
    }

    case "content_moderated": {
      const reason = str(payload, "reason");
      const postTitle = str(payload, "post_title");
      return layout({
        subject: title || "A moderator hid your content",
        preheader: "See the reason and the community rules.",
        heading: title || "A moderator hid your content",
        paragraphs: [
          postTitle
            ? `This was in the thread “${postTitle}”. Hidden content stays visible to you and the moderators.`
            : "Hidden content stays visible to you and the moderators.",
          ...(reason ? ["The moderator's reason:"] : []),
        ],
        quote: reason || undefined,
        cta: { label: "Open the thread", url: link },
        appUrl,
        canUnsubscribe: true,
      });
    }

    case "waitlist_promoted":
    case "event_reminder_24h":
    case "event_updated":
    case "event_cancelled": {
      const when = str(payload, "when");
      const where = str(payload, "where");
      const details = [when && `When: ${when} (Sri Lanka time)`, where && `Where: ${where}`]
        .filter(Boolean)
        .join("\n");
      const intro: Record<string, string> = {
        waitlist_promoted:
          "A seat opened up, so you've moved off the waitlist and you're now registered.",
        event_reminder_24h: "A reminder that your event is coming up tomorrow.",
        event_updated: "The organizer changed some details of an event you registered for:",
        event_cancelled: "Unfortunately an event you registered for has been cancelled.",
      };
      return layout({
        subject: title,
        preheader: body.slice(0, 120),
        heading: title,
        paragraphs: [
          intro[template],
          ...(template === "event_updated" || template === "event_cancelled" ? [body] : []),
        ],
        quote: template === "event_cancelled" ? undefined : details || undefined,
        cta: { label: "View the event", url: link },
        appUrl,
        canUnsubscribe: true,
      });
    }

    case "moderation_warning": {
      const reason = str(payload, "reason");
      const about = str(payload, "post_title");
      return layout({
        subject: "A warning from the UniConnect moderators",
        preheader: "Please read the moderator's note.",
        heading: `Hi ${name},`,
        paragraphs: [
          about
            ? `A moderator reviewed a report about “${about}” and sent you this warning.`
            : "A moderator reviewed a report about your activity and sent you this warning.",
          "Please read the community rules. Repeated problems can lead to your account being suspended.",
        ],
        quote: reason || undefined,
        cta: { label: "Open UniConnect", url: link },
        appUrl,
        canUnsubscribe: false,
      });
    }

    case "mentorship_request":
      return layout({
        subject: title,
        preheader: body ? `About: ${body}` : "A student would like your guidance.",
        heading: title,
        paragraphs: [
          "A student asked you to be their mentor. Read their message and accept or decline it on UniConnect. Your phone number and email are never shared.",
          ...(body ? ["What they'd like help with:"] : []),
        ],
        quote: body || undefined,
        cta: { label: "Answer the request", url: link },
        appUrl,
        canUnsubscribe: true,
      });

    case "mentorship_accepted":
      return layout({
        subject: title,
        preheader: "Your private conversation is open.",
        heading: title,
        paragraphs: [
          "Your private conversation is open. Say hello and tell them how they can help. Messages stay between the two of you.",
        ],
        quote: body || undefined,
        cta: { label: "Open the conversation", url: link },
        appUrl,
        canUnsubscribe: true,
      });

    default:
      return layout({
        subject: title || "New activity on UniConnect",
        preheader: body.slice(0, 120),
        heading: title || "New activity on UniConnect",
        paragraphs: body ? [body] : [],
        cta: { label: "Open UniConnect", url: link },
        appUrl,
        canUnsubscribe: true,
      });
  }
}
