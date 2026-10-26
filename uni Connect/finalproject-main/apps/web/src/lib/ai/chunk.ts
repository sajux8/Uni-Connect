/**
 * Splitting content into pieces for the Ask AI index. Pure functions.
 */

import { createHash } from "node:crypto";

/** ~800 tokens per chunk with ~100 tokens of overlap. */
export const CHUNK_CHARS = 3200;
export const CHUNK_OVERLAP = 400;

/** The line every chunk starts with, so a piece still says what it belongs to. */
export function sourceHeader(parts: {
  label: string;
  title: string;
  context?: string | null;
  date?: string | null;
}) {
  return [
    `[${parts.label}] ${parts.title.trim()}`,
    parts.context ? parts.context.trim() : null,
    parts.date ? parts.date.slice(0, 10) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function splitLong(paragraph: string, max: number): string[] {
  if (paragraph.length <= max) return [paragraph];
  const pieces: string[] = [];
  let rest = paragraph;
  while (rest.length > max) {
    // Prefer to break after a sentence, then at a space, then anywhere.
    const window = rest.slice(0, max);
    const sentence = Math.max(
      window.lastIndexOf(". "),
      window.lastIndexOf("? "),
      window.lastIndexOf("! "),
    );
    const space = window.lastIndexOf(" ");
    const cut = sentence > max * 0.5 ? sentence + 1 : space > max * 0.5 ? space : max;
    pieces.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) pieces.push(rest);
  return pieces;
}

/** The last `overlap` characters of a chunk, starting at a word. */
function tail(text: string, overlap: number): string {
  if (text.length <= overlap) return text;
  const cut = text.slice(text.length - overlap);
  const space = cut.indexOf(" ");
  return space === -1 ? cut : cut.slice(space + 1);
}

/**
 * Paragraphs merged into chunks of at most `max` characters; each chunk after the first starts
 * with the end of the one before, so a sentence cut by the boundary is still found.
 */
export function chunkText(
  text: string,
  max: number = CHUNK_CHARS,
  overlap: number = CHUNK_OVERLAP,
): string[] {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .flatMap((p) => splitLong(p, max - overlap));
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > max) {
      chunks.push(current);
      current = `${tail(current, overlap)}\n\n${paragraph}`;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Header + body split into the texts that get embedded. Always at least one chunk. */
export function buildChunks(header: string, body: string): string[] {
  const pieces = chunkText(body, CHUNK_CHARS - header.length - 1);
  return (pieces.length ? pieces : [""]).map((piece) => (piece ? `${header}\n${piece}` : header));
}

/** Unchanged text keeps its embedding: the hash says whether a chunk changed. */
export function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
