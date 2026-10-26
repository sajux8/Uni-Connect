import sanitizeHtml from "sanitize-html";

/**
 * Rich text from the editor is untrusted HTML. Everything that's stored goes through
 * here first. Only the formatting the editor offers survives;
 * links open in a new tab without passing the referrer or ranking credit.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "s",
    "code",
    "pre",
    "blockquote",
    "ul",
    "ol",
    "li",
    "h2",
    "h3",
    "a",
    "hr",
  ],
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      target: "_blank",
      rel: "noopener noreferrer nofollow ugc",
    }),
    h1: "h2",
    b: "strong",
    i: "em",
    strike: "s",
  },
  exclusiveFilter: (frame) => frame.tag === "a" && !frame.attribs.href,
};

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'",
  "&nbsp;": " ",
};

/** Clean HTML for storage plus a plain-text copy for search, excerpts and (later) AI. */
export function sanitizeRichText(html: string): { html: string; text: string } {
  const clean = sanitizeHtml(html, OPTIONS)
    // The editor's empty document is a single empty paragraph.
    .replace(/^(<p><\/p>)+$/, "")
    .trim();
  return { html: clean, text: htmlToText(clean) };
}

export function htmlToText(html: string): string {
  const withBreaks = html.replace(/<\/(p|li|h2|h3|blockquote|pre)>|<br\s*\/?>|<hr\s*\/?>/g, "$&\n");
  const stripped = sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} });
  return stripped
    .replace(/&(amp|lt|gt|quot|#39|#x27|nbsp);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** First ~n characters of the plain text on one line, cut at a word boundary. */
export function excerpt(text: string, max = 180): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).trimEnd()}…`;
}
