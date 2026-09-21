import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  DayOfWeek,
  Exercise,
  ExerciseFamily,
  PlannedExercise,
  PlannedSession,
  PlannedSet,
  UnlockType,
  UserProgress,
  WeeklyPlan,
} from "@/lib/types";

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

export async function getXpBonusTotal(userId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("xp_bonuses")
    .select("amount")
    .eq("user_id", userId);

  if (error) throw new Error(`getXpBonusTotal: ${error.message}`);
  return (data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
}

/**
 * Completion timestamps of validated rest days — merged with
 * sessions.performed_at before computeStreak() so a rested day keeps the
 * attendance streak alive too (see lib/streak.ts), not just a logged
 * session. Rest days don't create a `sessions` row (no performance to
 * record), hence this separate read.
 */
export async function getRestDayCompletionDates(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planned_sessions")
    .select("completed_at")
    .eq("user_id", userId)
    .eq("is_rest_day", true)
    .not("completed_at", "is", null);

  if (error) throw new Error(`getRestDayCompletionDates: ${error.message}`);
  return (data ?? []).map((row) => row.completed_at as string);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPlannedExerciseRows(exerciseRows: any[], setRows: any[]): PlannedExercise[] {
  const setsByExercise = new Map<string, PlannedSet[]>();
  for (const s of setRows) {
    const list = setsByExercise.get(s.planned_exercise_id) ?? [];
    list.push({ id: s.id, setNumber: s.set_number, doneAt: s.done_at ?? undefined });
    setsByExercise.set(s.planned_exercise_id, list);
  }

  return exerciseRows.map((e) => {
    const ex = e.exercises as { name?: string; slug?: string; unlock_type?: string } | null;
    return {
      id: e.id,
      exerciseId: e.exercise_id,
      exerciseName: ex?.name ?? "Exercice",
      exerciseSlug: ex?.slug ?? "",
      unlockType: (ex?.unlock_type as UnlockType) ?? "reps",
      targetSets: e.target_sets,
      targetPerformance: e.target_performance,
      sets: (setsByExercise.get(e.id) ?? []).sort((a, b) => a.setNumber - b.setNumber),
    };
  });
}

/** Which of these week_start keys already have a plan, for this user. */
export async function getPlannedWeekStarts(userId: string, weekStarts: string[]): Promise<Set<string>> {
  if (weekStarts.length === 0) return new Set();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weekly_plans")
    .select("week_start")
    .eq("user_id", userId)
    .in("week_start", weekStarts);

  if (error) throw new Error(`getPlannedWeekStarts: ${error.message}`);
  return new Set((data ?? []).map((row) => row.week_start as string));
}

const PLANNED_EXERCISE_SELECT =
  "id, planned_session_id, exercise_id, target_sets, target_performance, sort_order, exercises(name, slug, unlock_type)";

/** The current week's plan (if any) for this user, fully nested. */
export async function getWeeklyPlan(userId: string, weekStart: string): Promise<WeeklyPlan | null> {
  const supabase = await createClient();

  const { data: planRow, error: planError } = await supabase
    .from("weekly_plans")
    .select("id, week_start, perfect_week_awarded_at")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (planError) throw new Error(`getWeeklyPlan: ${planError.message}`);
  if (!planRow) return null;

  const { data: sessionRows, error: sessionsError } = await supabase
    .from("planned_sessions")
    .select("id, weekly_plan_id, label, sort_order, day_of_week, is_rest_day, completed_at, full_completion")
    .eq("weekly_plan_id", planRow.id)
    .order("sort_order");

  if (sessionsError) throw new Error(`getWeeklyPlan: ${sessionsError.message}`);

  const sessionIds = (sessionRows ?? []).map((s) => s.id);
  const { data: exerciseRows, error: exercisesError } = sessionIds.length
    ? await supabase
        .from("planned_exercises")
        .select(PLANNED_EXERCISE_SELECT)
        .in("planned_session_id", sessionIds)
        .order("sort_order")
    : { data: [], error: null };

  if (exercisesError) throw new Error(`getWeeklyPlan: ${exercisesError.message}`);

  const exerciseIds = (exerciseRows ?? []).map((e) => e.id);
  const { data: setRows, error: setsError } = exerciseIds.length
    ? await supabase
        .from("planned_sets")
        .select("id, planned_exercise_id, set_number, done_at")
        .in("planned_exercise_id", exerciseIds)
    : { data: [], error: null };

  if (setsError) throw new Error(`getWeeklyPlan: ${setsError.message}`);

  const exercisesBySession = new Map<string, PlannedExercise[]>();
  for (const sessionId of sessionIds) {
    exercisesBySession.set(
      sessionId,
      mapPlannedExerciseRows(
        (exerciseRows ?? []).filter((e) => e.planned_session_id === sessionId),
        setRows ?? []
      )
    );
  }

  return {
    id: planRow.id,
    weekStart: planRow.week_start,
    perfectWeekAwardedAt: planRow.perfect_week_awarded_at ?? undefined,
    sessions: (sessionRows ?? []).map((s) => ({
      id: s.id,
      weeklyPlanId: s.weekly_plan_id,
      label: s.label,
      sortOrder: s.sort_order,
      dayOfWeek: (s.day_of_week ?? undefined) as DayOfWeek | undefined,
      isRestDay: s.is_rest_day,
      completedAt: s.completed_at ?? undefined,
      fullCompletion: s.full_completion,
      exercises: exercisesBySession.get(s.id) ?? [],
    })),
  };
}

/** A single planned session, fully nested — used by the execution page. */
export async function getPlannedSessionDetail(
  userId: string,
  plannedSessionId: string
): Promise<PlannedSession | null> {
  const supabase = await createClient();

  const { data: sessionRow, error: sessionError } = await supabase
    .from("planned_sessions")
    .select("id, weekly_plan_id, label, sort_order, day_of_week, is_rest_day, completed_at, full_completion")
    .eq("id", plannedSessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (sessionError) throw new Error(`getPlannedSessionDetail: ${sessionError.message}`);
  if (!sessionRow) return null;

  const { data: exerciseRows, error: exercisesError } = await supabase
    .from("planned_exercises")
    .select(PLANNED_EXERCISE_SELECT)
    .eq("planned_session_id", sessionRow.id)
    .order("sort_order");

  if (exercisesError) throw new Error(`getPlannedSessionDetail: ${exercisesError.message}`);

  const exerciseIds = (exerciseRows ?? []).map((e) => e.id);
  const { data: setRows, error: setsError } = exerciseIds.length
    ? await supabase
        .from("planned_sets")
        .select("id, planned_exercise_id, set_number, done_at")
        .in("planned_exercise_id", exerciseIds)
    : { data: [], error: null };

  if (setsError) throw new Error(`getPlannedSessionDetail: ${setsError.message}`);

  return {
    id: sessionRow.id,
    weeklyPlanId: sessionRow.weekly_plan_id,
    label: sessionRow.label,
    sortOrder: sessionRow.sort_order,
    dayOfWeek: (sessionRow.day_of_week ?? undefined) as DayOfWeek | undefined,
    isRestDay: sessionRow.is_rest_day,
    completedAt: sessionRow.completed_at ?? undefined,
    fullCompletion: sessionRow.full_completion,
    exercises: mapPlannedExerciseRows(exerciseRows ?? [], setRows ?? []),
  };
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
