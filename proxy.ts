import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { REMEMBER_COOKIE_NAME, withRememberMaxAge } from "@/lib/supabase/remember";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/reset-password"];

/**
 * Refreshes the Supabase session cookie on every navigation (per the
 * @supabase/ssr recommended pattern) and redirects unauthenticated visitors
 * to /login. Runs before rendering (Next 16's "proxy", formerly middleware).
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  const remember = request.cookies.get(REMEMBER_COOKIE_NAME)?.value === "1";

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
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, withRememberMaxAge(options, remember));
          }
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

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/).*)",
  ],
};
