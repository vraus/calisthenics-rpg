/**
 * Badge unlock rules. Pure logic, no Supabase dependency (same spirit as
 * xp.ts) — the caller (app/log/actions.ts) assembles the context from
 * already-fetched data and persists newly-earned badges.
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
}

export interface BadgeDefinition {
  slug: string;
  check: (ctx: BadgeContext) => boolean;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  { slug: "premiere-seance", check: (c) => c.sessionCount >= 1 },
  { slug: "regularite-7-jours", check: (c) => c.currentStreak >= 7 },
  { slug: "un-mois-de-suite", check: (c) => c.currentStreak >= 30 },
  { slug: "centurion", check: (c) => c.sessionCount >= 100 },
  {
    slug: "premier-muscle-up",
    check: (c) => c.masteredExerciseSlugs.has("muscle-up"),
  },
  {
    slug: "premier-front-lever",
    check: (c) => c.masteredExerciseSlugs.has("front-lever"),
  },
  { slug: "niveau-10-global", check: (c) => c.globalLevel >= 10 },
  {
    slug: "touche-a-tout",
    check: (c) =>
      Object.keys(c.totalExercisesByFamily).length > 0 &&
      Object.keys(c.totalExercisesByFamily).every(
        (familySlug) => (c.masteredSlugsByFamily[familySlug]?.size ?? 0) >= 1
      ),
  },
  {
    slug: "jambes-de-fer",
    check: (c) => {
      const total = c.totalExercisesByFamily["jambes"];
      if (!total) return false;
      return (c.masteredSlugsByFamily["jambes"]?.size ?? 0) >= total;
    },
  },
];

/** Slugs of badges the context newly qualifies for, excluding ones already earned. */
export function evaluateNewBadges(
  ctx: BadgeContext,
  alreadyEarnedSlugs: Set<string>
): string[] {
  return BADGE_DEFINITIONS.filter(
    (badge) => !alreadyEarnedSlugs.has(badge.slug) && badge.check(ctx)
  ).map((badge) => badge.slug);
}
