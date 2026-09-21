import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getFamiliesWithExercises,
  getPlannedSessionXpSummary,
  getUserProgress,
  getWeeklyPlan,
} from "@/lib/data";
import { buildFamilyTree } from "@/lib/xp";
import { getTodayDayOfWeek, getWeekStart } from "@/lib/week";
import LogForm from "./log-form";
import SessionRunner from "../plan/session-runner";

export const metadata = { title: "Séance — Calisthenics RPG" };

export default async function LogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-muted text-sm">Connecte-toi pour voir ta séance.</p>
      </main>
    );
  }

  const plan = await getWeeklyPlan(user.id, getWeekStart());
  const todaySession = plan?.sessions.find((s) => s.dayOfWeek === getTodayDayOfWeek());

  if (todaySession) {
    const initialSummary = todaySession.completedAt
      ? await getPlannedSessionXpSummary(user.id, todaySession.id)
      : undefined;

    return (
      <main className="flex flex-1 flex-col px-6 py-8 max-w-xl mx-auto w-full gap-4">
        <h1 className="font-display text-xl font-bold">
          {todaySession.isRestDay ? "Repos" : todaySession.label}
        </h1>
        <SessionRunner session={todaySession} initialSummary={initialSummary} />
        <Link href="/log/libre" className="text-sm text-muted text-center underline underline-offset-2">
          Logger un exercice hors plan
        </Link>
      </main>
    );
  }

  const [familiesWithExercises, progress] = await Promise.all([
    getFamiliesWithExercises(),
    getUserProgress(user.id),
  ]);

  const groups = familiesWithExercises.map(({ family, exercises }) => ({
    family,
    nodes: buildFamilyTree(exercises, progress),
  }));

  return (
    <main className="flex flex-1 flex-col px-6 py-8 max-w-xl mx-auto w-full">
      <h1 className="font-display text-xl font-bold mb-1">Nouvelle séance</h1>
      <p className="text-sm text-muted mb-6">
        Rien de planifié aujourd&apos;hui — choisis un exercice et renseigne ta performance.
      </p>
      <LogForm groups={groups} />
    </main>
  );
}
