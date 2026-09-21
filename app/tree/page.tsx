import Link from "next/link";
import { getAuthenticatedUserId } from "@/lib/auth";
import { getFamiliesWithExercises, getUserProgress } from "@/lib/data";
import { buildFamilyTree, familyLevel } from "@/lib/xp";

export const metadata = { title: "Arbres de compétences — Calisthenics RPG" };

export default async function TreeIndexPage() {
  const userId = await getAuthenticatedUserId();

  const familiesWithExercises = await getFamiliesWithExercises();
  const progress = userId ? await getUserProgress(userId) : [];

  return (
    <main className="flex flex-1 flex-col px-6 py-8 max-w-xl mx-auto w-full gap-4">
      <h1 className="font-display text-xl font-bold mb-2">Arbres de compétences</h1>

      {familiesWithExercises.map(({ family, exercises }) => {
        const nodes = buildFamilyTree(exercises, progress);
        const masteredCount = nodes.filter((n) => n.mastered).length;
        const level = familyLevel(nodes);

        return (
          <Link
            key={family.id}
            href={`/tree/${family.slug}`}
            className="panel-rpg p-4 flex items-center justify-between hover:border-accent transition-colors"
          >
            <div>
              <p className="font-medium">{family.name}</p>
              <p className="text-sm text-muted">
                {masteredCount}/{nodes.length} maîtrisés · niveau {level.level}
              </p>
            </div>
            <span className="text-muted">→</span>
          </Link>
        );
      })}
    </main>
  );
}
