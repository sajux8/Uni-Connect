import { isStaffRole, type AccountStatus, type UserRole } from "@/lib/campus";

/**
 * Where each kind of visitor may go. Pure functions, shared by
 * proxy.ts and the server guards, so the rules live in one place and are unit-tested.
 * This is a convenience layer: row-level security is still the real enforcement.
 */

export interface AccessState {
  status: AccountStatus;
  role: UserRole;
  onboardingCompleted: boolean;
}

/** Pages anyone can open, signed in or not. */
const PUBLIC_PATHS = ["/", "/login", "/register", "/forgot-password", "/privacy", "/terms"];
const PUBLIC_PREFIXES = ["/auth/", "/dev/"];

/** Signed-out pages that make no sense once you're fully signed in. */
const GUEST_ONLY_PATHS = ["/", "/login", "/register", "/forgot-password"];

const STATUS_PAGES: Record<Exclude<AccountStatus, "approved">, string> = {
  pending: "/pending",
  rejected: "/rejected",
  suspended: "/suspended",
};

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

/** Where a signed-in user belongs right now, ignoring the page they asked for. */
export function homeFor(state: AccessState): string {
  if (state.status !== "approved") return STATUS_PAGES[state.status];
  return state.onboardingCompleted ? "/home" : "/onboarding";
}

/**
 * Returns the path to redirect to, or null to let the request through.
 * `state` is null when the visitor isn't signed in (or has no profile yet).
 */
export function resolveRedirect(pathname: string, state: AccessState | null): string | null {
  if (!state) {
    if (isPublicPath(pathname)) return null;
    return `/login?next=${encodeURIComponent(pathname)}`;
  }

  const home = homeFor(state);

  if (GUEST_ONLY_PATHS.includes(pathname)) {
    // Pending/rejected/suspended users can still read the landing page.
    if (pathname === "/" && state.status !== "approved") return null;
    return home;
  }
  if (isPublicPath(pathname)) return null;

  // Reachable from the password-reset email whatever the account status.
  if (pathname === "/reset-password") return null;

  if (state.status !== "approved") {
    return pathname === STATUS_PAGES[state.status] ? null : STATUS_PAGES[state.status];
  }

  // Approved from here on.
  if ((Object.values(STATUS_PAGES) as string[]).includes(pathname)) return home;
  if (pathname === "/onboarding") return state.onboardingCompleted ? "/home" : null;
  if (!state.onboardingCompleted) return "/onboarding";

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!isStaffRole(state.role)) return "/home";
  }
  return null;
}
