import { describe, expect, it } from "vitest";
import { evaluateNewBadges, type BadgeContext } from "./badges";

function baseContext(overrides: Partial<BadgeContext> = {}): BadgeContext {
  return {
    sessionCount: 0,
    currentStreak: 0,
    globalLevel: 1,
    masteredExerciseSlugs: new Set(),
    masteredSlugsByFamily: {},
    totalExercisesByFamily: {},
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

  it("unlocks jambes-de-fer only once every leg exercise is mastered", () => {
    const ctx = baseContext({
      totalExercisesByFamily: { jambes: 2 },
      masteredSlugsByFamily: { jambes: new Set(["squats-corps-de-poids"]) },
    });
    expect(evaluateNewBadges(ctx, new Set())).not.toContain("jambes-de-fer");

    const ctxComplete = baseContext({
      totalExercisesByFamily: { jambes: 2 },
      masteredSlugsByFamily: {
        jambes: new Set(["squats-corps-de-poids", "squats-bulgares"]),
      },
    });
    expect(evaluateNewBadges(ctxComplete, new Set())).toContain("jambes-de-fer");
  });
});
