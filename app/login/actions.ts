"use server";

import { createServerClient } from "@supabase/ssr";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  REMEMBER_COOKIE_NAME,
  REMEMBER_MAX_AGE,
  withRememberMaxAge,
} from "@/lib/supabase/remember";

export interface LoginResult {
  error?: string;
}

async function getOrigin() {
  const h = await headers();
  const host = h.get("host") ?? "";
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const proto = h.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Signs in with email + password. The "remember me" cookie lifetime has to
 * be decided before the Supabase client is constructed (see
 * lib/supabase/remember.ts), so this builds its own client rather than
 * reusing lib/supabase/server.ts's createClient(), which only knows about a
 * remember choice made on a *previous* login.
 */
export async function login(formData: FormData): Promise<LoginResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const remember = formData.get("remember") === "on";

  if (!email || !password) {
    return { error: "Email et mot de passe requis." };
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, withRememberMaxAge(options, remember));
          }
        },
      },
    }
  );

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Email ou mot de passe incorrect." };
  }

  if (remember) {
    cookieStore.set(REMEMBER_COOKIE_NAME, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: REMEMBER_MAX_AGE,
    });
  } else {
    cookieStore.delete(REMEMBER_COOKIE_NAME);
  }

  redirect("/dashboard");
}

export interface ResetPasswordResult {
  error?: string;
  sent?: boolean;
}

/** Sends a recovery email; the link lands on /auth/callback then /auth/reset-password. */
export async function requestPasswordReset(
  formData: FormData
): Promise<ResetPasswordResult> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Email requis." };
  }

  const supabase = await createClient();
  const origin = await getOrigin();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback`,
  });

  if (error) {
    return { error: "Échec de l'envoi de l'email pour le moment." };
  }

  return { sent: true };
}
