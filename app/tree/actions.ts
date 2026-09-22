"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/auth";
import { cascadeMasterLowerTiers } from "@/lib/data";

export interface SelfReportMasteryResult {
  ok: boolean;
  error?: string;
}

/**
 * Lets a player who already had this level before joining the app mark it as
 * mastered directly, without logging a session. Only flips
 * user_progress.mastered — grants no XP (self-reporting a skill you already
 * had shouldn't inflate the global level the same way earning it in-app
 * does), and never touches xp_in_exercise if a row already exists.
 */
export async function selfReportMastery(exerciseId: string): Promise<SelfReportMasteryResult> {
  const supabase = await createClient();
  const userId = await getAuthenticatedUserId();

  if (!userId) return { ok: false, error: "Non connecté." };
  if (!exerciseId) return { ok: false, error: "Exercice invalide." };

  const { data: exerciseRow, error: exerciseError } = await supabase
    .from("exercises")
    .select("family_id, tier")
    .eq("id", exerciseId)
    .maybeSingle();
  if (exerciseError || !exerciseRow) {
    return { ok: false, error: "Exercice introuvable." };
  }

  const { data: existing } = await supabase
    .from("user_progress")
    .select("user_id")
    .eq("user_id", userId)
    .eq("exercise_id", exerciseId)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("user_progress")
        .update({ mastered: true, mastered_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("exercise_id", exerciseId)
    : await supabase
        .from("user_progress")
        .insert({ user_id: userId, exercise_id: exerciseId, mastered: true, mastered_at: new Date().toISOString() });

  if (error) {
    return { ok: false, error: "Échec de l'enregistrement." };
  }

  // Même logique que la validation normale (voir logExercisePerformance) :
  // déclarer un niveau maîtrisé considère les niveaux inférieurs acquis aussi.
  if (exerciseRow.family_id && exerciseRow.tier) {
    await cascadeMasterLowerTiers(supabase, userId, exerciseRow.family_id, exerciseRow.tier);
  }

  revalidatePath("/tree", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  return { ok: true };
}
