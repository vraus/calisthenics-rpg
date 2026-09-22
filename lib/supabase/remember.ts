import type { CookieOptions } from "@supabase/ssr";

export const REMEMBER_COOKIE_NAME = "sb-remember-me";
export const REMEMBER_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * @supabase/ssr hardcodes every auth cookie it writes to a 400-day maxAge
 * (node_modules/@supabase/ssr/src/cookies.ts, applyServerStorage: it spreads
 * `cookieOptions` and then unconditionally overwrites `maxAge` again after),
 * so the `cookieOptions` constructor option can't be used to shorten it.
 * Callers must instead override `maxAge` themselves, in their own `setAll`
 * cookie handler, on the options object @supabase/ssr hands back - which is
 * what this does.
 */
export function withRememberMaxAge(
  options: CookieOptions | undefined,
  remember: boolean
): CookieOptions {
  const rest = { ...options };
  delete rest.maxAge;
  delete rest.expires;
  return remember ? { ...rest, maxAge: REMEMBER_MAX_AGE } : rest;
}
