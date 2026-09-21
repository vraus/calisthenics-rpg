import { describe, expect, it } from "vitest";
import { computeStreak } from "./streak";

describe("computeStreak", () => {
  it("returns zeros with no sessions", () => {
    expect(computeStreak([])).toEqual({ current: 0, longest: 0 });
  });

  it("counts a single day as a streak of 1", () => {
    const today = new Date("2026-03-10T12:00:00Z");
    const result = computeStreak(["2026-03-10T08:00:00Z"], today);
    expect(result).toEqual({ current: 1, longest: 1 });
  });

  it("counts consecutive days ending today", () => {
    const today = new Date("2026-03-10T12:00:00Z");
    const timestamps = [
      "2026-03-08T08:00:00Z",
      "2026-03-09T08:00:00Z",
      "2026-03-10T08:00:00Z",
    ];
    expect(computeStreak(timestamps, today)).toEqual({ current: 3, longest: 3 });
  });

  it("keeps the streak alive if today has no session yet", () => {
    const today = new Date("2026-03-10T12:00:00Z");
    const timestamps = ["2026-03-08T08:00:00Z", "2026-03-09T08:00:00Z"];
    expect(computeStreak(timestamps, today)).toEqual({ current: 2, longest: 2 });
  });

  it("breaks the current streak after a full missed day", () => {
    const today = new Date("2026-03-10T12:00:00Z");
    const timestamps = ["2026-03-07T08:00:00Z", "2026-03-08T08:00:00Z"];
    expect(computeStreak(timestamps, today)).toEqual({ current: 0, longest: 2 });
  });

  it("tracks the longest streak separately from the current one", () => {
    const today = new Date("2026-03-20T12:00:00Z");
    const timestamps = [
      "2026-03-01T08:00:00Z",
      "2026-03-02T08:00:00Z",
      "2026-03-03T08:00:00Z",
      "2026-03-04T08:00:00Z",
      "2026-03-19T08:00:00Z",
      "2026-03-20T08:00:00Z",
    ];
    expect(computeStreak(timestamps, today)).toEqual({ current: 2, longest: 4 });
  });

  it("dedupes multiple sessions on the same day", () => {
    const today = new Date("2026-03-10T12:00:00Z");
    const timestamps = [
      "2026-03-10T08:00:00Z",
      "2026-03-10T18:00:00Z",
      "2026-03-10T20:00:00Z",
    ];
    expect(computeStreak(timestamps, today)).toEqual({ current: 1, longest: 1 });
  });
});
