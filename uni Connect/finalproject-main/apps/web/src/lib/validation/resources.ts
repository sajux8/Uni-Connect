import * as z from "zod";

import { ALLOWED_FILE_TYPES, MAX_RESOURCE_BYTES } from "@/lib/resources";

const optionalUuid = z.union([z.literal(""), z.uuid()]);

export const resourceSchema = z
  .object({
    kind: z.enum(["file", "link"]),
    title: z
      .string()
      .trim()
      .min(5, { error: "Use at least 5 characters." })
      .max(150, { error: "Keep the title under 150 characters." }),
    description: z.string().trim().max(1000, { error: "Use 1,000 characters or fewer." }),
    url: z.union([
      z.literal(""),
      z
        .url({ protocol: /^https?$/, error: "Use a full link starting with https://" })
        .max(1000, { error: "That link is too long." }),
    ]),
    filePath: z.string().max(300),
    fileName: z.string().max(200),
    fileSize: z
      .number()
      .int()
      .min(0)
      .max(MAX_RESOURCE_BYTES, { error: "Files can be up to 25 MB." }),
    mimeType: z.string().max(120),
    departmentId: optionalUuid,
    moduleCode: z
      .string()
      .trim()
      .max(20, { error: "Use 20 characters or fewer." })
      .regex(/^[A-Za-z0-9 -]*$/, { error: "Letters, numbers, spaces and dashes only." }),
    spaceId: optionalUuid,
    tagIds: z.array(z.uuid()).max(5, { error: "Choose up to 5 tags." }),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "link" && !v.url) {
      ctx.addIssue({ code: "custom", path: ["url"], message: "Add the link." });
    }
    if (v.kind === "file") {
      if (!v.filePath || !v.fileName || v.fileSize < 1) {
        ctx.addIssue({ code: "custom", path: ["file"], message: "Choose a file to upload." });
      } else if (!ALLOWED_FILE_TYPES[v.mimeType]) {
        ctx.addIssue({
          code: "custom",
          path: ["file"],
          message: "Use a PDF, Word, PowerPoint, Excel, PNG, JPG or ZIP file.",
        });
      }
    }
  });

export type ResourceInput = z.infer<typeof resourceSchema>;

export const reviewNoteSchema = z
  .string()
  .trim()
  .max(500, { error: "Use 500 characters or fewer." });
