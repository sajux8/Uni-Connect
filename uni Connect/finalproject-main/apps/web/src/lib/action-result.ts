/**
 * What every Server Action returns. The UI turns this into
 * toasts and field errors; actions never throw raw errors at the client.
 */
export type FieldErrors = Record<string, string[] | undefined>;

export type ActionResult<T = undefined> =
  { ok: true; data: T; message?: string } | { ok: false; error: string; fieldErrors?: FieldErrors };

export function ok<T = undefined>(data?: T, message?: string): ActionResult<T> {
  return { ok: true, data: data as T, message };
}

export function fail(error: string, fieldErrors?: FieldErrors): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/** Friendly text for the database errors users can actually cause. */
export function databaseErrorMessage(error: { code?: string; message?: string } | null): string {
  if (!error) return "Something went wrong. Please try again.";
  switch (error.code) {
    case "23505":
      return "That value is already taken.";
    case "42501":
      return error.message?.startsWith("Only") || error.message?.startsWith("You cannot")
        ? error.message
        : "You don't have permission to do that.";
    case "22023":
    case "P0002":
      return error.message ?? "That request isn't valid.";
    case "23514":
      return "One of the values isn't allowed. Please check the form.";
    default:
      return "Something went wrong. Please try again.";
  }
}
