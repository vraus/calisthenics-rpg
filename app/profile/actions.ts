"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/auth";

const USERNAME_PATTERN = /^[a-z0-9_-]{3,20}$/i;

export interface UpdateUsernameResult {
  ok: boolean;
  error?: string;
}

export async function updateUsername(formData: FormData): Promise<UpdateUsernameResult> {
  const supabase = await createClient();
  const userId = await getAuthenticatedUserId();

  if (!userId) return { ok: false, error: "Non connecté." };

  const username = String(formData.get("username") ?? "").trim();

  if (!USERNAME_PATTERN.test(username)) {
    return {
      ok: false,
      error: "3 à 20 caractères, lettres/chiffres/tirets uniquement.",
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ username })
    .eq("user_id", userId);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ce pseudo est déjà pris." };
    }
    return { ok: false, error: "Échec de la mise à jour du pseudo." };
  }

  revalidatePath("/profile");
  revalidatePath("/profile/annuaire");
  return { ok: true };
}
