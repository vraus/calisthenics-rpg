import { getAuthenticatedUserId } from "@/lib/auth";
import { getFamiliesWithExercises, getUserProgress } from "@/lib/data";
import { buildFamilyTree } from "@/lib/xp";
import LogForm from "../log-form";

export const metadata = { title: "Log libre — Calisthenics RPG" };

export default async function LogLibrePage() {
  const userId = await getAuthenticatedUserId();

  const [familiesWithExercises, progress] = await Promise.all([
    getFamiliesWithExercises(),
    userId ? getUserProgress(userId) : Promise.resolve([]),
  ]);

  const groups = familiesWithExercises.map(({ family, exercises }) => ({
    family,
    nodes: buildFamilyTree(exercises, progress),
  }));

  return (
    <main className="flex flex-1 flex-col px-6 py-8 max-w-xl mx-auto w-full">
      <h1 className="font-display text-xl font-bold mb-1">Log libre</h1>
      <p className="text-sm text-muted mb-6">
        Choisis un exercice et renseigne ta performance — hors du plan de la semaine.
      </p>
      <LogForm groups={groups} />
    </main>
  );
}
