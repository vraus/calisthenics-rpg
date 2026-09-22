import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { REMEMBER_COOKIE_NAME, withRememberMaxAge } from "@/lib/supabase/remember";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/reset-password"];

/**
 * Refreshes the Supabase session cookie on every navigation (per the
 * @supabase/ssr recommended pattern) and redirects unauthenticated visitors
 * to /login. Runs before rendering (Next 16's "proxy", formerly middleware).
 *
 * auth.getUser() does a real network round trip to Supabase's Auth server
 * to revalidate the JWT (unlike getSession(), which just reads the local
 * cookie and isn't trustworthy server-side) - that's the right call to make
 * here, but every page and Server Action was ALSO calling it again on top
 * of this one, doubling that network cost on literally every request. This
 * forwards the already-verified user via request headers (the canonical
 * Next.js pattern - see node_modules/next/dist/docs/01-app/
 * 03-api-reference/03-file-conventions/proxy.md) so downstream code can
 * just read who's logged in instead of re-verifying. Always set from our
 * own getUser() result, never from an incoming client header, so it can't
 * be spoofed - the proxy runs on every route except static assets.
 */
export async function proxy(request: NextRequest) {
  const remember = request.cookies.get(REMEMBER_COOKIE_NAME)?.value === "1";
  const pendingCookies: { name: string; value: string; options?: CookieOptions }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          pendingCookies.push(...cookiesToSet);
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (!user && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (user && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const requestHeaders = new Headers(request.headers);
  if (user) {
    requestHeaders.set("x-user-id", user.id);
    if (user.email) requestHeaders.set("x-user-email", user.email);
  } else {
    requestHeaders.delete("x-user-id");
    requestHeaders.delete("x-user-email");
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, withRememberMaxAge(options, remember));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/).*)",
  ],
};
