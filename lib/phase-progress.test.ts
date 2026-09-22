import { describe, expect, it } from "vitest";
import { isPhaseComplete } from "./phase-progress";

describe("isPhaseComplete", () => {
  it("is false when a family isn't maxed yet", () => {
    expect(
      isPhaseComplete({
        topTierExerciseIdByFamily: ["ex-a", "ex-b"],
        masteredExerciseIds: new Set(["ex-a"]),
        circuitIds: ["c1"],
        completedCircuitIds: new Set(["c1"]),
      })
    ).toBe(false);
  });

  it("is false when a circuit hasn't been validated yet", () => {
    expect(
      isPhaseComplete({
        topTierExerciseIdByFamily: ["ex-a"],
        masteredExerciseIds: new Set(["ex-a"]),
        circuitIds: ["c1", "c2"],
        completedCircuitIds: new Set(["c1"]),
      })
    ).toBe(false);
  });

  it("is true when every family is maxed and every circuit validated", () => {
    expect(
      isPhaseComplete({
        topTierExerciseIdByFamily: ["ex-a", "ex-b"],
        masteredExerciseIds: new Set(["ex-a", "ex-b", "ex-c"]),
        circuitIds: ["c1", "c2"],
        completedCircuitIds: new Set(["c1", "c2", "c3"]),
      })
    ).toBe(true);
  });

  it("is true with no families/circuits at all (vacuously complete)", () => {
    expect(
      isPhaseComplete({
        topTierExerciseIdByFamily: [],
        masteredExerciseIds: new Set(),
        circuitIds: [],
        completedCircuitIds: new Set(),
      })
    ).toBe(true);
  });
});
