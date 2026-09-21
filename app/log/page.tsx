import { createClient } from "@/lib/supabase/server";
import { getFamiliesWithExercises, getUserProgress } from "@/lib/data";
import { buildFamilyTree } from "@/lib/xp";
import LogForm from "./log-form";

export const metadata = { title: "Log séance — Calisthenics RPG" };

export default async function LogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [familiesWithExercises, progress] = await Promise.all([
    getFamiliesWithExercises(),
    user ? getUserProgress(user.id) : Promise.resolve([]),
  ]);

  const groups = familiesWithExercises.map(({ family, exercises }) => ({
    family,
    nodes: buildFamilyTree(exercises, progress),
  }));

  return (
    <main className="flex flex-1 flex-col px-6 py-8 max-w-xl mx-auto w-full">
      <h1 className="text-xl font-semibold mb-1">Nouvelle séance</h1>
      <p className="text-sm text-muted mb-6">
        Choisis un exercice débloqué et renseigne ta performance.
      </p>
      <LogForm groups={groups} />
    </main>
  );
}
