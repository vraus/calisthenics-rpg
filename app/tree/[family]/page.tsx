import { notFound } from "next/navigation";
import { getAuthenticatedUserId } from "@/lib/auth";
import { getExercisesByFamilySlug, getUserProgress } from "@/lib/data";
import { buildFamilyTree, familyLevel } from "@/lib/xp";

export default async function FamilyTreePage({
  params,
}: {
  params: Promise<{ family: string }>;
}) {
  const { family: familySlug } = await params;

  const result = await getExercisesByFamilySlug(familySlug);
  if (!result) notFound();
  const { family, exercises } = result;

  const userId = await getAuthenticatedUserId();

  const progress = userId ? await getUserProgress(userId) : [];
  const nodes = buildFamilyTree(exercises, progress);
  const level = familyLevel(nodes);

  return (
    <main className="flex flex-1 flex-col px-6 py-8 max-w-xl mx-auto w-full gap-4">
      <div>
        <h1 className="font-display text-xl font-bold">{family.name}</h1>
        <p className="text-sm text-muted">
          Niveau {level.level} · {level.xpIntoLevel}/
          {level.xpIntoLevel + level.xpToNextLevel} XP avant le niveau suivant
        </p>
      </div>

      <ol className="flex flex-col gap-2">
        {nodes.map((node, i) => {
          const state = node.mastered
            ? "mastered"
            : node.unlocked
              ? "unlocked"
              : "locked";

          return (
            <li
              key={node.id}
              className={`p-4 flex items-center gap-3 ${
                state === "locked"
                  ? "rounded-lg border border-border bg-locked text-muted"
                  : state === "mastered"
                    ? "panel-rpg panel-rpg-gold"
                    : "panel-rpg"
              }`}
            >
              <span className="text-xs w-6 text-center font-mono text-muted">
                {i + 1}
              </span>
              <div className="flex-1">
                <p className="font-medium">{node.name}</p>
                <p className="text-xs text-muted">
                  {state === "locked"
                    ? "Pas encore recommandé"
                    : `Seuil de maîtrise : ${node.unlockThreshold}${
                        node.unlockType === "duration" ? " s" : " reps"
                      }`}
                </p>
              </div>
              {state === "mastered" ? (
                <span className="text-gold text-sm font-medium">✓</span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </main>
  );
}
