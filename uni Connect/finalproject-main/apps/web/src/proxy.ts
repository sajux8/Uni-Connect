import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { resolveRedirect, type AccessState } from "@/lib/auth/routing";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

/**
 * Runs before every page request (this is "middleware" in older Next.js).
 *
 * 1. Refreshes the Supabase session cookie.
 * 2. Sends each visitor where their account status allows (signed out → /login,
 *    pending → /pending, not onboarded → /onboarding, …). The rules live in
 *    lib/auth/routing.ts. This is a convenience only: pages and Server Actions
 *    re-check access, and row-level security is the real enforcement.
 *
 * Without Supabase keys it does nothing, so the public site still runs.
 */
export async function proxy(request: NextRequest) {
  const env = getSupabaseEnv();
  if (!env) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Verifies the session and refreshes the token when it's about to expire.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  let state: AccessState | null = null;
  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("status, role, onboarding_completed")
      .eq("id", userId)
      .maybeSingle();
    if (profile) {
      state = {
        status: profile.status,
        role: profile.role,
        onboardingCompleted: profile.onboarding_completed,
      };
    }
  }

  const target = resolveRedirect(request.nextUrl.pathname, state);
  if (!target) return response;

  const url = request.nextUrl.clone();
  const [pathname, search] = target.split("?");
  url.pathname = pathname;
  url.search = search ? `?${search}` : "";
  const redirect = NextResponse.redirect(url);
  // Keep any refreshed auth cookies on the redirect response.
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  // Skip static assets, image optimisation and API routes (they check auth themselves).
  matcher: [
    "/((?!_next/static|_next/image|api/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
