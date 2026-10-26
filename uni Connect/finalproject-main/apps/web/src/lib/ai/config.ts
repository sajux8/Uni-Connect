/**
 * AI settings. Model ids and limits come from the environment so a model can
 * be swapped without a code change; the defaults are the ones tested at M8. Server-side only: the
 * key never reaches the browser.
 */

export type SourceType = "post" | "reply" | "announcement" | "event" | "resource";

/** One numbered source shown beside an answer and given to the model. */
export interface AiSource {
  n: number;
  type: SourceType;
  id: string;
  title: string;
  /** Where the source lives in the app (a reply links to its post). */
  url: string;
  /** "Question", "Reply", "Announcement"… */
  label: string;
  date: string | null;
  content: string;
}

/** What the page gets for each source: everything except its text. */
export type AiSourceRef = Omit<AiSource, "content">;

export const EMBEDDING_DIMENSIONS = 768;

export const SOURCE_LABELS: Record<SourceType, string> = {
  post: "Post",
  reply: "Reply",
  announcement: "Announcement",
  event: "Event",
  resource: "Resource",
};

function int(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const aiConfig = {
  /** Fast and good at answering from given sources (measured at M8: ~1.6 s to the first words). */
  get chatModel() {
    return process.env.AI_CHAT_MODEL?.trim() || "gemini-3.5-flash";
  },
  /** Tried when the main model is overloaded or over its free quota. */
  get chatFallbackModel() {
    return process.env.AI_CHAT_FALLBACK_MODEL?.trim() || "gemini-3.5-flash-lite";
  },
  get embedModel() {
    return process.env.AI_EMBED_MODEL?.trim() || "gemini-embedding-001";
  },
  get groqModel() {
    return process.env.AI_GROQ_MODEL?.trim() || "llama-3.3-70b-versatile";
  },
  get dailyAskLimit() {
    return int(process.env.AI_DAILY_ASK_LIMIT, 20);
  },
  get dailySummaryLimit() {
    return int(process.env.AI_DAILY_SUMMARY_LIMIT, 10);
  },
  /** Related-question lookups a member may make per day (they don't count as questions). */
  dailyRelatedLimit: 200,
  /** Sources given to the model for one answer. */
  maxSources: 8,
  /**
   * Below this similarity (and with no keyword match) the model isn't asked at all. Measured at M8
   * with gemini-embedding-001 at 768 dimensions: clearly off-topic questions score under 0.55
   * against their best chunk, well-covered ones 0.73 or more. In between, similarity can't tell an
   * answerable question from a campus-flavoured one nobody has posted about (both score around
   * 0.58 to 0.61), so the model decides: it is told to say when the sources don't answer.
   */
  minSimilarity: 0.55,
  /** Chunks this far below the best one aren't worth showing as sources. */
  similarityWindow: 0.15,
  /**
   * Similar questions must be at least this close to be suggested. Measured at M8 with the title
   * embedded as a query: the same question reworded scores 0.74 or more, unrelated ones 0.63 or less.
   */
  relatedSimilarity: 0.68,
  /** Threads need this many replies before they can be summarised. */
  minRepliesForSummary: 5,
  /** Feedback forms need this many written answers before they can be summarised. */
  minAnswersForFormSummary: 3,
};

/** True when a Gemini key is set (AI features show a "not set up" state otherwise). */
export function aiConfigured(): boolean {
  return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim());
}
