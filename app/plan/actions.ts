"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logExercisePerformance, type LogSessionResult } from "@/app/log/actions";
import { getWeekStart } from "@/lib/week";
import type { Exercise } from "@/lib/types";

const SESSION_COMPLETE_BONUS_RATE = 0.2;
const PERFECT_WEEK_BONUS = 150;
const REST_DAY_BONUS = 10;

export interface CreatePlanResult {
  ok: boolean;
  error?: string;
}

/**
 * Deletes an entire week's plan — the "start over" escape hatch. No lock
 * check: unlike editing a single day, wiping the whole week is an explicit
 * user action, not something that could silently overwrite progress on
 * days the user didn't mean to touch. Cascades to planned_sessions/
 * planned_exercises/planned_sets; xp_bonuses already granted keep their XP
 * (weekly_plan_id just goes null, see 0003_planning.sql).
 */
export async function deleteWeeklyPlan(weekStart: string): Promise<CreatePlanResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data, error } = await supabase
    .from("weekly_plans")
    .delete()
    .eq("user_id", user.id)
    .eq("week_start", weekStart)
    .select("id");

  if (error) return { ok: false, error: "Échec de la suppression." };
  if (!data || data.length === 0) return { ok: false, error: "Rien à supprimer." };

  revalidatePath("/plan");
  revalidatePath(`/plan/week/${weekStart}/edit`);
  return { ok: true };
}

interface DayInput {
  dayOfWeek: number;
  kind: "rest" | "session" | "unset";
  label?: string;
  exercises?: { exerciseId: string; targetSets: number }[];
}

/** True if this day (existing DB row) has any progress and can't be touched. */
function dayIsLocked(isRestDay: boolean, completedAt: string | null, hasDoneSet: boolean): boolean {
  return isRestDay ? Boolean(completedAt) : hasDoneSet;
}

/**
 * Saves an entire week's day-by-day plan in one submission. The client
 * always sends all 7 days (dayOfWeek 0..6); a day already locked (some
 * progress on it) is silently left untouched even if the payload includes
 * a change for it. Creates the weekly_plans row on first save for this
 * week, reuses it on subsequent edits.
 */
export async function saveWeeklyPlanDays(
  weekStart: string,
  formData: FormData
): Promise<CreatePlanResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  let days: DayInput[];
  try {
    days = JSON.parse(String(formData.get("days") ?? "[]"));
  } catch {
    return { ok: false, error: "Plan invalide." };
  }
  if (!Array.isArray(days) || days.length === 0) {
    return { ok: false, error: "Plan invalide." };
  }
  for (const d of days) {
    if (d.kind === "session" && (!d.label || !Array.isArray(d.exercises) || d.exercises.length === 0)) {
      return { ok: false, error: "Chaque jour de séance doit avoir un nom et au moins un exercice." };
    }
  }

  let planId: string;
  const { data: existingPlan } = await supabase
    .from("weekly_plans")
    .select("id")
    .eq("user_id", user.id)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (existingPlan) {
    planId = existingPlan.id;
  } else {
    const { data: newPlan, error: planError } = await supabase
      .from("weekly_plans")
      .insert({ user_id: user.id, week_start: weekStart })
      .select("id")
      .single();
    if (planError || !newPlan) return { ok: false, error: "Échec de la création du plan." };
    planId = newPlan.id;
  }

  const { data: existingSessions } = await supabase
    .from("planned_sessions")
    .select("id, day_of_week, is_rest_day, completed_at")
    .eq("weekly_plan_id", planId);

  const existingSessionIds = (existingSessions ?? []).map((s) => s.id);
  const { data: exerciseRowsForLock } = existingSessionIds.length
    ? await supabase
        .from("planned_exercises")
        .select("id, planned_session_id")
        .in("planned_session_id", existingSessionIds)
    : { data: [] };
  const exerciseIdsForLock = (exerciseRowsForLock ?? []).map((e) => e.id);
  const { data: setsForLock } = exerciseIdsForLock.length
    ? await supabase
        .from("planned_sets")
        .select("planned_exercise_id, done_at")
        .in("planned_exercise_id", exerciseIdsForLock)
    : { data: [] };

  const sessionsWithDoneSet = new Set(
    (exerciseRowsForLock ?? [])
      .filter((ex) => (setsForLock ?? []).some((s) => s.planned_exercise_id === ex.id && s.done_at))
      .map((ex) => ex.planned_session_id)
  );

  const existingByDay = new Map((existingSessions ?? []).map((s) => [s.day_of_week, s]));

  const allExerciseIds = [
    ...new Set(
      days
        .filter((d) => d.kind === "session")
        .flatMap((d) => (d.exercises ?? []).map((e) => e.exerciseId))
    ),
  ];
  const { data: exerciseRows } = allExerciseIds.length
    ? await supabase.from("exercises").select("id, unlock_type, unlock_threshold").in("id", allExerciseIds)
    : { data: [] };
  const exerciseById = new Map((exerciseRows ?? []).map((e) => [e.id, e]));

  for (const day of days) {
    const existing = existingByDay.get(day.dayOfWeek);
    const locked = existing
      ? dayIsLocked(existing.is_rest_day, existing.completed_at, sessionsWithDoneSet.has(existing.id))
      : false;
    if (locked) continue;

    if (existing) {
      await supabase.from("planned_sessions").delete().eq("id", existing.id);
    }

    if (day.kind === "unset") continue;

    const { data: sessionRow, error: sessionError } = await supabase
      .from("planned_sessions")
      .insert({
        weekly_plan_id: planId,
        user_id: user.id,
        label: day.kind === "rest" ? "Repos" : day.label,
        sort_order: day.dayOfWeek,
        day_of_week: day.dayOfWeek,
        is_rest_day: day.kind === "rest",
      })
      .select("id")
      .single();

    if (sessionError || !sessionRow) {
      return { ok: false, error: "Échec de l'enregistrement d'un jour." };
    }

    if (day.kind === "session") {
      for (let j = 0; j < (day.exercises ?? []).length; j++) {
        const planned = day.exercises![j];
        const exercise = exerciseById.get(planned.exerciseId);
        if (!exercise) continue;
        const targetSets = Math.max(1, Math.floor(Number(planned.targetSets) || 1));

        const { data: exerciseRow, error: plannedExError } = await supabase
          .from("planned_exercises")
          .insert({
            planned_session_id: sessionRow.id,
            user_id: user.id,
            exercise_id: exercise.id,
            target_sets: targetSets,
            target_performance: exercise.unlock_threshold,
            sort_order: j,
          })
          .select("id")
          .single();

        if (plannedExError || !exerciseRow) {
          return { ok: false, error: "Échec de la création d'un exercice planifié." };
        }

        const setRows = Array.from({ length: targetSets }, (_, k) => ({
          planned_exercise_id: exerciseRow.id,
          user_id: user.id,
          set_number: k + 1,
        }));

        const { error: setsError } = await supabase.from("planned_sets").insert(setRows);
        if (setsError) {
          return { ok: false, error: "Échec de la création des séries planifiées." };
        }
      }
    }
  }

  revalidatePath("/plan");
  revalidatePath(`/plan/week/${weekStart}/edit`);
  return { ok: true };
}

/** Clones the current week's plan into next week — refuses if next week already has one. */
export async function copyWeekToNextWeek(): Promise<CreatePlanResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const currentWeekStart = getWeekStart();
  const nextWeekStart = getWeekStart(new Date(Date.now() + 7 * 86_400_000));

  const { data: currentPlan } = await supabase
    .from("weekly_plans")
    .select("id")
    .eq("user_id", user.id)
    .eq("week_start", currentWeekStart)
    .maybeSingle();
  if (!currentPlan) return { ok: false, error: "Aucun plan à copier pour la semaine courante." };

  const { data: nextPlanExisting } = await supabase
    .from("weekly_plans")
    .select("id")
    .eq("user_id", user.id)
    .eq("week_start", nextWeekStart)
    .maybeSingle();
  if (nextPlanExisting) return { ok: false, error: "Un plan existe déjà pour la semaine prochaine." };

  const { data: sessions } = await supabase
    .from("planned_sessions")
    .select("id, label, sort_order, day_of_week, is_rest_day")
    .eq("weekly_plan_id", currentPlan.id);
  if (!sessions || sessions.length === 0) return { ok: false, error: "Rien à copier." };

  const sessionIds = sessions.map((s) => s.id);
  const { data: exerciseRows } = sessionIds.length
    ? await supabase
        .from("planned_exercises")
        .select("planned_session_id, exercise_id, target_sets, target_performance, sort_order")
        .in("planned_session_id", sessionIds)
    : { data: [] };

  const { data: newPlan, error: newPlanError } = await supabase
    .from("weekly_plans")
    .insert({ user_id: user.id, week_start: nextWeekStart })
    .select("id")
    .single();
  if (newPlanError || !newPlan) return { ok: false, error: "Échec de la copie." };

  for (const s of sessions) {
    const { data: newSession, error: newSessionError } = await supabase
      .from("planned_sessions")
      .insert({
        weekly_plan_id: newPlan.id,
        user_id: user.id,
        label: s.label,
        sort_order: s.sort_order,
        day_of_week: s.day_of_week,
        is_rest_day: s.is_rest_day,
      })
      .select("id")
      .single();
    if (newSessionError || !newSession) return { ok: false, error: "Échec de la copie d'un jour." };

    const exercisesForSession = (exerciseRows ?? []).filter((e) => e.planned_session_id === s.id);
    for (const ex of exercisesForSession) {
      const { data: newEx, error: newExError } = await supabase
        .from("planned_exercises")
        .insert({
          planned_session_id: newSession.id,
          user_id: user.id,
          exercise_id: ex.exercise_id,
          target_sets: ex.target_sets,
          target_performance: ex.target_performance,
          sort_order: ex.sort_order,
        })
        .select("id")
        .single();
      if (newExError || !newEx) return { ok: false, error: "Échec de la copie d'un exercice." };

      const setRows = Array.from({ length: ex.target_sets }, (_, k) => ({
        planned_exercise_id: newEx.id,
        user_id: user.id,
        set_number: k + 1,
      }));
      const { error: setsError } = await supabase.from("planned_sets").insert(setRows);
      if (setsError) return { ok: false, error: "Échec de la copie des séries." };
    }
  }

  revalidatePath("/plan");
  return { ok: true };
}

async function loadExerciseForPerformance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  exerciseId: string
): Promise<Exercise | null> {
  const { data, error } = await supabase
    .from("exercises")
    .select("id, family_id, slug, name, tier, unlock_type, unlock_threshold, xp_coefficient")
    .eq("id", exerciseId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    familyId: data.family_id,
    slug: data.slug,
    name: data.name,
    tier: data.tier,
    unlockType: data.unlock_type,
    unlockThreshold: data.unlock_threshold,
    xpCoefficient: Number(data.xp_coefficient),
  };
}

/** True once every planned_set under this planned_session has done_at set. */
async function isSessionFullyDone(
  supabase: Awaited<ReturnType<typeof createClient>>,
  plannedSessionId: string
): Promise<boolean> {
  const { data: exerciseRows } = await supabase
    .from("planned_exercises")
    .select("id")
    .eq("planned_session_id", plannedSessionId);

  const exerciseIds = (exerciseRows ?? []).map((e) => e.id);
  if (exerciseIds.length === 0) return false;

  const { data: setRows } = await supabase
    .from("planned_sets")
    .select("done_at")
    .in("planned_exercise_id", exerciseIds);

  return (setRows ?? []).length > 0 && (setRows ?? []).every((s) => s.done_at !== null);
}

export interface ValidateSetResult extends LogSessionResult {
  sessionFinalized?: boolean;
  bonusXp?: number;
  perfectWeekBonusXp?: number;
}

/** Validates one planned set: logs sets=1 at the exercise's target performance. */
export async function validateSet(plannedSetId: string): Promise<ValidateSetResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: setRow, error: setError } = await supabase
    .from("planned_sets")
    .select("id, planned_exercise_id, done_at")
    .eq("id", plannedSetId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (setError || !setRow) return { ok: false, error: "Série introuvable." };
  if (setRow.done_at) return { ok: false, error: "Série déjà validée." };

  const { data: plannedExercise, error: plannedExError } = await supabase
    .from("planned_exercises")
    .select("id, planned_session_id, exercise_id, target_performance")
    .eq("id", setRow.planned_exercise_id)
    .maybeSingle();

  if (plannedExError || !plannedExercise) return { ok: false, error: "Exercice planifié introuvable." };

  const exercise = await loadExerciseForPerformance(supabase, plannedExercise.exercise_id);
  if (!exercise) return { ok: false, error: "Exercice introuvable." };

  const performance =
    exercise.unlockType === "reps"
      ? { repsPerSet: plannedExercise.target_performance }
      : { durationSeconds: plannedExercise.target_performance };

  const result = await logExercisePerformance(supabase, user.id, exercise, 1, performance);
  if (!result.ok) return result;

  await supabase
    .from("planned_sets")
    .update({ done_at: new Date().toISOString(), session_id: result.sessionId })
    .eq("id", plannedSetId);

  revalidatePath("/log");
  return await maybeFinalizeAfterSet(supabase, plannedExercise.planned_session_id, result);
}

/** Shortcut: validates every remaining set of an exercise in one go. */
export async function validateRemainingSets(plannedExerciseId: string): Promise<ValidateSetResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: plannedExercise, error: plannedExError } = await supabase
    .from("planned_exercises")
    .select("id, planned_session_id, exercise_id, target_performance")
    .eq("id", plannedExerciseId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (plannedExError || !plannedExercise) return { ok: false, error: "Exercice planifié introuvable." };

  const { data: remainingSets, error: remainingError } = await supabase
    .from("planned_sets")
    .select("id")
    .eq("planned_exercise_id", plannedExerciseId)
    .is("done_at", null);

  if (remainingError) return { ok: false, error: "Échec de la lecture des séries." };
  if (!remainingSets || remainingSets.length === 0) {
    return { ok: false, error: "Aucune série restante." };
  }

  const exercise = await loadExerciseForPerformance(supabase, plannedExercise.exercise_id);
  if (!exercise) return { ok: false, error: "Exercice introuvable." };

  const performance =
    exercise.unlockType === "reps"
      ? { repsPerSet: plannedExercise.target_performance }
      : { durationSeconds: plannedExercise.target_performance };

  const result = await logExercisePerformance(
    supabase,
    user.id,
    exercise,
    remainingSets.length,
    performance
  );
  if (!result.ok) return result;

  await supabase
    .from("planned_sets")
    .update({ done_at: new Date().toISOString(), session_id: result.sessionId })
    .in("id", remainingSets.map((s) => s.id));

  revalidatePath("/log");
  return await maybeFinalizeAfterSet(supabase, plannedExercise.planned_session_id, result);
}

async function maybeFinalizeAfterSet(
  supabase: Awaited<ReturnType<typeof createClient>>,
  plannedSessionId: string,
  result: LogSessionResult
): Promise<ValidateSetResult> {
  if (!(await isSessionFullyDone(supabase, plannedSessionId))) {
    return result;
  }
  const finalized = await finalizePlannedSessionInternal(supabase, plannedSessionId);
  return { ...result, ...finalized, sessionFinalized: true };
}

export interface FinalizeResult {
  ok: boolean;
  error?: string;
  fullCompletion?: boolean;
  bonusXp?: number;
  perfectWeekBonusXp?: number;
}

/** User-triggered "Terminer la séance" — works at any completion level (training days only). */
export async function finalizePlannedSession(plannedSessionId: string): Promise<FinalizeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: sessionRow } = await supabase
    .from("planned_sessions")
    .select("id")
    .eq("id", plannedSessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!sessionRow) return { ok: false, error: "Séance planifiée introuvable." };

  return finalizePlannedSessionInternal(supabase, plannedSessionId);
}

/** For a rest day: marks it done and grants the flat rest-day XP bonus. */
export async function markRestDayDone(plannedSessionId: string): Promise<FinalizeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: sessionRow } = await supabase
    .from("planned_sessions")
    .select("id, is_rest_day")
    .eq("id", plannedSessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!sessionRow) return { ok: false, error: "Jour introuvable." };
  if (!sessionRow.is_rest_day) return { ok: false, error: "Ce n'est pas un jour de repos." };

  return finalizePlannedSessionInternal(supabase, plannedSessionId);
}

async function finalizePlannedSessionInternal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  plannedSessionId: string
): Promise<FinalizeResult> {
  const { data: sessionRow, error: sessionError } = await supabase
    .from("planned_sessions")
    .select("id, weekly_plan_id, user_id, is_rest_day, completed_at, full_completion")
    .eq("id", plannedSessionId)
    .maybeSingle();

  if (sessionError || !sessionRow) return { ok: false, error: "Séance planifiée introuvable." };
  if (sessionRow.completed_at) return { ok: true, fullCompletion: sessionRow.full_completion };

  const userId = sessionRow.user_id;

  if (sessionRow.is_rest_day) {
    await supabase
      .from("planned_sessions")
      .update({ completed_at: new Date().toISOString(), full_completion: true })
      .eq("id", plannedSessionId);

    await supabase.from("xp_bonuses").insert({
      user_id: userId,
      amount: REST_DAY_BONUS,
      source: "rest_day",
      planned_session_id: plannedSessionId,
      weekly_plan_id: sessionRow.weekly_plan_id,
    });

    const perfectWeekBonusXp = await maybeAwardPerfectWeek(supabase, userId, sessionRow.weekly_plan_id);

    revalidatePath("/plan");
    revalidatePath("/log");
    revalidatePath("/dashboard");
    revalidatePath("/stats");

    return { ok: true, fullCompletion: true, bonusXp: REST_DAY_BONUS, perfectWeekBonusXp };
  }

  const fullCompletion = await isSessionFullyDone(supabase, plannedSessionId);

  await supabase
    .from("planned_sessions")
    .update({ completed_at: new Date().toISOString(), full_completion: fullCompletion })
    .eq("id", plannedSessionId);

  let bonusXp: number | undefined;
  let perfectWeekBonusXp: number | undefined;

  if (fullCompletion) {
    const { data: exerciseRows } = await supabase
      .from("planned_exercises")
      .select("id")
      .eq("planned_session_id", plannedSessionId);
    const exerciseIds = (exerciseRows ?? []).map((e) => e.id);

    const { data: setRows } = exerciseIds.length
      ? await supabase
          .from("planned_sets")
          .select("session_id")
          .in("planned_exercise_id", exerciseIds)
      : { data: [] };

    const sessionIds = [
      ...new Set((setRows ?? []).map((s) => s.session_id).filter((id): id is string => Boolean(id))),
    ];

    const { data: xpRows } = sessionIds.length
      ? await supabase.from("sessions").select("xp_earned").in("id", sessionIds)
      : { data: [] };

    const totalXp = (xpRows ?? []).reduce((sum, r) => sum + Number(r.xp_earned), 0);
    bonusXp = Math.round(totalXp * SESSION_COMPLETE_BONUS_RATE);

    if (bonusXp > 0) {
      await supabase.from("xp_bonuses").insert({
        user_id: userId,
        amount: bonusXp,
        source: "session_complete",
        planned_session_id: plannedSessionId,
        weekly_plan_id: sessionRow.weekly_plan_id,
      });
    }

    perfectWeekBonusXp = await maybeAwardPerfectWeek(supabase, userId, sessionRow.weekly_plan_id);
  }

  revalidatePath("/plan");
  revalidatePath("/log");
  revalidatePath("/dashboard");
  revalidatePath("/stats");

  return { ok: true, fullCompletion, bonusXp, perfectWeekBonusXp };
}

async function maybeAwardPerfectWeek(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  weeklyPlanId: string
): Promise<number | undefined> {
  const { data: planRow } = await supabase
    .from("weekly_plans")
    .select("id, perfect_week_awarded_at")
    .eq("id", weeklyPlanId)
    .maybeSingle();

  if (!planRow || planRow.perfect_week_awarded_at) return undefined;

  const { data: allSessions } = await supabase
    .from("planned_sessions")
    .select("full_completion")
    .eq("weekly_plan_id", weeklyPlanId);

  const allComplete = (allSessions ?? []).length > 0 && (allSessions ?? []).every((s) => s.full_completion);
  if (!allComplete) return undefined;

  await supabase.from("xp_bonuses").insert({
    user_id: userId,
    amount: PERFECT_WEEK_BONUS,
    source: "perfect_week",
    weekly_plan_id: weeklyPlanId,
  });
  await supabase
    .from("weekly_plans")
    .update({ perfect_week_awarded_at: new Date().toISOString() })
    .eq("id", weeklyPlanId);

  return PERFECT_WEEK_BONUS;
}
