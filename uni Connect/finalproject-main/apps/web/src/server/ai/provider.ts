import "server-only";

import { google, type GoogleLanguageModelOptions } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { embed, embedMany, generateText, Output, streamText } from "ai";
import type * as z from "zod";

import { aiConfig, EMBEDDING_DIMENSIONS } from "@/lib/ai/config";

/**
 * The AI providers: Gemini for answers, summaries and embeddings, with Groq
 * as the fallback for text when a `GROQ_API_KEY` is set. Embeddings are never switched (another
 * model's vectors wouldn't match the index).
 */

/**
 * Gemini 3 models think before answering; these tasks need very little of that. The 3.5 family
 * accepts "minimal", newer ones need at least "low".
 */
function googleOptions(modelId: string): { google: GoogleLanguageModelOptions } | undefined {
  if (!/^gemini-3/.test(modelId)) return undefined;
  return {
    google: { thinkingConfig: { thinkingLevel: /^gemini-3\.5/.test(modelId) ? "minimal" : "low" } },
  };
}

/** The main model, a second Gemini model, then Groq when a key is set. */
function models() {
  const gemini = [...new Set([aiConfig.chatModel, aiConfig.chatFallbackModel])];
  return [
    ...gemini.map((id) => ({ model: google(id), providerOptions: googleOptions(id) })),
    ...(process.env.GROQ_API_KEY?.trim()
      ? [{ model: groq(aiConfig.groqModel), providerOptions: undefined }]
      : []),
  ];
}

/** Texts → vectors for the index (documents) or for a search (queries). */
export async function embedTexts(
  values: string[],
  kind: "document" | "query",
): Promise<number[][]> {
  if (values.length === 0) return [];
  const options = {
    model: google.embedding(aiConfig.embedModel),
    dimensions: EMBEDDING_DIMENSIONS,
    providerOptions: {
      google: { taskType: kind === "document" ? "RETRIEVAL_DOCUMENT" : "RETRIEVAL_QUERY" },
    },
    maxRetries: 2,
  };
  if (values.length === 1) {
    const { embedding } = await embed({ ...options, value: values[0] });
    return [embedding];
  }
  const { embeddings } = await embedMany({ ...options, values });
  return embeddings;
}

/** pgvector's text form of a vector. */
export function toVector(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/**
 * Streams an answer. If the first provider fails before saying anything, the next one is tried;
 * if every provider fails, `onFailure` is called and nothing is yielded.
 */
export async function* streamAnswer(input: {
  instructions: string;
  prompt: string;
  onFailure?: (error: unknown) => void;
}): AsyncGenerator<string> {
  let lastError: unknown;
  for (const { model, providerOptions } of models()) {
    let started = false;
    let failed: unknown;
    try {
      const result = streamText({
        model,
        instructions: input.instructions,
        prompt: input.prompt,
        maxOutputTokens: 900,
        temperature: 0.2,
        maxRetries: 0,
        providerOptions,
        onError: ({ error }) => {
          failed = error;
        },
      });
      for await (const part of result.textStream) {
        if (!part) continue;
        started = true;
        yield part;
      }
    } catch (error) {
      failed = error;
    }
    if (started) return;
    lastError = failed ?? new Error("The model returned nothing");
  }
  input.onFailure?.(lastError);
}

/** One structured answer (summaries), with the same fallback. Returns the model that answered. */
export async function generateStructured<T>(input: {
  schema: z.ZodType<T>;
  instructions: string;
  prompt: string;
}): Promise<{ output: T; model: string }> {
  let lastError: unknown;
  for (const { model, providerOptions } of models()) {
    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: input.schema }),
        instructions: input.instructions,
        prompt: input.prompt,
        temperature: 0.2,
        maxRetries: 1,
        providerOptions,
      });
      return { output: output as T, model: typeof model === "string" ? model : model.modelId };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("No AI provider is configured");
}
