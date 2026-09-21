import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { REMEMBER_COOKIE_NAME, withRememberMaxAge } from "./remember";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Reads/writes the session cookie via next/headers. Server Components can't
 * write cookies, so `setAll` there is wrapped in try/catch: proxy.ts is what
 * actually keeps the session fresh in that case.
 *
 * The session cookie's lifetime follows the `sb-remember-me` marker cookie
 * set at login (see app/login/actions.ts): present -> 30-day persistent
 * cookie, absent -> browser-session cookie. See lib/supabase/remember.ts for
 * why this has to happen in setAll rather than via `cookieOptions`.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const remember = cookieStore.get(REMEMBER_COOKIE_NAME)?.value === "1";

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, withRememberMaxAge(options, remember));
            }
          } catch {
            // Called from a Server Component: ignored, proxy.ts refreshes
            // the session cookie on navigation instead.
          }
        },
      },
    }
  );
}
