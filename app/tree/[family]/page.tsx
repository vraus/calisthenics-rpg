import { notFound } from "next/navigation";
import { getAuthenticatedUserId } from "@/lib/auth";
import { getExercisesByFamilySlug, getUserProgress } from "@/lib/data";
import { buildFamilyTree, familyLevel } from "@/lib/xp";
import { TreeNodeList } from "./tree-node-list";

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

      <TreeNodeList nodes={nodes} />
    </main>
  );
}
