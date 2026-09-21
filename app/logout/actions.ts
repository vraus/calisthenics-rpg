"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { REMEMBER_COOKIE_NAME } from "@/lib/supabase/remember";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const cookieStore = await cookies();
  cookieStore.delete(REMEMBER_COOKIE_NAME);

  redirect("/login");
}
