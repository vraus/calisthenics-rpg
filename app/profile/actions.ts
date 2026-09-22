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

export interface SetThemeZoneResult {
  ok: boolean;
  error?: string;
}

/**
 * Sets (or clears, with `phaseId: null`) the player's manually-chosen theme
 * zone — independent of their actual progression phase (see lib/theme.ts).
 * Server-side check (never trust the client here): only a zone at or below
 * the player's actual progression phase can be chosen — a locked zone's
 * theme can't be worn early.
 */
export async function setThemeZone(phaseId: string | null): Promise<SetThemeZoneResult> {
  const supabase = await createClient();
  const userId = await getAuthenticatedUserId();

  if (!userId) return { ok: false, error: "Non connecté." };

  if (phaseId) {
    const [{ data: profileRow }, { data: phases, error: phasesError }] = await Promise.all([
      supabase.from("profiles").select("current_phase_id").eq("user_id", userId).maybeSingle(),
      supabase.from("phases").select("id, sort_order"),
    ]);
    if (phasesError) return { ok: false, error: "Échec du changement de thème." };

    const targetPhase = (phases ?? []).find((p) => p.id === phaseId);
    const currentPhase = (phases ?? []).find((p) => p.id === profileRow?.current_phase_id);

    if (!targetPhase) return { ok: false, error: "Zone inconnue." };
    if (!currentPhase || targetPhase.sort_order > currentPhase.sort_order) {
      return { ok: false, error: "Zone pas encore débloquée." };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ theme_zone_id: phaseId })
    .eq("user_id", userId);

  if (error) {
    return { ok: false, error: "Échec du changement de thème." };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
