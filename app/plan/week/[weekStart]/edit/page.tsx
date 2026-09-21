import { getAuthenticatedUserId } from "@/lib/auth";
import { getFamiliesWithExercises, getWeeklyPlan } from "@/lib/data";
import WeekEditor from "./week-editor";
import DeleteWeekButton from "./delete-week-button";

export const metadata = { title: "Éditer ma semaine — Calisthenics RPG" };

function formatWeek(weekStart: string) {
  return new Date(`${weekStart}T00:00:00Z`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
  });
}

export default async function EditWeekPage({
  params,
}: {
  params: Promise<{ weekStart: string }>;
}) {
  const { weekStart } = await params;

  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-muted text-sm">Connecte-toi pour planifier ta semaine.</p>
      </main>
    );
  }

  const [familiesWithExercises, plan] = await Promise.all([
    getFamiliesWithExercises(),
    getWeeklyPlan(userId, weekStart),
  ]);

  return (
    <main className="flex flex-1 flex-col px-6 py-8 max-w-xl mx-auto w-full gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold">Semaine du {formatWeek(weekStart)}</h1>
        {plan ? <DeleteWeekButton weekStart={weekStart} /> : null}
      </div>
      <WeekEditor weekStart={weekStart} plan={plan} familiesWithExercises={familiesWithExercises} />
    </main>
  );
}
