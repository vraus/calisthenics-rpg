"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAllExercises, getFamilies, getRecentSessions, getUserProgress } from "@/lib/data";
import { computeSessionXp, globalLevel, meetsUnlockThreshold } from "@/lib/xp";
import { computeStreak } from "@/lib/streak";
import { evaluateNewBadges, type BadgeContext } from "@/lib/badges";
import type { Exercise } from "@/lib/types";

export interface LogSessionResult {
  ok: boolean;
  error?: string;
  xpEarned?: number;
  justMastered?: boolean;
  newBadgeNames?: string[];
}

/**
 * Assembles the badge context from already-fetched data and persists any
 * newly-earned badges. Never throws: a badge-evaluation hiccup shouldn't
 * fail the session that was already successfully logged.
 */
async function awardNewBadges(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string[]> {
  try {
    const [families, exercises, progress, sessions, earnedRows] = await Promise.all([
      getFamilies(),
      getAllExercises(),
      getUserProgress(userId),
      getRecentSessions(userId, 1000),
      supabase.from("user_badges").select("badges(slug)").eq("user_id", userId),
    ]);

    const familySlugById = new Map(families.map((f) => [f.id, f.slug]));
    const masteredExerciseSlugs = new Set<string>();
    const masteredSlugsByFamily: Record<string, Set<string>> = {};
    const totalExercisesByFamily: Record<string, number> = {};

    const exerciseById = new Map(exercises.map((ex) => [ex.id, ex]));
    for (const ex of exercises) {
      const familySlug = familySlugById.get(ex.familyId);
      if (!familySlug) continue;
      totalExercisesByFamily[familySlug] = (totalExercisesByFamily[familySlug] ?? 0) + 1;
    }
    for (const p of progress) {
      if (!p.mastered) continue;
      const exercise = exerciseById.get(p.exerciseId);
      if (!exercise) continue;
      masteredExerciseSlugs.add(exercise.slug);
      const familySlug = familySlugById.get(exercise.familyId);
      if (!familySlug) continue;
      (masteredSlugsByFamily[familySlug] ??= new Set()).add(exercise.slug);
    }

    const alreadyEarnedSlugs = new Set(
      (earnedRows.data ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((row: any) => row.badges?.slug as string | undefined)
        .filter((slug): slug is string => Boolean(slug))
    );

    const ctx: BadgeContext = {
      sessionCount: sessions.length,
      currentStreak: computeStreak(sessions.map((s) => s.performed_at)).current,
      globalLevel: globalLevel(progress).level,
      masteredExerciseSlugs,
      masteredSlugsByFamily,
      totalExercisesByFamily,
    };

    const newSlugs = evaluateNewBadges(ctx, alreadyEarnedSlugs);
    if (newSlugs.length === 0) return [];

    const { data: badgeRows } = await supabase
      .from("badges")
      .select("id, slug, name")
      .in("slug", newSlugs);

    if (!badgeRows || badgeRows.length === 0) return [];

    await supabase.from("user_badges").insert(
      badgeRows.map((b) => ({ user_id: userId, badge_id: b.id }))
    );

    return badgeRows.map((b) => b.name);
  } catch {
    return [];
  }
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

  const newBadgeNames = await awardNewBadges(supabase, user.id);

  revalidatePath("/dashboard");
  revalidatePath("/tree");
  revalidatePath("/history");
  revalidatePath("/stats");

  return {
    ok: true,
    xpEarned,
    justMastered: justMastered && !existingProgress?.mastered,
    newBadgeNames: newBadgeNames.length > 0 ? newBadgeNames : undefined,
  };
}
