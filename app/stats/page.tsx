import { createClient } from "@/lib/supabase/server";
import { getRecentSessions, getRestDayCompletionDates, getUserProgress, getXpBonusTotal } from "@/lib/data";
import { levelFromXp } from "@/lib/xp";
import { computeStreak } from "@/lib/streak";

export const metadata = { title: "Profil — Calisthenics RPG" };

interface SessionRow {
  id: string;
  performed_at: string;
  sets: number;
  reps_per_set: number | null;
  duration_seconds: number | null;
  exercises?: { name?: string; slug?: string } | null;
}

interface Badge {
  slug: string;
  name: string;
  description: string;
  sort_order: number;
}

export default async function StatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-muted text-sm">Connecte-toi pour voir tes stats.</p>
      </main>
    );
  }

  const [progress, sessions, badgesResult, earnedResult, bonusXp, restDayDates] = await Promise.all([
    getUserProgress(user.id),
    getRecentSessions(user.id, 1000) as Promise<SessionRow[]>,
    supabase.from("badges").select("slug, name, description, sort_order").order("sort_order"),
    supabase.from("user_badges").select("earned_at, badges(slug)").eq("user_id", user.id),
    getXpBonusTotal(user.id),
    getRestDayCompletionDates(user.id),
  ]);

  const badges: Badge[] = badgesResult.data ?? [];
  const earnedAtBySlug = new Map<string, string>(
    (earnedResult.data ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((row: any): [string | undefined, string] => [
        row.badges?.slug,
        row.earned_at,
      ])
      .filter((entry): entry is [string, string] => Boolean(entry[0]))
  );

  const progressXp = progress.reduce((sum, p) => sum + p.xpInExercise, 0);
  const totalXp = progressXp + bonusXp;
  const global = levelFromXp(totalXp);
  const streak = computeStreak([...sessions.map((s) => s.performed_at), ...restDayDates]);

  const bestByExercise = new Map<string, { value: number; unit: "reps" | "s" }>();
  for (const s of sessions) {
    const name = s.exercises?.name;
    if (!name) continue;
    const isReps = s.reps_per_set != null;
    const value = isReps ? s.reps_per_set! : s.duration_seconds!;
    const current = bestByExercise.get(name);
    if (!current || value > current.value) {
      bestByExercise.set(name, { value, unit: isReps ? "reps" : "s" });
    }
  }

  return (
    <main className="flex flex-1 flex-col px-6 py-8 max-w-xl mx-auto w-full gap-6">
      <h1 className="font-display text-xl font-bold">Profil</h1>

      <section className="panel-rpg p-5 grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-muted">Niveau global</p>
          <p className="font-display text-2xl font-bold text-accent-strong">{global.level}</p>
        </div>
        <div>
          <p className="text-sm text-muted">Séances loggées</p>
          <p className="font-display text-2xl font-bold text-accent-strong">{sessions.length}</p>
        </div>
        <div>
          <p className="text-sm text-muted">XP total</p>
          <p className="font-display text-2xl font-bold text-accent-strong">{Math.round(totalXp)}</p>
        </div>
        <div>
          <p className="text-sm text-muted">Streak</p>
          <p className="font-display text-2xl font-bold text-gold">
            {streak.current} 🔥 <span className="font-sans text-sm text-muted">(record {streak.longest})</span>
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted mb-2">Records personnels</h2>
        {bestByExercise.size === 0 ? (
          <p className="text-sm text-muted">Aucune séance enregistrée pour l&apos;instant.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {[...bestByExercise.entries()].map(([name, record]) => (
              <li
                key={name}
                className="panel-rpg p-3 flex items-center justify-between text-sm"
              >
                <span>{name}</span>
                <span className="text-gold font-medium">
                  {record.value} {record.unit}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted mb-2">Badges</h2>
        <ul className="flex flex-col gap-2">
          {badges.map((badge) => {
            const earnedAt = earnedAtBySlug.get(badge.slug);
            return (
              <li
                key={badge.slug}
                className={`p-3 flex items-center justify-between gap-3 ${
                  earnedAt
                    ? "panel-rpg panel-rpg-gold"
                    : "rounded-lg border border-border bg-locked text-muted"
                }`}
              >
                <div>
                  <p className="font-medium text-sm">{badge.name}</p>
                  <p className="text-xs">{badge.description}</p>
                </div>
                {earnedAt ? (
                  <span className="text-gold text-sm font-medium">✓</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
