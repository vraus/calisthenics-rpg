import Link from "next/link";
import { getAuthenticatedUserId } from "@/lib/auth";
import { getPlannedWeekStarts, getWeeklyPlan } from "@/lib/data";
import { addWeeks, getWeekStart } from "@/lib/week";
import { DAY_LABELS, type DayOfWeek, type WeeklyPlan } from "@/lib/types";
import CopyWeekButton from "./copy-week-button";

export const metadata = { title: "Plan de la semaine — Calisthenics RPG" };

// How far ahead to look for an already-planned week when deciding how many
// tiles to show. Generous but bounded — nobody plans months ahead here.
const MAX_WEEKS_AHEAD = 12;

function formatWeek(weekStart: string) {
  return new Date(`${weekStart}T00:00:00Z`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
  });
}

function tileTitle(index: number) {
  if (index === 0) return "Cette semaine";
  if (index === 1) return "Semaine prochaine";
  return "Semaine";
}

function WeekTile({
  title,
  weekStart,
  plan,
  showCopy,
}: {
  title: string;
  weekStart: string;
  plan: WeeklyPlan | null;
  showCopy: boolean;
}) {
  if (!plan) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted">
          {title} — {formatWeek(weekStart)}
        </p>
        <Link
          href={`/plan/week/${weekStart}/edit`}
          className="flex items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-3xl text-muted hover:border-accent hover:text-accent-strong transition-colors"
        >
          +
        </Link>
      </div>
    );
  }

  const configuredDays = plan.sessions.length;
  const doneDays = plan.sessions.filter((s) => s.completedAt).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted">
          {title} — {formatWeek(weekStart)}
        </p>
        <Link href={`/plan/week/${weekStart}/edit`} className="text-xs text-accent-strong">
          Modifier
        </Link>
      </div>
      <div className="panel-rpg p-3">
        <p className="text-xs text-muted mb-2">
          {configuredDays}/7 jours planifiés · {doneDays} terminés
        </p>
        <ul className="flex flex-col gap-1.5">
          {[...plan.sessions]
            .sort((a, b) => (a.dayOfWeek ?? 0) - (b.dayOfWeek ?? 0))
            .map((s) => (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <span className="text-muted">
                  {s.dayOfWeek !== undefined ? DAY_LABELS[s.dayOfWeek as DayOfWeek] : ""}
                </span>
                {s.completedAt ? (
                  <span className={s.fullCompletion ? "text-gold" : "text-muted"}>
                    {s.isRestDay ? "Repos" : s.label} ✓
                  </span>
                ) : (
                  // Always /log, never this specific day: only today's plan
                  // can be executed (see app/log/page.tsx), so there's no
                  // per-day detail route to link to anymore.
                  <Link href="/log" className="text-accent-strong">
                    {s.isRestDay ? "Repos" : s.label}
                  </Link>
                )}
              </li>
            ))}
        </ul>
      </div>
      {plan.perfectWeekAwardedAt ? (
        <p className="panel-rpg panel-rpg-gold p-3 text-sm text-gold text-center">
          Semaine parfaite ! Bonus débloqué.
        </p>
      ) : null}
      {showCopy ? <CopyWeekButton /> : null}
    </div>
  );
}

export default async function PlanPage() {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-muted text-sm">Connecte-toi pour planifier ta semaine.</p>
      </main>
    );
  }

  const currentWeekStart = getWeekStart();
  const candidateWeekStarts = Array.from({ length: MAX_WEEKS_AHEAD }, (_, i) =>
    addWeeks(currentWeekStart, i)
  );

  const plannedSet = await getPlannedWeekStarts(userId, candidateWeekStarts);

  // Show every week up to the last one that actually has a plan, plus one
  // extra "+" slot right after it — so a gap left empty by a deleted week
  // still shows its own "+", while a further-out planned week (and the
  // ability to extend past it) both stay visible too.
  let lastPlannedIndex = -1;
  for (let i = 0; i < candidateWeekStarts.length; i++) {
    if (plannedSet.has(candidateWeekStarts[i])) lastPlannedIndex = i;
  }
  const visibleWeekStarts = candidateWeekStarts.slice(
    0,
    Math.min(lastPlannedIndex + 2, candidateWeekStarts.length)
  );

  const plans = await Promise.all(visibleWeekStarts.map((ws) => getWeeklyPlan(userId, ws)));

  const currentPlanned = plannedSet.has(currentWeekStart);
  const nextWeekStart = addWeeks(currentWeekStart, 1);
  const nextPlanned = plannedSet.has(nextWeekStart);

  return (
    <main className="flex flex-1 flex-col px-6 py-8 max-w-xl mx-auto w-full gap-8">
      <h1 className="font-display text-xl font-bold">Mon plan</h1>

      {visibleWeekStarts.map((weekStart, index) => (
        <WeekTile
          key={weekStart}
          title={tileTitle(index)}
          weekStart={weekStart}
          plan={plans[index]}
          showCopy={index === 0 && currentPlanned && !nextPlanned}
        />
      ))}
    </main>
  );
}
