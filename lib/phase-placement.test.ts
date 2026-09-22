import { describe, expect, it } from "vitest";
import { phasesToAskAbout, pickStartingPhase } from "./phase-placement";

const phase1 = { id: "p1", name: "Phase 1", sortOrder: 1, prerequisitesText: undefined };
const phase2 = { id: "p2", name: "Phase 2", sortOrder: 2, prerequisitesText: "10 tractions..." };
const phase3 = { id: "p3", name: "Phase 3", sortOrder: 3, prerequisitesText: "5 sec de front lever..." };
const phases = [phase1, phase2, phase3];

describe("pickStartingPhase", () => {
  it("places the player in phase 3 when they meet its prerequisites", () => {
    const result = pickStartingPhase(phases, [{ phaseId: "p3", meetsPrerequisites: true }]);
    expect(result.id).toBe("p3");
  });

  it("falls back to phase 2 when phase 3 isn't met but phase 2 is", () => {
    const result = pickStartingPhase(phases, [
      { phaseId: "p3", meetsPrerequisites: false },
      { phaseId: "p2", meetsPrerequisites: true },
    ]);
    expect(result.id).toBe("p2");
  });

  it("falls back to phase 1 (no prerequisites) when nothing else is met", () => {
    const result = pickStartingPhase(phases, [
      { phaseId: "p3", meetsPrerequisites: false },
      { phaseId: "p2", meetsPrerequisites: false },
    ]);
    expect(result.id).toBe("p1");
  });

  it("falls back to phase 1 when no answers were given at all", () => {
    expect(pickStartingPhase(phases, []).id).toBe("p1");
  });

  it("throws when there is no phase to place the player into", () => {
    expect(() => pickStartingPhase([], [])).toThrow();
  });
});

describe("phasesToAskAbout", () => {
  it("asks about every phase down to (and including) the first with no prerequisites", () => {
    expect(phasesToAskAbout(phases).map((p) => p.id)).toEqual(["p3", "p2", "p1"]);
  });

  it("stops early if an easier phase already has no prerequisites", () => {
    const noPrereqPhase2 = { id: "p2", name: "Phase 2", sortOrder: 2, prerequisitesText: undefined };
    expect(phasesToAskAbout([phase1, noPrereqPhase2, phase3]).map((p) => p.id)).toEqual(["p3", "p2"]);
  });
});
