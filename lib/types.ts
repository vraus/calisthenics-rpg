export type UnlockType = "reps" | "duration";

export interface ExerciseFamily {
  id: string;
  slug: string;
  name: string;
  statTag: string;
  sortOrder: number;
}

export interface Exercise {
  id: string;
  familyId: string;
  slug: string;
  name: string;
  tier: number;
  unlockType: UnlockType;
  unlockThreshold: number;
  xpCoefficient: number;
}

/** A single logged set of work for one exercise, as entered on the log page. */
export interface SessionInput {
  exerciseId: string;
  sets: number;
  repsPerSet?: number;
  durationSeconds?: number;
}

export interface UserProgress {
  userId: string;
  exerciseId: string;
  xpInExercise: number;
  mastered: boolean;
  masteredAt?: string;
}

export interface PlannedSet {
  id: string;
  setNumber: number;
  doneAt?: string;
}

export interface PlannedExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  exerciseSlug: string;
  unlockType: UnlockType;
  targetSets: number;
  targetPerformance: number;
  /** Repos entre deux séries du même exercice. Défaut : 30s. */
  restBetweenSetsSeconds: number;
  /** Repos entre cet exercice et le suivant. Défaut : 1min. */
  restAfterExerciseSeconds: number;
  sets: PlannedSet[];
}

export type DayKind = "rest" | "session";

/**
 * A reusable, pre-filled exercise circuit (e.g. "HIIT") that a "session" day
 * can be built from in the week editor, as an alternative to a "Custom" day
 * built from scratch. Not a day_kind of its own — just a starting point.
 */
export interface SessionTemplateExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  exerciseSlug: string;
  unlockType: UnlockType;
  targetSets: number;
  targetPerformance: number;
  restBetweenSetsSeconds: number;
  restAfterExerciseSeconds: number;
}

export interface SessionTemplate {
  id: string;
  name: string;
  /** Nombre de fois où le circuit complet est répété. Défaut : 1. */
  rounds: number;
  /** Pause entre deux tours. Défaut : 90s (1min30). */
  restBetweenRoundsSeconds: number;
  exercises: SessionTemplateExercise[];
}

/** 0 = lundi .. 6 = dimanche. Undefined = jour non planifié. */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DAY_LABELS: Record<DayOfWeek, string> = {
  0: "Lundi",
  1: "Mardi",
  2: "Mercredi",
  3: "Jeudi",
  4: "Vendredi",
  5: "Samedi",
  6: "Dimanche",
};

export interface PlannedSession {
  id: string;
  weeklyPlanId: string;
  label: string;
  sortOrder: number;
  dayOfWeek?: DayOfWeek;
  dayKind: DayKind;
  /** Nombre de fois où le circuit complet (tous les exos) est répété. Défaut : 1. */
  rounds: number;
  /** Pause entre deux tours. Défaut : 90s (1min30). */
  restBetweenRoundsSeconds: number;
  completedAt?: string;
  fullCompletion: boolean;
  exercises: PlannedExercise[];
}

export interface WeeklyPlan {
  id: string;
  weekStart: string;
  perfectWeekAwardedAt?: string;
  sessions: PlannedSession[];
}

/** A day with any validated set (or a completed rest day) can't be re-edited. */
export function isDayLocked(session: PlannedSession): boolean {
  if (session.dayKind === "rest") return Boolean(session.completedAt);
  return session.exercises.some((ex) => ex.sets.some((s) => s.doneAt));
}

export interface Profile {
  userId: string;
  username: string;
}

export interface ProfileSummary extends Profile {
  level: number;
}
