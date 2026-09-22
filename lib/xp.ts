import type { Exercise, ExerciseFamily, SessionInput, UserProgress } from "./types";

/**
 * Core XP engine. No UI or Supabase dependency on purpose: this module is
 * meant to be imported as-is by a future MCP server exposing the same
 * `log_session` / `get_progress` logic, without duplicating the rules here.
 *
 * Every function here operates on skill-tree exercises (familyId/tier set,
 * unlockType/unlockThreshold/xpCoefficient set) - never on the family-less
 * circuit-only movements introduced alongside `Exercise.variantOfId`, which
 * have no mastery/XP concept. Callers are expected to only pass exercises
 * read from a family (getExercisesByFamilySlug/getFamiliesWithExercises).
 */

export class InvalidSessionError extends Error {}

/**
 * XP earned for one logged session, given the exercise it was performed on.
 * Reps-based exercises: sets * reps * coefficient.
 * Duration-based (isometric) exercises: sets * duration_seconds * coefficient.
 */
export function computeSessionXp(
  session: SessionInput,
  exercise: Exercise
): number {
  if (session.sets <= 0) {
    throw new InvalidSessionError("sets must be > 0");
  }

  if (exercise.unlockType === "reps") {
    if (!session.repsPerSet || session.repsPerSet <= 0) {
      throw new InvalidSessionError(
        "repsPerSet is required for a reps-based exercise"
      );
    }
    return round2(session.sets * session.repsPerSet * exercise.xpCoefficient!);
  }

  if (!session.durationSeconds || session.durationSeconds <= 0) {
    throw new InvalidSessionError(
      "durationSeconds is required for a duration-based exercise"
    );
  }
  return round2(session.sets * session.durationSeconds * exercise.xpCoefficient!);
}

/**
 * Whether logging this session's performance (reps per set, or duration)
 * meets the unlock criterion for the *next* tier's exercise, independent of
 * cumulative XP. Unlocking a tier is about demonstrating the movement, not
 * about volume: hitting the threshold once is what counts.
 */
export function meetsUnlockThreshold(
  session: SessionInput,
  exercise: Exercise
): boolean {
  if (exercise.unlockType === "reps") {
    return (session.repsPerSet ?? 0) >= exercise.unlockThreshold!;
  }
  return (session.durationSeconds ?? 0) >= exercise.unlockThreshold!;
}

/** Cumulative XP required to *reach* a given level (level 1 = 0 XP). */
export function xpThresholdForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(50 * Math.pow(level - 1, 1.6));
}

export interface LevelInfo {
  level: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
  nextLevelThreshold: number;
}

/**
 * Level derived from cumulative XP, on a super-linear curve (each level
 * costs more than the last) rather than a flat XP-per-level rate.
 */
export function levelFromXp(cumulativeXp: number): LevelInfo {
  let level = 1;
  while (xpThresholdForLevel(level + 1) <= cumulativeXp) {
    level += 1;
  }
  const currentThreshold = xpThresholdForLevel(level);
  const nextLevelThreshold = xpThresholdForLevel(level + 1);
  return {
    level,
    xpIntoLevel: round2(cumulativeXp - currentThreshold),
    xpToNextLevel: round2(nextLevelThreshold - cumulativeXp),
    nextLevelThreshold,
  };
}

export interface TreeNodeState extends Exercise {
  unlocked: boolean;
  mastered: boolean;
  xpInExercise: number;
}

/**
 * Derives the *recommended* progression state for every exercise in a
 * family: tier 1 is always "unlocked", and each subsequent tier unlocks
 * once the previous tier's exercise has been mastered (see
 * meetsUnlockThreshold). This is purely indicative for the tree view - it
 * no longer gates what can be logged (see app/log/log-form.tsx), so someone
 * who's already strong enough can log a high-tier exercise directly.
 */
export function buildFamilyTree(
  exercises: Exercise[],
  progress: Pick<UserProgress, "exerciseId" | "xpInExercise" | "mastered">[]
): TreeNodeState[] {
  const progressByExercise = new Map(progress.map((p) => [p.exerciseId, p]));
  const sorted = [...exercises].sort((a, b) => a.tier! - b.tier!);

  let previousMastered = true; // tier 1 is always unlocked
  return sorted.map((exercise) => {
    const p = progressByExercise.get(exercise.id);
    const node: TreeNodeState = {
      ...exercise,
      unlocked: previousMastered,
      mastered: p?.mastered ?? false,
      xpInExercise: p?.xpInExercise ?? 0,
    };
    previousMastered = node.mastered;
    return node;
  });
}

/** Level for a single exercise family, from that family's accumulated XP. */
export function familyLevel(
  progressForFamily: Pick<UserProgress, "xpInExercise">[]
): LevelInfo {
  const total = progressForFamily.reduce((sum, p) => sum + p.xpInExercise, 0);
  return levelFromXp(total);
}

/** Global level, from XP accumulated across every exercise. */
export function globalLevel(allProgress: Pick<UserProgress, "xpInExercise">[]): LevelInfo {
  const total = allProgress.reduce((sum, p) => sum + p.xpInExercise, 0);
  return levelFromXp(total);
}

export interface MasteredFamilySummary {
  familyName: string;
  masteredCount: number;
  totalCount: number;
  masteredNames: string[];
}

/**
 * Groups mastered exercises by family, for the profile page (own and
 * others' - the "quels exos ils maîtrisent" view).
 */
export function buildMasteredByFamily(
  familiesWithExercises: { family: ExerciseFamily; exercises: Exercise[] }[],
  progress: Pick<UserProgress, "exerciseId" | "mastered">[]
): MasteredFamilySummary[] {
  const masteredIds = new Set(progress.filter((p) => p.mastered).map((p) => p.exerciseId));

  return familiesWithExercises.map(({ family, exercises }) => {
    const mastered = exercises.filter((e) => masteredIds.has(e.id));
    return {
      familyName: family.name,
      masteredCount: mastered.length,
      totalCount: exercises.length,
      masteredNames: mastered.map((e) => e.name),
    };
  });
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
