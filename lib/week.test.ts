import { describe, expect, it } from "vitest";
import { addWeeks, getTodayDayOfWeek, getWeekStart } from "./week";

describe("getWeekStart", () => {
  it("returns the same date when given a Monday", () => {
    expect(getWeekStart(new Date("2026-03-09T10:00:00Z"))).toBe("2026-03-09");
  });

  it("returns the preceding Monday for a mid-week date", () => {
    expect(getWeekStart(new Date("2026-03-12T23:59:00Z"))).toBe("2026-03-09");
  });

  it("returns the preceding Monday for a Sunday", () => {
    expect(getWeekStart(new Date("2026-03-15T00:00:00Z"))).toBe("2026-03-09");
  });

  it("handles a month boundary", () => {
    expect(getWeekStart(new Date("2026-04-01T00:00:00Z"))).toBe("2026-03-30");
  });
});

describe("addWeeks", () => {
  it("adds a positive number of weeks", () => {
    expect(addWeeks("2026-03-09", 1)).toBe("2026-03-16");
    expect(addWeeks("2026-03-09", 3)).toBe("2026-03-30");
  });

  it("returns the same week with 0", () => {
    expect(addWeeks("2026-03-09", 0)).toBe("2026-03-09");
  });

  it("supports negative offsets", () => {
    expect(addWeeks("2026-03-09", -1)).toBe("2026-03-02");
  });
});

describe("getTodayDayOfWeek", () => {
  it("maps Monday to 0", () => {
    expect(getTodayDayOfWeek(new Date("2026-03-09T10:00:00Z"))).toBe(0);
  });

  it("maps Sunday to 6", () => {
    expect(getTodayDayOfWeek(new Date("2026-03-15T10:00:00Z"))).toBe(6);
  });

  it("maps Wednesday to 2", () => {
    expect(getTodayDayOfWeek(new Date("2026-03-11T10:00:00Z"))).toBe(2);
  });
});
