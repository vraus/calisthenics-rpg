import { describe, expect, it } from "vitest";
import {
  buildMasteredByFamily,
  computeSessionXp,
  familyLevel,
  globalLevel,
  InvalidSessionError,
  levelFromXp,
  meetsUnlockThreshold,
  xpThresholdForLevel,
} from "./xp";
import type { Exercise, ExerciseFamily } from "./types";

const repsExercise: Exercise = {
  id: "ex-1",
  familyId: "fam-1",
  slug: "traction-stricte",
  name: "Traction stricte",
  tier: 6,
  unlockType: "reps",
  unlockThreshold: 5,
  xpCoefficient: 4,
};

const durationExercise: Exercise = {
  id: "ex-2",
  familyId: "fam-1",
  slug: "dead-hang",
  name: "Dead hang",
  tier: 1,
  unlockType: "duration",
  unlockThreshold: 30,
  xpCoefficient: 0.5,
};

describe("computeSessionXp", () => {
  it("computes reps-based XP as sets * reps * coefficient", () => {
    const xp = computeSessionXp(
      { exerciseId: repsExercise.id, sets: 3, repsPerSet: 5 },
      repsExercise
    );
    expect(xp).toBe(3 * 5 * 4);
  });

  it("computes duration-based XP as sets * duration * coefficient", () => {
    const xp = computeSessionXp(
      { exerciseId: durationExercise.id, sets: 4, durationSeconds: 40 },
      durationExercise
    );
    expect(xp).toBe(4 * 40 * 0.5);
  });

  it("rejects zero or negative sets", () => {
    expect(() =>
      computeSessionXp(
        { exerciseId: repsExercise.id, sets: 0, repsPerSet: 5 },
        repsExercise
      )
    ).toThrow(InvalidSessionError);
  });

  it("rejects a reps-based session missing repsPerSet", () => {
    expect(() =>
      computeSessionXp({ exerciseId: repsExercise.id, sets: 3 }, repsExercise)
    ).toThrow(InvalidSessionError);
  });

  it("rejects a duration-based session missing durationSeconds", () => {
    expect(() =>
      computeSessionXp(
        { exerciseId: durationExercise.id, sets: 3 },
        durationExercise
      )
    ).toThrow(InvalidSessionError);
  });
});

describe("meetsUnlockThreshold", () => {
  it("passes when reps per set reach the threshold", () => {
    expect(
      meetsUnlockThreshold(
        { exerciseId: repsExercise.id, sets: 1, repsPerSet: 5 },
        repsExercise
      )
    ).toBe(true);
  });

  it("fails when reps per set fall short", () => {
    expect(
      meetsUnlockThreshold(
        { exerciseId: repsExercise.id, sets: 1, repsPerSet: 4 },
        repsExercise
      )
    ).toBe(false);
  });

  it("passes when a held duration reaches the threshold", () => {
    expect(
      meetsUnlockThreshold(
        { exerciseId: durationExercise.id, sets: 1, durationSeconds: 30 },
        durationExercise
      )
    ).toBe(true);
  });
});

describe("xpThresholdForLevel / levelFromXp", () => {
  it("level 1 requires 0 XP", () => {
    expect(xpThresholdForLevel(1)).toBe(0);
    expect(levelFromXp(0).level).toBe(1);
  });

  it("thresholds strictly increase and cost more per level as level rises", () => {
    const t2 = xpThresholdForLevel(2);
    const t3 = xpThresholdForLevel(3);
    const t10 = xpThresholdForLevel(10);
    const t11 = xpThresholdForLevel(11);
    expect(t3).toBeGreaterThan(t2);
    // the level 10->11 step costs more XP than the level 2->3 step
    expect(t11 - t10).toBeGreaterThan(t3 - t2);
  });

  it("levelFromXp is consistent with xpThresholdForLevel at the boundary", () => {
    const threshold = xpThresholdForLevel(5);
    expect(levelFromXp(threshold).level).toBe(5);
    expect(levelFromXp(threshold - 1).level).toBe(4);
  });

  it("reports XP remaining to the next level", () => {
    const info = levelFromXp(10);
    expect(info.xpToNextLevel).toBe(info.nextLevelThreshold - 10);
    expect(info.xpToNextLevel).toBeGreaterThan(0);
  });
});

describe("familyLevel / globalLevel", () => {
  it("sums XP across exercises before deriving a level", () => {
    const progress = [
      { xpInExercise: xpThresholdForLevel(3) / 2 },
      { xpInExercise: xpThresholdForLevel(3) / 2 },
    ];
    expect(familyLevel(progress).level).toBe(3);
  });

  it("globalLevel aggregates across every family the same way", () => {
    const progress = [
      { xpInExercise: 100 },
      { xpInExercise: 250 },
      { xpInExercise: 40 },
    ];
    expect(globalLevel(progress)).toEqual(levelFromXp(390));
  });

  it("returns level 1 for no progress", () => {
    expect(familyLevel([]).level).toBe(1);
  });
});

describe("buildMasteredByFamily", () => {
  const family: ExerciseFamily = {
    id: "fam-1",
    slug: "tractions",
    name: "Tractions",
    statTag: "force-tirage",
    sortOrder: 1,
  };

  it("counts mastered exercises per family and lists their names", () => {
    const result = buildMasteredByFamily(
      [{ family, exercises: [repsExercise, durationExercise] }],
      [
        { exerciseId: repsExercise.id, mastered: true },
        { exerciseId: durationExercise.id, mastered: false },
      ]
    );
    expect(result).toEqual([
      {
        familyName: "Tractions",
        masteredCount: 1,
        totalCount: 2,
        masteredNames: ["Traction stricte"],
      },
    ]);
  });

  it("handles a family with nothing mastered", () => {
    const result = buildMasteredByFamily([{ family, exercises: [repsExercise] }], []);
    expect(result).toEqual([
      { familyName: "Tractions", masteredCount: 0, totalCount: 1, masteredNames: [] },
    ]);
  });
});
