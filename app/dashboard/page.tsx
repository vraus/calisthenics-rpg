import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedUserId } from "@/lib/auth";
import {
  getCompletedCircuitIds,
  getFamiliesWithExercises,
  getProfile,
  getRecentSessions,
  getRestDayCompletionDates,
  getSessionTemplates,
  getUpcomingBadges,
  getUserProgress,
  getWeeklyPlan,
  getXpBonusTotal,
} from "@/lib/data";
import { buildMasteredByFamily, globalMasteryProgress, levelFromXp } from "@/lib/xp";
import { computeStreak } from "@/lib/streak";
import { getTodayDayOfWeek, getWeekStart } from "@/lib/week";

export const metadata = { title: "Dashboard - Calisthenics RPG" };

export default async function DashboardPage() {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-muted text-sm">Connecte-toi pour voir ton niveau.</p>
      </main>
    );
  }

  // Point d'entrée principal après connexion (voir app/page.tsx et
  // app/login/actions.ts) : c'est ici qu'on redirige vers le questionnaire
  // de placement si le joueur ne l'a jamais fait.
  const profile = await getProfile(userId);
  if (profile && !profile.onboardingCompletedAt) redirect("/onboarding");

  const [
    familiesWithExercises,
    progress,
    recentSessions,
    allSessions,
    bonusXp,
    restDayDates,
    plan,
    sessionTemplates,
    completedCircuitIds,
    upcomingBadges,
  ] = await Promise.all([
    getFamiliesWithExercises(),
    getUserProgress(userId),
    getRecentSessions(userId, 5),
    getRecentSessions(userId, 1000),
    getXpBonusTotal(userId),
    getRestDayCompletionDates(userId),
    getWeeklyPlan(userId, getWeekStart()),
    getSessionTemplates(),
    getCompletedCircuitIds(userId),
    getUpcomingBadges(userId, 4),
  ]);

  const todaySession = plan?.sessions.find((s) => s.dayOfWeek === getTodayDayOfWeek());
  const logButtonLabel = !todaySession
    ? "Logger une séance"
    : todaySession.completedAt
      ? "Séance du jour ✓ terminée"
      : "Séance du jour";

  const streak = computeStreak([...allSessions.map((s) => s.performed_at), ...restDayDates]);
  const progressXp = progress.reduce((sum, p) => sum + p.xpInExercise, 0);
  const totalXp = progressXp + bonusXp;
  const global = levelFromXp(totalXp);
  const globalXpTotal = global.xpIntoLevel + global.xpToNextLevel;
  const progressPct = globalXpTotal > 0 ? Math.round((global.xpIntoLevel / globalXpTotal) * 100) : 0;

  const masteredByFamily = buildMasteredByFamily(familiesWithExercises, progress);
  const totalExercises = masteredByFamily.reduce((sum, f) => sum + f.totalCount, 0);
  const masteredExercisesCount = masteredByFamily.reduce((sum, f) => sum + f.masteredCount, 0);
  const mastery = globalMasteryProgress(
    masteredExercisesCount,
    totalExercises,
    completedCircuitIds.size,
    sessionTemplates.length
  );

  return (
    <main className="flex flex-1 flex-col px-6 py-8 max-w-xl mx-auto w-full gap-6">
      <section className="panel-rpg p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted">Niveau global</p>
            <p className="font-display text-4xl font-bold text-accent-strong">{global.level}</p>
          </div>
          {streak.current > 0 ? (
            <p className="text-sm font-medium text-gold">
              {streak.current} 🔥
            </p>
          ) : null}
        </div>
        <div className="mt-3 h-2 rounded-full bg-locked overflow-hidden">
          <div
            className="h-full bg-accent"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          {global.xpIntoLevel}/{globalXpTotal} XP · {totalXp} XP au total
        </p>
      </section>

      <section className="panel-rpg p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-muted">Progression générale</p>
          <p className="font-display text-lg font-bold text-accent-strong">{mastery.overallPercent}%</p>
        </div>
        <div className="h-2 rounded-full bg-locked overflow-hidden">
          <div className="h-full bg-accent" style={{ width: `${mastery.overallPercent}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted">
          {mastery.masteredExercises}/{mastery.totalExercises} niveaux maîtrisés · {mastery.completedCircuits}/
          {mastery.totalCircuits} circuits accomplis
        </p>
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted mb-2">Prochains badges</h2>
        {upcomingBadges.length === 0 ? (
          <p className="text-sm text-muted">Rien à débloquer pour l&apos;instant.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {upcomingBadges.map((badge) => (
              <div key={badge.slug} className="panel-rpg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{badge.name}</span>
                  <span className="text-sm text-muted">{badge.percent}%</span>
                </div>
                <p className="text-xs text-muted mb-1.5">{badge.description}</p>
                <div className="h-1.5 rounded-full bg-locked overflow-hidden">
                  <div className="h-full bg-gold" style={{ width: `${badge.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-muted">Séances récentes</h2>
          <Link href="/history" className="text-xs text-accent-strong">
            Tout voir
          </Link>
        </div>
        {recentSessions.length === 0 ? (
          <p className="text-sm text-muted">Aucune séance enregistrée.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recentSessions.map((s) => {
              // Nested select shape from Supabase (exercises(name, ...)) isn't
              // typed by the client; read it defensively.
              const exerciseName =
                (s as { exercises?: { name?: string } | null }).exercises?.name ??
                "Exercice";
              return (
                <li
                  key={s.id}
                  className="panel-rpg p-3 flex items-center justify-between text-sm"
                >
                  <span>{exerciseName}</span>
                  <span className="text-muted">+{s.xp_earned} XP</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Link
        href="/log"
        className="rounded-lg bg-accent px-4 py-3 text-center font-medium text-white hover:bg-accent-strong transition-colors"
      >
        {logButtonLabel}
      </Link>
    </main>
  );
}
