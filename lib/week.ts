/**
 * Week-key helper for weekly plans. No UI or Supabase dependency, same
 * spirit as xp.ts/streak.ts.
 */
import type { DayOfWeek } from "./types";

/** Monday (UTC) of the week containing `date`, as YYYY-MM-DD. */
export function getWeekStart(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d.toISOString().slice(0, 10);
}

/** `date`'s day of week in the 0=lundi..6=dimanche convention used by DayOfWeek. */
export function getTodayDayOfWeek(date: Date = new Date()): DayOfWeek {
  const day = date.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  return ((day + 6) % 7) as DayOfWeek;
}

/** `weekStart` shifted by `n` weeks (n can be negative). */
export function addWeeks(weekStart: string, n: number): string {
  return getWeekStart(new Date(Date.parse(weekStart) + n * 7 * 86_400_000));
}
