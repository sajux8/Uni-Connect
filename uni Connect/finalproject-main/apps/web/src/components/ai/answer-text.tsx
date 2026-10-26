"use client";

import { Fragment } from "react";

import { splitCitations } from "@/lib/ai/retrieval";

/**
 * An AI answer as safe text (no HTML from the model is ever rendered): paragraphs, simple bullet
 * lists, **bold**, and `[n]` citations as chips that jump to source n.
 */
export function AnswerText({
  text,
  sourceCount,
  onCite,
}: {
  text: string;
  sourceCount: number;
  onCite?: (n: number) => void;
}) {
  const blocks: { list: boolean; lines: string[] }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      blocks.push({ list: false, lines: [] });
      continue;
    }
    const bullet = /^([-*•]|\d+[.)])\s+/.exec(line);
    const last = blocks.at(-1);
    if (bullet) {
      const item = line.slice(bullet[0].length);
      if (last?.list) last.lines.push(item);
      else blocks.push({ list: true, lines: [item] });
    } else if (last && !last.list && last.lines.length > 0) {
      last.lines.push(line);
    } else {
      blocks.push({ list: false, lines: [line] });
    }
  }

  const inline = (line: string) =>
    splitCitations(line, sourceCount).map((part, i) =>
      part.kind === "cite" ? (
        <button
          key={i}
          type="button"
          onClick={() => onCite?.(part.n)}
          aria-label={`Source ${part.n}`}
          className="mx-0.5 inline-grid size-5 place-items-center rounded-full bg-ai/15 align-[1px] text-[11px] font-bold text-ai hover:bg-ai/25"
        >
          {part.n}
        </button>
      ) : (
        <Fragment key={i}>
          {part.text
            .split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/)
            .map((piece, j) =>
              piece.startsWith("**") && piece.endsWith("**") && piece.length > 4 ? (
                <strong key={j}>{piece.slice(2, -2)}</strong>
              ) : piece.startsWith("*") && piece.endsWith("*") && piece.length > 2 ? (
                <em key={j}>{piece.slice(1, -1)}</em>
              ) : (
                <Fragment key={j}>{piece.replace(/^#+\s*/, "")}</Fragment>
              ),
            )}
        </Fragment>
      ),
    );

  return (
    <div className="space-y-3 text-[15px] leading-relaxed">
      {blocks
        .filter((b) => b.lines.length > 0)
        .map((block, i) =>
          block.list ? (
            <ul key={i} className="list-disc space-y-1.5 pl-5">
              {block.lines.map((line, j) => (
                <li key={j}>{inline(line)}</li>
              ))}
            </ul>
          ) : (
            <p key={i}>{inline(block.lines.join(" "))}</p>
          ),
        )}
    </div>
  );
}
