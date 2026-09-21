import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Exercise, ExerciseFamily, UserProgress } from "@/lib/types";

/**
 * Data-access layer: every read here is scoped to the authenticated user via
 * RLS (see supabase/migrations/0001_init.sql), not by filtering in code.
 * Shared by dashboard, tree and history pages so query shape lives in one
 * place.
 */

export async function getFamilies(): Promise<ExerciseFamily[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercise_families")
    .select("id, slug, name, stat_tag, sort_order")
    .order("sort_order");

  if (error) throw new Error(`getFamilies: ${error.message}`);

  return (data ?? []).map((f) => ({
    id: f.id,
    slug: f.slug,
    name: f.name,
    statTag: f.stat_tag,
    sortOrder: f.sort_order,
  }));
}

export async function getExercisesByFamilySlug(
  familySlug: string
): Promise<{ family: ExerciseFamily; exercises: Exercise[] } | null> {
  const supabase = await createClient();

  const { data: family, error: familyError } = await supabase
    .from("exercise_families")
    .select("id, slug, name, stat_tag, sort_order")
    .eq("slug", familySlug)
    .maybeSingle();

  if (familyError) throw new Error(`getExercisesByFamilySlug: ${familyError.message}`);
  if (!family) return null;

  const { data: exercises, error: exercisesError } = await supabase
    .from("exercises")
    .select("id, family_id, slug, name, tier, unlock_type, unlock_threshold, xp_coefficient")
    .eq("family_id", family.id)
    .order("tier");

  if (exercisesError) throw new Error(`getExercisesByFamilySlug: ${exercisesError.message}`);

  return {
    family: {
      id: family.id,
      slug: family.slug,
      name: family.name,
      statTag: family.stat_tag,
      sortOrder: family.sort_order,
    },
    exercises: (exercises ?? []).map(mapExerciseRow),
  };
}

export async function getFamiliesWithExercises(): Promise<
  { family: ExerciseFamily; exercises: Exercise[] }[]
> {
  const [families, exercises] = await Promise.all([
    getFamilies(),
    getAllExercises(),
  ]);

  return families.map((family) => ({
    family,
    exercises: exercises
      .filter((ex) => ex.familyId === family.id)
      .sort((a, b) => a.tier - b.tier),
  }));
}

export async function getAllExercises(): Promise<Exercise[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .select("id, family_id, slug, name, tier, unlock_type, unlock_threshold, xp_coefficient")
    .order("tier");

  if (error) throw new Error(`getAllExercises: ${error.message}`);
  return (data ?? []).map(mapExerciseRow);
}

export async function getUserProgress(userId: string): Promise<UserProgress[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_progress")
    .select("user_id, exercise_id, xp_in_exercise, mastered, mastered_at")
    .eq("user_id", userId);

  if (error) throw new Error(`getUserProgress: ${error.message}`);

  return (data ?? []).map((p) => ({
    userId: p.user_id,
    exerciseId: p.exercise_id,
    xpInExercise: Number(p.xp_in_exercise),
    mastered: p.mastered,
    masteredAt: p.mastered_at ?? undefined,
  }));
}

export async function getRecentSessions(userId: string, limit = 20) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id, performed_at, sets, reps_per_set, duration_seconds, xp_earned, exercises(name, slug, family_id, exercise_families(name))"
    )
    .eq("user_id", userId)
    .order("performed_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getRecentSessions: ${error.message}`);
  return data ?? [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapExerciseRow(row: any): Exercise {
  return {
    id: row.id,
    familyId: row.family_id,
    slug: row.slug,
    name: row.name,
    tier: row.tier,
    unlockType: row.unlock_type,
    unlockThreshold: row.unlock_threshold,
    xpCoefficient: Number(row.xp_coefficient),
  };
}
