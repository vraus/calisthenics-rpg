import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Handles Supabase auth email links: exchanges the one-time code for a
 * session and writes the session cookie. Only the password-recovery flow
 * uses this now (magic-link sign-in was removed) - Supabase appends
 * `type=recovery` to the redirect for that flow, which we use to send the
 * user to set a new password instead of straight to the dashboard.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const destination = type === "recovery" ? "/auth/reset-password" : "/dashboard";
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
