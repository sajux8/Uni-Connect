/** Global search (Feature 8): result kinds, tabs and snippet highlighting. */

export const SEARCH_TABS = [
  { key: "all", label: "All", kinds: null },
  { key: "discussions", label: "Discussions", kinds: ["discussion"] },
  { key: "questions", label: "Questions", kinds: ["question"] },
  { key: "events", label: "Events", kinds: ["event"] },
  { key: "announcements", label: "Announcements", kinds: ["announcement"] },
  { key: "resources", label: "Resources", kinds: ["resource"] },
  { key: "people", label: "People", kinds: ["person"] },
] as const;
export type SearchTab = (typeof SEARCH_TABS)[number]["key"];
export type SearchKind =
  "discussion" | "question" | "event" | "announcement" | "resource" | "person";

export function parseSearchTab(value: unknown): SearchTab {
  return SEARCH_TABS.some((t) => t.key === value) ? (value as SearchTab) : "all";
}

export const KIND_LABELS: Record<SearchKind, string> = {
  discussion: "Discussion",
  question: "Question",
  event: "Event",
  announcement: "Announcement",
  resource: "Resource",
  person: "Person",
};

export const SEARCH_SINCE = [
  { key: "any", label: "Any time", days: null },
  { key: "week", label: "Past week", days: 7 },
  { key: "month", label: "Past month", days: 31 },
  { key: "year", label: "Past year", days: 365 },
] as const;
export type SearchSince = (typeof SEARCH_SINCE)[number]["key"];

export function parseSince(value: unknown): SearchSince {
  return SEARCH_SINCE.some((s) => s.key === value) ? (value as SearchSince) : "any";
}

/** Clean up what people type: trim, collapse spaces, cap the length. */
export function normaliseQuery(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, 100) : "";
}

/**
 * "databases viva tips" → "databases or viva or tips": used when nothing matches every word,
 * so a long question still finds something. Quotes and minus signs are left to the strict pass.
 */
export function anyWordQuery(query: string): string | null {
  const words = query
    .replace(/["-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && w.toLowerCase() !== "or");
  return words.length > 1 ? words.join(" or ") : null;
}

/** Splits a snippet with ⟦matches⟧ (from search_all) into plain and highlighted parts. */
export function splitHighlights(snippet: string): { text: string; hit: boolean }[] {
  const parts: { text: string; hit: boolean }[] = [];
  const re = /⟦([^⟧]*)⟧/g;
  let last = 0;
  for (let m = re.exec(snippet); m; m = re.exec(snippet)) {
    if (m.index > last) parts.push({ text: snippet.slice(last, m.index), hit: false });
    parts.push({ text: m[1], hit: true });
    last = m.index + m[0].length;
  }
  if (last < snippet.length) parts.push({ text: snippet.slice(last), hit: false });
  return parts.filter((p) => p.text);
}
