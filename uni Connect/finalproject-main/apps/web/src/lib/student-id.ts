/**
 * Campus student IDs look like AB/CSE/UNI/17/04: campus code / programme / awarding body / intake
 * (batch) number / student number. The check is deliberately loose: letters in the
 * first three parts and digits in the last two. The intake number suggests the student's batch.
 */
export const STUDENT_ID_PATTERN = /^[A-Z]{1,6}\/[A-Z]{2,10}\/[A-Z]{2,8}\/\d{1,3}\/\d{1,4}$/;

export const STUDENT_ID_EXAMPLE = "AB/CSE/UNI/17/04";

/** Uppercases and tidies what people type: spaces removed, backslashes and dashes read as slashes. */
export function normalizeStudentId(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "").replace(/[\\-]/g, "/");
}

export interface StudentIdParts {
  campus: string;
  programme: string;
  awardingBody: string;
  intake: number;
  number: string;
}

export function parseStudentId(raw: string | null | undefined): StudentIdParts | null {
  if (!raw) return null;
  const id = normalizeStudentId(raw);
  if (!STUDENT_ID_PATTERN.test(id)) return null;
  const [campus, programme, awardingBody, intake, number] = id.split("/");
  const n = Number(intake);
  if (!Number.isInteger(n) || n < 1 || n > 999) return null;
  return { campus, programme, awardingBody, intake: n, number };
}
