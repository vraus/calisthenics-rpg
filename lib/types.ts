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
