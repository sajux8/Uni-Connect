import * as z from "zod";

export const postSchema = z.object({
  spaceId: z.uuid({ error: "Choose a space." }),
  type: z.enum(["discussion", "question"]),
  title: z
    .string()
    .trim()
    .min(10, { error: "Use at least 10 characters so people know what it's about." })
    .max(150, { error: "Keep the title under 150 characters." }),
  bodyHtml: z.string().max(40000, { error: "That's too long. Try splitting it up." }),
  tagIds: z.array(z.uuid()).max(5, { error: "Choose up to 5 tags." }),
  /** Batch spaces only: keep the post in the batch or share it with the whole department. */
  audience: z.enum(["batch", "department"]).optional(),
});
export type PostInput = z.infer<typeof postSchema>;

export const replySchema = z.object({
  postId: z.uuid(),
  parentReplyId: z.uuid().nullable().optional(),
  bodyHtml: z.string().max(20000, { error: "That reply is too long." }),
});
export type ReplyInput = z.infer<typeof replySchema>;

/** Rough plain-text length of editor HTML, for instant feedback (the server checks properly). */
export function roughTextLength(html: string): number {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, "x")
    .replace(/\s+/g, " ")
    .trim().length;
}

/** Body checks that run on the plain text, after sanitising. */
export const MIN_POST_BODY = 20;
export const MIN_REPLY_BODY = 2;

export const FEED_SORTS = ["latest", "new", "top"] as const;
export type FeedSort = (typeof FEED_SORTS)[number];

export const QUESTION_FILTERS = ["all", "unanswered", "solved", "mine"] as const;
export type QuestionFilter = (typeof QUESTION_FILTERS)[number];

export function parseSort(value: unknown): FeedSort {
  return FEED_SORTS.includes(value as FeedSort) ? (value as FeedSort) : "latest";
}

export function parseQuestionFilter(value: unknown): QuestionFilter {
  return QUESTION_FILTERS.includes(value as QuestionFilter) ? (value as QuestionFilter) : "all";
}
