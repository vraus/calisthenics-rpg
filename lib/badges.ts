/**
 * Badge unlock rules. Pure logic, no Supabase dependency (same spirit as
 * xp.ts) - the caller (app/log/actions.ts, app/tree/actions.ts) assembles
 * the context from already-fetched data and persists newly-earned badges.
 */

export interface BadgeContext {
  sessionCount: number;
  currentStreak: number;
  globalLevel: number;
  /** Exercise slugs the user has mastered, across every family. */
  masteredExerciseSlugs: Set<string>;
  /** Mastered exercise slugs, grouped by family slug. */
  masteredSlugsByFamily: Record<string, Set<string>>;
  /** Total exercise count per family slug, for "clear the whole family" badges. */
  totalExercisesByFamily: Record<string, number>;
  /** Phase slugs the player has fully progressed past (profiles.current_phase_id is beyond them). */
  completedPhaseSlugs: Set<string>;
}

export interface BadgeDefinition {
  slug: string;
  check: (ctx: BadgeContext) => boolean;
}

/** Meta badges - not tied to a specific compétence technique or phase, so listed once and for all here. */
export const STATIC_BADGE_DEFINITIONS: BadgeDefinition[] = [
  { slug: "premiere-seance", check: (c) => c.sessionCount >= 1 },
  { slug: "regularite-7-jours", check: (c) => c.currentStreak >= 7 },
  { slug: "un-mois-de-suite", check: (c) => c.currentStreak >= 30 },
  { slug: "centurion", check: (c) => c.sessionCount >= 100 },
  { slug: "premier-muscle-up", check: (c) => c.masteredExerciseSlugs.has("muscle-up-strict") },
  { slug: "premier-front-lever", check: (c) => c.masteredExerciseSlugs.has("front-lever-strict") },
  { slug: "niveau-10-global", check: (c) => c.globalLevel >= 10 },
  {
    slug: "touche-a-tout",
    check: (c) =>
      Object.keys(c.totalExercisesByFamily).length > 0 &&
      Object.keys(c.totalExercisesByFamily).every(
        (familySlug) => (c.masteredSlugsByFamily[familySlug]?.size ?? 0) >= 1
      ),
  },
];

export function familyMasteryBadgeSlug(familySlug: string): string {
  return `maitrise-${familySlug}`;
}

/** One badge per compétence technique (family), earned once every one of its levels is mastered. */
export function buildFamilyBadgeDefinitions(familySlugs: string[]): BadgeDefinition[] {
  return familySlugs.map((familySlug) => ({
    slug: familyMasteryBadgeSlug(familySlug),
    check: (c: BadgeContext) => {
      const total = c.totalExercisesByFamily[familySlug];
      return Boolean(total) && (c.masteredSlugsByFamily[familySlug]?.size ?? 0) >= total;
    },
  }));
}

export function phaseCompleteBadgeSlug(phaseSlug: string): string {
  return `phase-${phaseSlug}-complete`;
}

/** One badge per phase, earned once the player has moved past it (see lib/phase-progress.ts). */
export function buildPhaseBadgeDefinitions(phaseSlugs: string[]): BadgeDefinition[] {
  return phaseSlugs.map((phaseSlug) => ({
    slug: phaseCompleteBadgeSlug(phaseSlug),
    check: (c: BadgeContext) => c.completedPhaseSlugs.has(phaseSlug),
  }));
}

/** Slugs of badges the context newly qualifies for, excluding ones already earned. `extraDefinitions` = the dynamic family/phase badges, built per-call from the current DB content. */
export function evaluateNewBadges(
  ctx: BadgeContext,
  alreadyEarnedSlugs: Set<string>,
  extraDefinitions: BadgeDefinition[] = []
): string[] {
  return [...STATIC_BADGE_DEFINITIONS, ...extraDefinitions]
    .filter((badge) => !alreadyEarnedSlugs.has(badge.slug) && badge.check(ctx))
    .map((badge) => badge.slug);
}
