import { describe, expect, it } from "vitest";
import {
  buildFamilyBadgeDefinitions,
  buildPhaseBadgeDefinitions,
  computeBadgeProgress,
  evaluateNewBadges,
  familyMasteryBadgeSlug,
  phaseCompleteBadgeSlug,
  type BadgeContext,
} from "./badges";

function baseContext(overrides: Partial<BadgeContext> = {}): BadgeContext {
  return {
    sessionCount: 0,
    currentStreak: 0,
    globalLevel: 1,
    masteredExerciseSlugs: new Set(),
    masteredSlugsByFamily: {},
    totalExercisesByFamily: {},
    completedPhaseSlugs: new Set(),
    ...overrides,
  };
}

describe("evaluateNewBadges", () => {
  it("returns nothing when no criteria are met", () => {
    expect(evaluateNewBadges(baseContext(), new Set())).toEqual([]);
  });

  it("unlocks premiere-seance on the first logged session", () => {
    const result = evaluateNewBadges(baseContext({ sessionCount: 1 }), new Set());
    expect(result).toContain("premiere-seance");
  });

  it("does not re-award a badge already earned", () => {
    const result = evaluateNewBadges(
      baseContext({ sessionCount: 1 }),
      new Set(["premiere-seance"])
    );
    expect(result).not.toContain("premiere-seance");
  });

  it("unlocks streak badges at their thresholds", () => {
    expect(evaluateNewBadges(baseContext({ currentStreak: 7 }), new Set())).toContain(
      "regularite-7-jours"
    );
    expect(evaluateNewBadges(baseContext({ currentStreak: 30 }), new Set())).toEqual(
      expect.arrayContaining(["regularite-7-jours", "un-mois-de-suite"])
    );
    expect(evaluateNewBadges(baseContext({ currentStreak: 6 }), new Set())).toEqual([]);
  });

  it("unlocks touche-a-tout only once every family has a mastered exercise", () => {
    const ctx = baseContext({
      totalExercisesByFamily: { tractions: 10, jambes: 5 },
      masteredSlugsByFamily: { tractions: new Set(["dead-hang"]) },
    });
    expect(evaluateNewBadges(ctx, new Set())).not.toContain("touche-a-tout");

    const ctxComplete = baseContext({
      totalExercisesByFamily: { tractions: 10, jambes: 5 },
      masteredSlugsByFamily: {
        tractions: new Set(["dead-hang"]),
        jambes: new Set(["squats-corps-de-poids"]),
      },
    });
    expect(evaluateNewBadges(ctxComplete, new Set())).toContain("touche-a-tout");
  });
});

describe("buildFamilyBadgeDefinitions", () => {
  it("unlocks a family's mastery badge only once every level of it is mastered", () => {
    const defs = buildFamilyBadgeDefinitions(["jambes"]);
    const slug = familyMasteryBadgeSlug("jambes");

    const partial = baseContext({
      totalExercisesByFamily: { jambes: 2 },
      masteredSlugsByFamily: { jambes: new Set(["squats-corps-de-poids"]) },
    });
    expect(evaluateNewBadges(partial, new Set(), defs)).not.toContain(slug);

    const complete = baseContext({
      totalExercisesByFamily: { jambes: 2 },
      masteredSlugsByFamily: { jambes: new Set(["squats-corps-de-poids", "squats-bulgares"]) },
    });
    expect(evaluateNewBadges(complete, new Set(), defs)).toContain(slug);
  });

  it("doesn't unlock a badge for a family with no exercises at all", () => {
    const defs = buildFamilyBadgeDefinitions(["vide"]);
    expect(evaluateNewBadges(baseContext(), new Set(), defs)).not.toContain(familyMasteryBadgeSlug("vide"));
  });
});

describe("buildPhaseBadgeDefinitions", () => {
  it("unlocks a phase's badge once the player has moved past it", () => {
    const defs = buildPhaseBadgeDefinitions(["phase-1-fondations"]);
    const slug = phaseCompleteBadgeSlug("phase-1-fondations");

    expect(evaluateNewBadges(baseContext(), new Set(), defs)).not.toContain(slug);
    expect(
      evaluateNewBadges(
        baseContext({ completedPhaseSlugs: new Set(["phase-1-fondations"]) }),
        new Set(),
        defs
      )
    ).toContain(slug);
  });
});

describe("computeBadgeProgress", () => {
  it("computes a family mastery badge's percent from masteredCount/totalCount", () => {
    const ctx = baseContext({
      totalExercisesByFamily: { tractions: 4 },
      masteredSlugsByFamily: { tractions: new Set(["a", "b"]) },
    });
    const entries = computeBadgeProgress(ctx, ["tractions"], {});
    const entry = entries.find((e) => e.slug === familyMasteryBadgeSlug("tractions"));
    expect(entry?.percent).toBe(50);
  });

  it("passes through a phase's percent from phasePercentBySlug", () => {
    const entries = computeBadgeProgress(baseContext(), [], { "phase-1-fondations": 75 });
    const entry = entries.find((e) => e.slug === phaseCompleteBadgeSlug("phase-1-fondations"));
    expect(entry?.percent).toBe(75);
  });

  it("clamps centurion's percent at 100 past its threshold", () => {
    const entries = computeBadgeProgress(baseContext({ sessionCount: 150 }), [], {});
    expect(entries.find((e) => e.slug === "centurion")?.percent).toBe(100);
  });
});
