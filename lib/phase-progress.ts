/**
 * Phase-advancement rule. No UI or Supabase dependency on purpose (same
 * design as lib/xp.ts, lib/badges.ts): a phase is complete once every
 * compétence technique of that phase is maxed out (top tier mastered - via
 * cascadeMasterLowerTiers, that already implies every lower tier too) AND
 * every circuit of that phase has been validated at least once.
 */

export interface PhaseCompletionInput {
  /** Top-tier exercise id of each compétence technique (family) in this phase. */
  topTierExerciseIdByFamily: string[];
  masteredExerciseIds: Set<string>;
  /** Every circuit (session_templates.id) of this phase. */
  circuitIds: string[];
  completedCircuitIds: Set<string>;
}

export function isPhaseComplete(input: PhaseCompletionInput): boolean {
  const allFamiliesMaxed = input.topTierExerciseIdByFamily.every((id) => input.masteredExerciseIds.has(id));
  const allCircuitsDone = input.circuitIds.every((id) => input.completedCircuitIds.has(id));
  return allFamiliesMaxed && allCircuitsDone;
}

/** Same units as isPhaseComplete (maxed families + validated circuits), as a 0-100 percentage instead of a boolean - for the "prochains badges" dashboard widget. */
export function phaseCompletionPercent(input: PhaseCompletionInput): number {
  const totalUnits = input.topTierExerciseIdByFamily.length + input.circuitIds.length;
  if (totalUnits === 0) return 100;
  const doneUnits =
    input.topTierExerciseIdByFamily.filter((id) => input.masteredExerciseIds.has(id)).length +
    input.circuitIds.filter((id) => input.completedCircuitIds.has(id)).length;
  return Math.round((doneUnits / totalUnits) * 100);
}
