/**
 * Merging search results and handling citations for Ask AI. Pure functions.
 */

/**
 * Reciprocal Rank Fusion: each list votes 1 / (k + rank) for its items; items found by several
 * searches rise to the top. Returns keys by descending score (ties keep first-seen order).
 */
export function rrfMerge(lists: string[][], k: number = 60): { key: string; score: number }[] {
  const scores = new Map<string, number>();
  for (const list of lists) {
    const seen = new Set<string>();
    list.forEach((key, rank) => {
      if (seen.has(key)) return;
      seen.add(key);
      scores.set(key, (scores.get(key) ?? 0) + 1 / (k + rank + 1));
    });
  }
  return [...scores].map(([key, score]) => ({ key, score })).sort((a, b) => b.score - a.score);
}

/** Keeps at most `perKey` items for each key, in order. */
export function capPerKey<T>(items: T[], keyOf: (item: T) => string, perKey: number): T[] {
  const counts = new Map<string, number>();
  return items.filter((item) => {
    const key = keyOf(item);
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    return n <= perKey;
  });
}

const CITATION = /\[(\d{1,2})\]/g;
const GROUPED = /\[(\d{1,2}(?:\s*[,;]\s*\d{1,2})+)\]/g;

/** "[1, 7]" → "[1][7]": models sometimes group citations. */
export function normalizeCitations(text: string): string {
  return text.replace(GROUPED, (_, list: string) =>
    list
      .split(/[,;]/)
      .map((n) => `[${n.trim()}]`)
      .join(""),
  );
}

/** The source numbers an answer cites, in order of first use. */
export function citedNumbers(text: string): number[] {
  const seen: number[] = [];
  for (const match of normalizeCitations(text).matchAll(CITATION)) {
    const n = Number(match[1]);
    if (!seen.includes(n)) seen.push(n);
  }
  return seen;
}

/** Removes citations of sources that don't exist (the model must only cite what it was given). */
export function stripInvalidCitations(text: string, sourceCount: number): string {
  return normalizeCitations(text)
    .replace(CITATION, (match, digits: string) => {
      const n = Number(digits);
      return n >= 1 && n <= sourceCount ? match : "";
    })
    .replace(/ +([.,;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ");
}

export type AnswerPart = { kind: "text"; text: string } | { kind: "cite"; n: number };

/** An answer split into plain text and citation markers, for rendering chips. */
export function splitCitations(text: string, sourceCount: number): AnswerPart[] {
  const parts: AnswerPart[] = [];
  let last = 0;
  for (const match of text.matchAll(CITATION)) {
    const n = Number(match[1]);
    const start = match.index ?? 0;
    if (start > last) parts.push({ kind: "text", text: text.slice(last, start) });
    if (n >= 1 && n <= sourceCount) parts.push({ kind: "cite", n });
    last = start + match[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
  return parts;
}
