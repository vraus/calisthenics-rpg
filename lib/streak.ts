/**
 * Attendance streak, derived from session timestamps - nothing stored,
 * recomputed on read. No UI or Supabase dependency, same spirit as xp.ts.
 */

export interface StreakInfo {
  current: number;
  longest: number;
}

function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * `current` counts consecutive days up to and including today, but tolerates
 * today not having a session logged yet (the streak isn't broken until a
 * full day is missed). `longest` is the best run in the whole history.
 */
export function computeStreak(
  sessionTimestamps: string[],
  today: Date = new Date()
): StreakInfo {
  const days = new Set(sessionTimestamps.map((t) => t.slice(0, 10)));
  if (days.size === 0) return { current: 0, longest: 0 };

  const sorted = [...days].sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diffDays = Math.round(
      (Date.parse(sorted[i]) - Date.parse(sorted[i - 1])) / 86_400_000
    );
    run = diffDays === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const cursor = new Date(today);
  if (!days.has(toDayKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  let current = 0;
  while (days.has(toDayKey(cursor))) {
    current += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return { current, longest };
}
