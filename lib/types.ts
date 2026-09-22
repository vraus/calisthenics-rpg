export type UnlockType = "reps" | "duration";

/** Zone de progression (3 aujourd'hui) regroupant plusieurs compétences techniques. */
export interface Phase {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  /** Texte des prérequis affiché pendant l'onboarding de placement. */
  prerequisitesText?: string;
}

export interface ExerciseFamily {
  id: string;
  slug: string;
  name: string;
  statTag: string;
  sortOrder: number;
  phaseId?: string;
}

/**
 * Un noeud de l'arbre de compétences (familyId + tier renseignés), OU un
 * mouvement de circuit sans progression technique (familyId/tier absents —
 * ex. burpee, jumping jack), OU la variante d'un autre exercice de circuit
 * (variantOfId renseigné, ex. "Burpee sans pompes").
 */
export interface Exercise {
  id: string;
  familyId?: string;
  slug: string;
  name: string;
  tier?: number;
  unlockType?: UnlockType;
  unlockThreshold?: number;
  xpCoefficient?: number;
  /** Paragraphe affiché dans la dialogue de niveau de l'arbre de compétences. */
  description?: string;
  variantOfId?: string;
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
  /**
   * Index de la partie à laquelle cet exercice appartient (0 par défaut =
   * partie implicite unique, utilisant PlannedSession.rounds/
   * restBetweenRoundsSeconds). Une séance construite depuis un circuit à
   * plusieurs parties (ex. "Push A" p1/p2) a des exercices répartis sur
   * plusieurs entrées de PlannedSession.parts avec des réglages différents.
   */
  partIndex: number;
  sets: PlannedSet[];
}

/** Un groupe d'exercices d'une séance planifiée avec son propre nombre de tours/pause (ex. p1/p2 d'un circuit). */
export interface PlannedSessionPart {
  id: string;
  partIndex: number;
  label?: string;
  rounds: number;
  restBetweenRoundsSeconds: number;
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
  /** Index de la partie à laquelle appartient cet exercice — voir SessionTemplatePart. */
  partIndex: number;
}

/** Une partie d'un circuit (ex. "p1"/"p2" de "Push A"), avec son propre nombre de tours/pause. */
export interface SessionTemplatePart {
  id: string;
  partIndex: number;
  label?: string;
  rounds: number;
  restBetweenRoundsSeconds: number;
}

export interface SessionTemplate {
  id: string;
  slug: string;
  name: string;
  phaseId?: string;
  /** Parties du circuit (p1/p2...), chacune avec son nombre de tours/pause. La plupart des circuits n'en ont qu'une. */
  parts: SessionTemplatePart[];
  /** Vue à plat de tous les exercices, triés par (partIndex, sortOrder) — pratique pour l'affichage simple actuel. */
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
  /**
   * Parties explicites de cette séance (posées quand elle a été construite
   * depuis un circuit à plusieurs parties). Vide pour l'immense majorité des
   * séances aujourd'hui, qui utilisent la partie implicite unique
   * (rounds/restBetweenRoundsSeconds ci-dessus, PlannedExercise.partIndex = 0).
   */
  parts: PlannedSessionPart[];
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
  currentPhaseId?: string;
  onboardingCompletedAt?: string;
  /** Zone dont le thème est affiché, si le joueur en a choisi un manuellement. `undefined` = suivre currentPhaseId. */
  themeZoneId?: string;
}

export interface ProfileSummary extends Profile {
  level: number;
}
