import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  DayKind,
  DayOfWeek,
  Exercise,
  ExerciseFamily,
  Phase,
  PlannedExercise,
  PlannedSession,
  PlannedSessionPart,
  PlannedSet,
  Profile,
  ProfileSummary,
  SessionTemplate,
  SessionTemplatePart,
  UnlockType,
  UserProgress,
  WeeklyPlan,
} from "@/lib/types";
import { levelFromXp } from "@/lib/xp";

/**
 * Data-access layer: every read here is scoped to the authenticated user via
 * RLS (see supabase/migrations/0001_init.sql), not by filtering in code.
 * Shared by dashboard, tree and history pages so query shape lives in one
 * place.
 */

export async function getPhases(): Promise<Phase[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("phases")
    .select("id, slug, name, sort_order, prerequisites_text")
    .order("sort_order");

  if (error) throw new Error(`getPhases: ${error.message}`);

  return (data ?? []).map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    sortOrder: p.sort_order,
    prerequisitesText: p.prerequisites_text ?? undefined,
  }));
}

export async function getFamilies(): Promise<ExerciseFamily[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercise_families")
    .select("id, slug, name, stat_tag, sort_order, phase_id")
    .order("sort_order");

  if (error) throw new Error(`getFamilies: ${error.message}`);

  return (data ?? []).map((f) => ({
    id: f.id,
    slug: f.slug,
    name: f.name,
    statTag: f.stat_tag,
    sortOrder: f.sort_order,
    phaseId: f.phase_id ?? undefined,
  }));
}

export async function getExercisesByFamilySlug(
  familySlug: string
): Promise<{ family: ExerciseFamily; exercises: Exercise[] } | null> {
  const supabase = await createClient();

  const { data: family, error: familyError } = await supabase
    .from("exercise_families")
    .select("id, slug, name, stat_tag, sort_order, phase_id")
    .eq("slug", familySlug)
    .maybeSingle();

  if (familyError) throw new Error(`getExercisesByFamilySlug: ${familyError.message}`);
  if (!family) return null;

  const { data: exercises, error: exercisesError } = await supabase
    .from("exercises")
    .select(EXERCISE_SELECT)
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
      phaseId: family.phase_id ?? undefined,
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
      .sort((a, b) => a.tier! - b.tier!),
  }));
}

/** Every exercise, including family-less circuit movements and variants — filter as needed. */
export async function getAllExercises(): Promise<Exercise[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .select(EXERCISE_SELECT)
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

/** Total session count — cheap head-count query, no row data fetched. */
export async function getSessionCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) throw new Error(`getSessionCount: ${error.message}`);
  return count ?? 0;
}

/**
 * Just enough recent session dates to compute a streak (badge thresholds
 * only go up to 30 days) — no join, unlike getRecentSessions, since only
 * `performed_at` is needed here.
 */
export async function getSessionDatesForStreak(userId: string, limit = 90): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("performed_at")
    .eq("user_id", userId)
    .order("performed_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getSessionDatesForStreak: ${error.message}`);
  return (data ?? []).map((r) => r.performed_at);
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
    .eq("day_kind", "rest")
    .not("completed_at", "is", null);

  if (error) throw new Error(`getRestDayCompletionDates: ${error.message}`);
  return (data ?? []).map((row) => row.completed_at as string);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapPlannedExerciseRows(
  exerciseRows: any[],
  setRows: any[],
  partIndexById: Map<string, number> = new Map()
): PlannedExercise[] {
  /* eslint-enable @typescript-eslint/no-explicit-any */
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
      restBetweenSetsSeconds: e.rest_between_sets_seconds,
      restAfterExerciseSeconds: e.rest_after_exercise_seconds,
      partIndex: e.part_id ? partIndexById.get(e.part_id) : undefined,
      sets: (setsByExercise.get(e.id) ?? []).sort((a, b) => a.setNumber - b.setNumber),
    };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPlannedSessionParts(partRows: any[]): PlannedSessionPart[] {
  return partRows.map((p) => ({
    id: p.id,
    partIndex: p.part_index,
    label: p.label ?? undefined,
    rounds: p.rounds,
    restBetweenRoundsSeconds: p.rest_between_rounds_seconds,
    sessionTemplateId: p.session_template_id ?? undefined,
  }));
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

/**
 * Reusable exercise circuits (e.g. "HIIT", more to come), for the week
 * editor's "start from a template" picker — an alternative to "Custom" when
 * building a "session" day.
 */
export async function getSessionTemplates(): Promise<SessionTemplate[]> {
  const supabase = await createClient();
  const { data: templateRows, error: templatesError } = await supabase
    .from("session_templates")
    .select("id, slug, name, phase_id")
    .order("sort_order");

  if (templatesError) throw new Error(`getSessionTemplates: ${templatesError.message}`);
  if (!templateRows || templateRows.length === 0) return [];

  const { data: partRows, error: partsError } = await supabase
    .from("session_template_parts")
    .select("id, session_template_id, part_index, label, rounds, rest_between_rounds_seconds")
    .in(
      "session_template_id",
      templateRows.map((t) => t.id)
    )
    .order("part_index");

  if (partsError) throw new Error(`getSessionTemplates: ${partsError.message}`);

  const { data: exerciseRows, error: exercisesError } = await supabase
    .from("session_template_exercises")
    .select(
      "id, session_template_id, part_id, exercise_id, target_sets, target_performance, rest_between_sets_seconds, rest_after_exercise_seconds, sort_order, exercises(name, slug, unlock_type)"
    )
    .in(
      "session_template_id",
      templateRows.map((t) => t.id)
    )
    .order("sort_order");

  if (exercisesError) throw new Error(`getSessionTemplates: ${exercisesError.message}`);

  const partIndexById = new Map((partRows ?? []).map((p) => [p.id, p.part_index]));

  return templateRows.map((t) => {
    const parts: SessionTemplatePart[] = (partRows ?? [])
      .filter((p) => p.session_template_id === t.id)
      .map((p) => ({
        id: p.id,
        partIndex: p.part_index,
        label: p.label ?? undefined,
        rounds: p.rounds,
        restBetweenRoundsSeconds: p.rest_between_rounds_seconds,
      }));

    // `sort_order` restarts at 1 within each part (see seed/circuits.json),
    // so a single `.order("sort_order")` on the raw query interleaves rows
    // from different parts that happen to share a value (part 1's exercise
    // #1 sorting next to part 2's exercise #1, etc). Sort explicitly here:
    // by part_index first (so a whole part is consumed before the next
    // starts), then sort_order within that part.
    const templateExerciseRows = (exerciseRows ?? [])
      .filter((e) => e.session_template_id === t.id)
      .sort((a, b) => {
        const partDiff = (partIndexById.get(a.part_id) ?? 0) - (partIndexById.get(b.part_id) ?? 0);
        return partDiff !== 0 ? partDiff : a.sort_order - b.sort_order;
      });

    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      phaseId: t.phase_id ?? undefined,
      parts,
      exercises: templateExerciseRows
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((e: any) => ({
          id: e.id,
          exerciseId: e.exercise_id,
          exerciseName: e.exercises?.name ?? "Exercice",
          exerciseSlug: e.exercises?.slug ?? "",
          unlockType: (e.exercises?.unlock_type as UnlockType) ?? "reps",
          targetSets: e.target_sets,
          targetPerformance: e.target_performance,
          restBetweenSetsSeconds: e.rest_between_sets_seconds,
          restAfterExerciseSeconds: e.rest_after_exercise_seconds,
          partIndex: partIndexById.get(e.part_id) ?? 0,
        })),
    };
  });
}

const PLANNED_EXERCISE_SELECT =
  "id, planned_session_id, exercise_id, target_sets, target_performance, rest_between_sets_seconds, rest_after_exercise_seconds, sort_order, part_id, exercises(name, slug, unlock_type)";

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
    .select("id, weekly_plan_id, label, sort_order, day_of_week, day_kind, rounds, rest_between_rounds_seconds, completed_at, full_completion")
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

  const { data: partRows, error: partsError } = sessionIds.length
    ? await supabase
        .from("planned_session_parts")
        .select("id, planned_session_id, part_index, label, rounds, rest_between_rounds_seconds, session_template_id")
        .in("planned_session_id", sessionIds)
        .order("part_index")
    : { data: [], error: null };

  if (partsError) throw new Error(`getWeeklyPlan: ${partsError.message}`);

  const partIndexById = new Map((partRows ?? []).map((p) => [p.id, p.part_index]));
  const exercisesBySession = new Map<string, PlannedExercise[]>();
  for (const sessionId of sessionIds) {
    exercisesBySession.set(
      sessionId,
      mapPlannedExerciseRows(
        (exerciseRows ?? []).filter((e) => e.planned_session_id === sessionId),
        setRows ?? [],
        partIndexById
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
      dayKind: s.day_kind as DayKind,
      rounds: s.rounds,
      restBetweenRoundsSeconds: s.rest_between_rounds_seconds,
      parts: mapPlannedSessionParts((partRows ?? []).filter((p) => p.planned_session_id === s.id)),
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
    .select("id, weekly_plan_id, label, sort_order, day_of_week, day_kind, rounds, rest_between_rounds_seconds, completed_at, full_completion")
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

  const { data: partRows, error: partsError } = await supabase
    .from("planned_session_parts")
    .select("id, planned_session_id, part_index, label, rounds, rest_between_rounds_seconds, session_template_id")
    .eq("planned_session_id", sessionRow.id)
    .order("part_index");

  if (partsError) throw new Error(`getPlannedSessionDetail: ${partsError.message}`);

  const partIndexById = new Map((partRows ?? []).map((p) => [p.id, p.part_index]));

  return {
    id: sessionRow.id,
    weeklyPlanId: sessionRow.weekly_plan_id,
    label: sessionRow.label,
    sortOrder: sessionRow.sort_order,
    dayOfWeek: (sessionRow.day_of_week ?? undefined) as DayOfWeek | undefined,
    dayKind: sessionRow.day_kind as DayKind,
    rounds: sessionRow.rounds,
    restBetweenRoundsSeconds: sessionRow.rest_between_rounds_seconds,
    parts: mapPlannedSessionParts(partRows ?? []),
    completedAt: sessionRow.completed_at ?? undefined,
    fullCompletion: sessionRow.full_completion,
    exercises: mapPlannedExerciseRows(exerciseRows ?? [], setRows ?? [], partIndexById),
  };
}

/**
 * XP summary for an already-completed planned session (training or rest) —
 * used to show the right numbers on a cold revisit, instead of the 0 that
 * client-only tracking would show after a page reload.
 */
export async function getPlannedSessionXpSummary(
  userId: string,
  plannedSessionId: string
): Promise<{ xpEarned: number; bonusXp: number }> {
  const supabase = await createClient();

  const { data: exerciseRows } = await supabase
    .from("planned_exercises")
    .select("id")
    .eq("planned_session_id", plannedSessionId)
    .eq("user_id", userId);
  const exerciseIds = (exerciseRows ?? []).map((e) => e.id);

  const { data: setRows } = exerciseIds.length
    ? await supabase.from("planned_sets").select("session_id").in("planned_exercise_id", exerciseIds)
    : { data: [] };
  const sessionIds = [
    ...new Set((setRows ?? []).map((s) => s.session_id).filter((id): id is string => Boolean(id))),
  ];

  const { data: xpRows } = sessionIds.length
    ? await supabase.from("sessions").select("xp_earned").in("id", sessionIds)
    : { data: [] };
  const xpEarned = (xpRows ?? []).reduce((sum, r) => sum + Number(r.xp_earned), 0);

  const { data: bonusRows } = await supabase
    .from("xp_bonuses")
    .select("amount")
    .eq("user_id", userId)
    .eq("planned_session_id", plannedSessionId);
  const bonusXp = (bonusRows ?? []).reduce((sum, r) => sum + Number(r.amount), 0);

  return { xpEarned, bonusXp };
}

/**
 * When a tier is mastered (in-app validation or self-report), every lower
 * tier of the same family is marked mastered too — a player who can do tier
 * 3 obviously could do tiers 1 and 2, no need to make them re-prove it.
 * Never overwrites an already-mastered row (keeps its original mastered_at)
 * and never touches xp_in_exercise (no XP retroactively granted for tiers
 * skipped this way). Returns the exercise ids it newly mastered, so callers
 * evaluating badges/progress right after can account for them too.
 */
export async function cascadeMasterLowerTiers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  familyId: string,
  tier: number
): Promise<string[]> {
  if (tier <= 1) return [];

  const { data: lowerExercises } = await supabase
    .from("exercises")
    .select("id")
    .eq("family_id", familyId)
    .lt("tier", tier);
  const lowerIds = (lowerExercises ?? []).map((e) => e.id);
  if (lowerIds.length === 0) return [];

  const { data: existingRows } = await supabase
    .from("user_progress")
    .select("exercise_id, mastered")
    .eq("user_id", userId)
    .in("exercise_id", lowerIds);
  const existingById = new Map((existingRows ?? []).map((r) => [r.exercise_id, r.mastered]));

  const toUpdate = lowerIds.filter((id) => existingById.get(id) === false);
  const toInsert = lowerIds.filter((id) => !existingById.has(id));
  const newlyMastered = [...toUpdate, ...toInsert];
  if (newlyMastered.length === 0) return [];

  const nowIso = new Date().toISOString();
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

  return newlyMastered;
}

const DEFAULT_USERNAME_BASE = "aventurier";

/**
 * Creates a profiles row with a default username if this user doesn't have
 * one yet — no-op otherwise. Takes an already-authenticated client (same
 * pattern as logExercisePerformance) rather than constructing its own, so
 * it can run mid-login before the new session cookie is fully settled.
 */
export async function ensureProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  email: string | null | undefined
): Promise<void> {
  const { data: existing } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return;

  const base =
    (email?.split("@")[0] ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 16) || DEFAULT_USERNAME_BASE;

  for (let suffix = 0; suffix <= 20; suffix++) {
    const username = suffix === 0 ? base : `${base}${suffix}`;
    const { error } = await supabase.from("profiles").insert({ user_id: userId, username });
    if (!error) return;
    if (error.code !== "23505") return; // unexpected error: non-critical path, don't block login
  }
}

const PROFILE_SELECT = "user_id, username, current_phase_id, onboarding_completed_at, theme_zone_id";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProfileRow(row: any): Profile {
  return {
    userId: row.user_id,
    username: row.username,
    currentPhaseId: row.current_phase_id ?? undefined,
    onboardingCompletedAt: row.onboarding_completed_at ?? undefined,
    themeZoneId: row.theme_zone_id ?? undefined,
  };
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`getProfile: ${error.message}`);
  return data ? mapProfileRow(data) : null;
}

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("username", username)
    .maybeSingle();

  if (error) throw new Error(`getProfileByUsername: ${error.message}`);
  return data ? mapProfileRow(data) : null;
}

/** Every profile with its global level (own progress XP + bonus XP), for the directory. */
export async function getAllProfilesWithLevel(): Promise<ProfileSummary[]> {
  const supabase = await createClient();
  const [{ data: profileRows }, { data: progressRows }, { data: bonusRows }] = await Promise.all([
    supabase.from("profiles").select("user_id, username"),
    supabase.from("user_progress").select("user_id, xp_in_exercise"),
    supabase.from("xp_bonuses").select("user_id, amount"),
  ]);

  const xpByUser = new Map<string, number>();
  for (const p of progressRows ?? []) {
    xpByUser.set(p.user_id, (xpByUser.get(p.user_id) ?? 0) + Number(p.xp_in_exercise));
  }
  for (const b of bonusRows ?? []) {
    xpByUser.set(b.user_id, (xpByUser.get(b.user_id) ?? 0) + Number(b.amount));
  }

  return (profileRows ?? [])
    .map((p) => ({
      userId: p.user_id,
      username: p.username,
      level: levelFromXp(xpByUser.get(p.user_id) ?? 0).level,
    }))
    .sort((a, b) => b.level - a.level);
}

const EXERCISE_SELECT =
  "id, family_id, slug, name, tier, unlock_type, unlock_threshold, xp_coefficient, description, variant_of_id";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapExerciseRow(row: any): Exercise {
  return {
    id: row.id,
    familyId: row.family_id ?? undefined,
    slug: row.slug,
    name: row.name,
    tier: row.tier ?? undefined,
    unlockType: row.unlock_type ?? undefined,
    unlockThreshold: row.unlock_threshold ?? undefined,
    xpCoefficient: row.xp_coefficient != null ? Number(row.xp_coefficient) : undefined,
    description: row.description ?? undefined,
    variantOfId: row.variant_of_id ?? undefined,
  };
}
