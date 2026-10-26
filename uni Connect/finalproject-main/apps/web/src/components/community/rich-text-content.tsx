import { cn } from "@/lib/utils";

/**
 * Renders post/reply HTML. Safe because every body is sanitised on the server before it
 * is stored (lib/rich-text.ts); never pass unsanitised HTML here.
 */
export function RichTextContent({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={cn("rich-text text-[15.5px] leading-relaxed text-pretty", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
