"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/auth";

export interface CompleteOnboardingResult {
  ok: boolean;
  error?: string;
}

/** Sets the player's starting phase and marks onboarding as done — never re-run after this. */
export async function completeOnboarding(phaseId: string): Promise<CompleteOnboardingResult> {
  const supabase = await createClient();
  const userId = await getAuthenticatedUserId();

  if (!userId) return { ok: false, error: "Non connecté." };
  if (!phaseId) return { ok: false, error: "Phase invalide." };

  const { error } = await supabase
    .from("profiles")
    .update({ current_phase_id: phaseId, onboarding_completed_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (error) {
    return { ok: false, error: "Échec de l'enregistrement de ta phase de départ." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/tree");
  revalidatePath("/plan");
  revalidatePath("/profile");
  return { ok: true };
}
