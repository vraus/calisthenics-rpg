"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/auth";
import {
  cascadeMasterLowerTiers,
  cascadeUnmasterHigherTiers,
  getUserProgress,
  maybeAdvancePhase,
  maybeRevertPhase,
} from "@/lib/data";
import { awardNewBadges } from "@/app/log/actions";

export interface SelfReportMasteryResult {
  ok: boolean;
  error?: string;
  newPhaseName?: string;
  newBadgeNames?: string[];
}

/**
 * Lets a player who already had this level before joining the app mark it as
 * mastered directly, without logging a session. Only flips
 * user_progress.mastered - grants no XP (self-reporting a skill you already
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

  const progress = await getUserProgress(userId);
  const newBadgeNames = await awardNewBadges(supabase, userId, progress);
  const advanced = await maybeAdvancePhase(supabase, userId);

  revalidatePath("/tree", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { ok: true, newPhaseName: advanced?.newPhaseName, newBadgeNames: newBadgeNames.length ? newBadgeNames : undefined };
}

export interface CircuitCompletionResult {
  ok: boolean;
  error?: string;
  revertedPhaseName?: string;
  newPhaseName?: string;
  newBadgeNames?: string[];
}

/**
 * Déclare un circuit déjà fait avant l'appli, sans passer par une séance -
 * même esprit que selfReportMastery. Marque aussi chacun de ses exercices
 * comme acquis (on ne peut pas avoir fait le circuit sans avoir fait ses
 * exercices), et vérifie si ça complète la phase courante.
 */
export async function selfReportCircuitCompletion(templateId: string): Promise<CircuitCompletionResult> {
  const supabase = await createClient();
  const userId = await getAuthenticatedUserId();

  if (!userId) return { ok: false, error: "Non connecté." };
  if (!templateId) return { ok: false, error: "Circuit invalide." };

  const { error } = await supabase
    .from("user_circuit_completions")
    .upsert(
      { user_id: userId, session_template_id: templateId },
      { onConflict: "user_id,session_template_id", ignoreDuplicates: true }
    );

  if (error) return { ok: false, error: "Échec de l'enregistrement." };

  const { data: exerciseRows } = await supabase
    .from("session_template_exercises")
    .select("exercise_id")
    .eq("session_template_id", templateId);
  const exerciseIds = [...new Set((exerciseRows ?? []).map((e) => e.exercise_id))];

  if (exerciseIds.length > 0) {
    const { data: existingRows } = await supabase
      .from("user_progress")
      .select("exercise_id, mastered")
      .eq("user_id", userId)
      .in("exercise_id", exerciseIds);
    const existingById = new Map((existingRows ?? []).map((r) => [r.exercise_id, r.mastered]));
    const nowIso = new Date().toISOString();
    const toUpdate = exerciseIds.filter((id) => existingById.get(id) === false);
    const toInsert = exerciseIds.filter((id) => !existingById.has(id));

    await Promise.all([
      toUpdate.length > 0
        ? supabase
            .from("user_progress")
            .update({ mastered: true, mastered_at: nowIso })
            .eq("user_id", userId)
            .in("exercise_id", toUpdate)
        : null,
      toInsert.length > 0
        ? supabase
            .from("user_progress")
            .insert(toInsert.map((id) => ({ user_id: userId, exercise_id: id, mastered: true, mastered_at: nowIso })))
        : null,
    ]);
  }

  const progressAfterCircuit = await getUserProgress(userId);
  const newBadgeNames = await awardNewBadges(supabase, userId, progressAfterCircuit);
  const advanced = await maybeAdvancePhase(supabase, userId);

  revalidatePath("/tree", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return {
    ok: true,
    newPhaseName: advanced?.newPhaseName,
    newBadgeNames: newBadgeNames.length ? newBadgeNames : undefined,
  };
}

/**
 * Invalide un circuit marqué acquis (par une séance ou une auto-déclaration)
 * - pour corriger une erreur. Invalide aussi chacun de ses exercices
 * (symétrique de selfReportCircuitCompletion, qui les marque acquis).
 */
export async function uncompleteCircuit(templateId: string): Promise<CircuitCompletionResult> {
  const supabase = await createClient();
  const userId = await getAuthenticatedUserId();

  if (!userId) return { ok: false, error: "Non connecté." };
  if (!templateId) return { ok: false, error: "Circuit invalide." };

  const { error } = await supabase
    .from("user_circuit_completions")
    .delete()
    .eq("user_id", userId)
    .eq("session_template_id", templateId);

  if (error) return { ok: false, error: "Échec de l'invalidation." };

  const { data: exerciseRows } = await supabase
    .from("session_template_exercises")
    .select("exercise_id")
    .eq("session_template_id", templateId);
  const exerciseIds = [...new Set((exerciseRows ?? []).map((e) => e.exercise_id))];

  if (exerciseIds.length > 0) {
    await supabase
      .from("user_progress")
      .update({ mastered: false, mastered_at: null })
      .eq("user_id", userId)
      .in("exercise_id", exerciseIds);
  }

  const reverted = await maybeRevertPhase(supabase, userId);

  revalidatePath("/tree", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { ok: true, revertedPhaseName: reverted?.revertedPhaseName };
}

export interface UnmasterLevelResult {
  ok: boolean;
  error?: string;
  revertedPhaseName?: string;
}

/**
 * Invalide un niveau déjà marqué maîtrisé (par une séance ou une
 * auto-déclaration) - pour corriger une erreur. Invalide aussi tous les
 * niveaux supérieurs de la même compétence technique qui étaient maîtrisés
 * (symétrique de cascadeMasterLowerTiers) : on ne peut pas légitimement
 * avoir le niveau 4 sans le niveau 2. Ne touche pas l'XP déjà gagnée.
 */
export async function unmasterLevel(exerciseId: string): Promise<UnmasterLevelResult> {
  const supabase = await createClient();
  const userId = await getAuthenticatedUserId();

  if (!userId) return { ok: false, error: "Non connecté." };
  if (!exerciseId) return { ok: false, error: "Exercice invalide." };

  const { data: exerciseRow } = await supabase
    .from("exercises")
    .select("family_id, tier")
    .eq("id", exerciseId)
    .maybeSingle();

  const { error } = await supabase
    .from("user_progress")
    .update({ mastered: false, mastered_at: null })
    .eq("user_id", userId)
    .eq("exercise_id", exerciseId);

  if (error) {
    return { ok: false, error: "Échec de l'invalidation." };
  }

  if (exerciseRow?.family_id && exerciseRow.tier) {
    await cascadeUnmasterHigherTiers(supabase, userId, exerciseRow.family_id, exerciseRow.tier);
  }

  const reverted = await maybeRevertPhase(supabase, userId);

  revalidatePath("/tree", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { ok: true, revertedPhaseName: reverted?.revertedPhaseName };
}
