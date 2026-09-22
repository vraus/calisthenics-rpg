import { notFound } from "next/navigation";
import { getAuthenticatedUserId } from "@/lib/auth";
import { getCompletedCircuitIds, getSessionTemplates, getUserProgress } from "@/lib/data";
import { CircuitExerciseList } from "./circuit-exercise-list";
import { CircuitCompletionToggle } from "./circuit-completion-toggle";

export default async function CircuitTreePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const userId = await getAuthenticatedUserId();

  const templates = await getSessionTemplates();
  const template = templates.find((t) => t.slug === slug);
  if (!template) notFound();

  const [progress, completedCircuitIds] = userId
    ? await Promise.all([getUserProgress(userId), getCompletedCircuitIds(userId)])
    : [[], new Set<string>()];

  const masteredExerciseIds = new Set(progress.filter((p) => p.mastered).map((p) => p.exerciseId));
  const exercises = template.exercises.map((e) => ({
    ...e,
    mastered: masteredExerciseIds.has(e.exerciseId),
  }));
  const completed = completedCircuitIds.has(template.id);

  return (
    <main className="flex flex-1 flex-col px-6 py-8 max-w-xl mx-auto w-full gap-4">
      <div>
        <h1 className="font-display text-xl font-bold">{template.name}</h1>
        <p className="text-sm text-muted">
          {exercises.filter((e) => e.mastered).length}/{exercises.length} exercices acquis
        </p>
      </div>

      {userId ? <CircuitCompletionToggle templateId={template.id} completed={completed} /> : null}

      <CircuitExerciseList parts={template.parts} exercises={exercises} />
    </main>
  );
}
