"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeSessionXp, meetsUnlockThreshold } from "@/lib/xp";
import type { Exercise } from "@/lib/types";

export interface LogSessionResult {
  ok: boolean;
  error?: string;
  xpEarned?: number;
  justMastered?: boolean;
}

/**
 * Logs one session for the authenticated user. Only exerciseId + the raw
 * performance (sets, reps or duration) come from the client; the exercise's
 * xp_coefficient and unlock_threshold are re-read from the database, never
 * trusted from the form, so a tampered request can't inflate XP.
 */
export async function logSession(formData: FormData): Promise<LogSessionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Non connecté." };
  }

  const exerciseId = String(formData.get("exerciseId") ?? "");
  const sets = Number(formData.get("sets"));
  const repsRaw = formData.get("repsPerSet");
  const durationRaw = formData.get("durationSeconds");

  if (!exerciseId || !Number.isFinite(sets) || sets <= 0) {
    return { ok: false, error: "Séries invalides." };
  }

  const { data: exerciseRow, error: exerciseError } = await supabase
    .from("exercises")
    .select("id, family_id, slug, name, tier, unlock_type, unlock_threshold, xp_coefficient")
    .eq("id", exerciseId)
    .maybeSingle();

  if (exerciseError || !exerciseRow) {
    return { ok: false, error: "Exercice introuvable." };
  }

  const exercise: Exercise = {
    id: exerciseRow.id,
    familyId: exerciseRow.family_id,
    slug: exerciseRow.slug,
    name: exerciseRow.name,
    tier: exerciseRow.tier,
    unlockType: exerciseRow.unlock_type,
    unlockThreshold: exerciseRow.unlock_threshold,
    xpCoefficient: Number(exerciseRow.xp_coefficient),
  };

  const session = {
    exerciseId: exercise.id,
    sets,
    repsPerSet: repsRaw ? Number(repsRaw) : undefined,
    durationSeconds: durationRaw ? Number(durationRaw) : undefined,
  };

  let xpEarned: number;
  try {
    xpEarned = computeSessionXp(session, exercise);
  } catch {
    return { ok: false, error: "Saisie incohérente avec ce type d'exercice." };
  }

  const justMastered = meetsUnlockThreshold(session, exercise);

  const { error: insertError } = await supabase.from("sessions").insert({
    user_id: user.id,
    exercise_id: exercise.id,
    sets: session.sets,
    reps_per_set: session.repsPerSet ?? null,
    duration_seconds: session.durationSeconds ?? null,
    xp_earned: xpEarned,
  });

  if (insertError) {
    return { ok: false, error: "Échec de l'enregistrement de la séance." };
  }

  const { data: existingProgress } = await supabase
    .from("user_progress")
    .select("xp_in_exercise, mastered")
    .eq("user_id", user.id)
    .eq("exercise_id", exercise.id)
    .maybeSingle();

  const newXp = (existingProgress ? Number(existingProgress.xp_in_exercise) : 0) + xpEarned;
  const newMastered = existingProgress?.mastered || justMastered;

  const { error: progressError } = await supabase.from("user_progress").upsert(
    {
      user_id: user.id,
      exercise_id: exercise.id,
      xp_in_exercise: newXp,
      mastered: newMastered,
      mastered_at: newMastered && !existingProgress?.mastered ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,exercise_id" }
  );

  if (progressError) {
    return { ok: false, error: "Échec de la mise à jour de la progression." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/tree");
  revalidatePath("/history");

  return {
    ok: true,
    xpEarned,
    justMastered: justMastered && !existingProgress?.mastered,
  };
}
