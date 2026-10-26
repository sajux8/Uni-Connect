import type { Enums } from "@/types/database";

/**
 * Mentorship and messaging rules (Feature 4). The database enforces the same limits
 * (migration 0018); these copies drive the UI.
 */

export type MentorshipStatus = Enums<"mentorship_status">;

/** Mentors are students in Year 2 or above (year numbers from lib/campus.ts). */
export const MENTOR_MIN_YEAR = 2;
export const MAX_MENTEES_LIMIT = 10;
export const MESSAGE_MAX = 2000;
export const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;
export const REQUEST_MESSAGE_MIN = 30;
export const REQUEST_MESSAGE_MAX = 500;

export function canBeMentor(year: number | null | undefined): boolean {
  return typeof year === "number" && year >= MENTOR_MIN_YEAR;
}

export const SUBJECT_SUGGESTIONS = [
  "Programming",
  "Databases",
  "Web development",
  "Networking",
  "Data science",
  "Software engineering",
  "Mathematics",
  "Accounting",
  "Marketing",
  "Management",
  "Business law",
  "Final-year project",
  "Internships",
  "Exam preparation",
  "Study skills",
  "Career advice",
] as const;

export const MENTORSHIP_STATUS_LABELS: Record<MentorshipStatus, string> = {
  pending: "Waiting for an answer",
  accepted: "Active",
  declined: "Declined",
  cancelled: "Withdrawn",
  ended: "Ended",
};

export const MENTORSHIP_TABS = [
  { key: "incoming", label: "Incoming" },
  { key: "outgoing", label: "My requests" },
  { key: "active", label: "Active" },
  { key: "past", label: "Past" },
] as const;
export type MentorshipTab = (typeof MENTORSHIP_TABS)[number]["key"];

export function parseMentorshipTab(value: unknown): MentorshipTab | undefined {
  return MENTORSHIP_TABS.find((t) => t.key === value)?.key;
}

/** Places left for a mentor ("2 of 3 places free"). */
export function placesLeft(max: number, active: number): number {
  return Math.max(0, max - active);
}

/** Senders can change their own message for 15 minutes. */
export function canEditMessage(createdAt: string, now: number): boolean {
  return now - new Date(createdAt).getTime() < MESSAGE_EDIT_WINDOW_MS;
}

/** Messages are plain text: split out web links so they can be rendered as anchors. */
export function linkifyParts(text: string): { text: string; href?: string }[] {
  const parts: { text: string; href?: string }[] = [];
  const pattern = /\bhttps?:\/\/[^\s<>"']+/gi;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    // Leave closing punctuation outside the link ("see https://x.com.").
    const url = match[0].replace(/[.,!?;:)\]]+$/, "");
    const start = match.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: url, href: url });
    last = start + url.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/** Messages within this gap from the same sender are drawn as one group. */
export const MESSAGE_GROUP_GAP_MS = 5 * 60 * 1000;

export function startsGroup(
  previous: { senderId: string | null; createdAt: string } | undefined,
  message: { senderId: string | null; createdAt: string },
): boolean {
  if (!previous || previous.senderId !== message.senderId) return true;
  return (
    new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() >
    MESSAGE_GROUP_GAP_MS
  );
}
