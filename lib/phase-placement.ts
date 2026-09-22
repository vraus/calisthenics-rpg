import type { Phase } from "./types";

/**
 * Placement logic for the first-login onboarding wizard. No UI or Supabase
 * dependency on purpose (same design as lib/xp.ts, lib/streak.ts): asks,
 * from the hardest phase down, "can you already do this phase's
 * prerequisites?" and starts the player at the first phase they say yes to.
 * A phase with no prerequisites (phase 1) is always a safe fallback, so this
 * never fails to resolve a phase as long as one such phase exists.
 */

export interface PhasePrerequisiteAnswer {
  phaseId: string;
  meetsPrerequisites: boolean;
}

type PlacementPhase = Pick<Phase, "id" | "sortOrder" | "prerequisitesText" | "name">;

export function pickStartingPhase(
  phases: PlacementPhase[],
  answers: PhasePrerequisiteAnswer[]
): PlacementPhase {
  if (phases.length === 0) {
    throw new Error("pickStartingPhase: no phase to place the player into");
  }

  const answerByPhase = new Map(answers.map((a) => [a.phaseId, a.meetsPrerequisites]));
  const hardestFirst = [...phases].sort((a, b) => b.sortOrder - a.sortOrder);

  for (const phase of hardestFirst) {
    if (!phase.prerequisitesText) return phase; // no prerequisites: everyone qualifies
    if (answerByPhase.get(phase.id)) return phase;
  }

  // No phase without prerequisites exists and no "yes" answer was given -
  // fall back to the easiest phase.
  return hardestFirst[hardestFirst.length - 1];
}

/** The phases the wizard needs to ask about, hardest first, stopping at (and including) the first phase with no prerequisites. */
export function phasesToAskAbout(phases: PlacementPhase[]): PlacementPhase[] {
  const hardestFirst = [...phases].sort((a, b) => b.sortOrder - a.sortOrder);
  const result: PlacementPhase[] = [];
  for (const phase of hardestFirst) {
    result.push(phase);
    if (!phase.prerequisitesText) break;
  }
  return result;
}
