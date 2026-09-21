"use server";

import { createServerClient } from "@supabase/ssr";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/data";
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

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Email ou mot de passe incorrect." };
  }

  if (data.user) {
    await ensureProfile(supabase, data.user.id, data.user.email);
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

export interface SignupResult {
  error?: string;
  sent?: boolean;
}

/**
 * Creates an account, gated by a shared invite code (SIGNUP_INVITE_CODE) so
 * the signup form can't be used by anyone who just finds the site URL.
 * Whether this redirects straight to /dashboard or asks to check email
 * depends on the Supabase project's "Confirm email" setting: signUp returns
 * a session immediately when it's off, or just a user (no session) when a
 * confirmation email is required first.
 */
export async function signup(formData: FormData): Promise<SignupResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const inviteCode = String(formData.get("inviteCode") ?? "");

  if (!email || !password) {
    return { error: "Email et mot de passe requis." };
  }
  if (inviteCode !== process.env.SIGNUP_INVITE_CODE) {
    return { error: "Inscription refusée." };
  }
  if (password.length < 8) {
    return { error: "Le mot de passe doit contenir au moins 8 caractères." };
  }
  if (password !== confirmPassword) {
    return { error: "Les mots de passe ne correspondent pas." };
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
            cookieStore.set(name, value, withRememberMaxAge(options, false));
          }
        },
      },
    }
  );

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: "Impossible de créer ce compte pour le moment." };
  }

  if (data.session && data.user) {
    await ensureProfile(supabase, data.user.id, data.user.email);
    redirect("/dashboard");
  }

  return { sent: true };
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
