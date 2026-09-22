/**
 * Phase-advancement rule. No UI or Supabase dependency on purpose (same
 * design as lib/xp.ts, lib/badges.ts): a phase is complete once every
 * compétence technique of that phase is maxed out (top tier mastered — via
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
