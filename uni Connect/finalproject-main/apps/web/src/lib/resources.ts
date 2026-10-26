/**
 * Resource library rules (Feature 7). The storage bucket enforces the same type list and
 * the 25 MB limit; the server also checks each file's first bytes ("magic numbers").
 */

export const MAX_RESOURCE_BYTES = 25 * 1024 * 1024;

export type FileKind = "pdf" | "word" | "slides" | "sheet" | "image" | "zip" | "link";

export const ALLOWED_FILE_TYPES: Record<string, { kind: FileKind; label: string; ext: string[] }> =
  {
    "application/pdf": { kind: "pdf", label: "PDF", ext: ["pdf"] },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      kind: "word",
      label: "Word",
      ext: ["docx"],
    },
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
      kind: "slides",
      label: "PowerPoint",
      ext: ["pptx"],
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
      kind: "sheet",
      label: "Excel",
      ext: ["xlsx"],
    },
    "image/png": { kind: "image", label: "PNG image", ext: ["png"] },
    "image/jpeg": { kind: "image", label: "JPG image", ext: ["jpg", "jpeg"] },
    "application/zip": { kind: "zip", label: "ZIP", ext: ["zip"] },
    "application/x-zip-compressed": { kind: "zip", label: "ZIP", ext: ["zip"] },
  };

/** What the file picker accepts. */
export const ACCEPT_ATTRIBUTE = [
  ...new Set(Object.values(ALLOWED_FILE_TYPES).flatMap((t) => t.ext.map((e) => `.${e}`))),
].join(",");

/** Browsers sometimes report Office files as "" or octet-stream: fall back to the extension. */
export function resolveMimeType(fileName: string, reported: string): string | null {
  if (ALLOWED_FILE_TYPES[reported]) return reported;
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const match = Object.entries(ALLOWED_FILE_TYPES).find(([, t]) => t.ext.includes(ext));
  return match ? match[0] : null;
}

export function fileKind(mimeType: string | null, isLink = false): FileKind {
  if (isLink) return "link";
  return (mimeType && ALLOWED_FILE_TYPES[mimeType]?.kind) || "pdf";
}

export function fileTypeLabel(mimeType: string | null, isLink = false): string {
  if (isLink) return "Link";
  return (mimeType && ALLOWED_FILE_TYPES[mimeType]?.label) || "File";
}

/** Does the start of the file look like what its type claims? */
export function matchesSignature(mimeType: string, head: Uint8Array): boolean {
  const starts = (...bytes: number[]) => bytes.every((b, i) => head[i] === b);
  switch (ALLOWED_FILE_TYPES[mimeType]?.kind) {
    case "pdf":
      return starts(0x25, 0x50, 0x44, 0x46); // %PDF
    case "word":
    case "slides":
    case "sheet":
    case "zip":
      return starts(0x50, 0x4b, 0x03, 0x04) || starts(0x50, 0x4b, 0x05, 0x06); // PK..
    case "image":
      return mimeType === "image/png"
        ? starts(0x89, 0x50, 0x4e, 0x47) // .PNG
        : starts(0xff, 0xd8, 0xff); // JPEG
    default:
      return false;
  }
}

/** "lecture notes (week 3).pdf" → "lecture-notes-week-3.pdf", safe for storage paths. */
export function safeFileName(fullName: string): string {
  const name = fullName.split(/[\\/]/).pop() ?? "";
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .toLowerCase()
    .slice(0, 60);
  const ext =
    dot > 0
      ? name
          .slice(dot + 1)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 8)
      : "";
  return `${base || "file"}${ext ? `.${ext}` : ""}`;
}

export function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const REVIEW_STATUS_LABELS = {
  pending: "Waiting for review",
  approved: "Published",
  rejected: "Not approved",
} as const;
