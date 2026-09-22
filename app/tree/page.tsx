import Link from "next/link";
import { getAuthenticatedUserId } from "@/lib/auth";
import {
  getCompletedCircuitIds,
  getFamiliesWithExercises,
  getPhases,
  getSessionTemplates,
  getUserProgress,
} from "@/lib/data";
import { buildFamilyTree, familyLevel } from "@/lib/xp";

export const metadata = { title: "Arbres de compétences — Calisthenics RPG" };

export default async function TreeIndexPage() {
  const userId = await getAuthenticatedUserId();

  const [phases, familiesWithExercises, sessionTemplates] = await Promise.all([
    getPhases(),
    getFamiliesWithExercises(),
    getSessionTemplates(),
  ]);
  const [progress, completedCircuitIds] = userId
    ? await Promise.all([getUserProgress(userId), getCompletedCircuitIds(userId)])
    : [[], new Set<string>()];

  const sortedPhases = [...phases].sort((a, b) => a.sortOrder - b.sortOrder);
  const familiesByPhase = new Map(sortedPhases.map((p) => [p.id, [] as typeof familiesWithExercises]));
  for (const entry of familiesWithExercises) {
    const bucket = entry.family.phaseId ? familiesByPhase.get(entry.family.phaseId) : undefined;
    bucket?.push(entry);
  }
  const circuitsByPhase = new Map(sortedPhases.map((p) => [p.id, [] as typeof sessionTemplates]));
  for (const template of sessionTemplates) {
    const bucket = template.phaseId ? circuitsByPhase.get(template.phaseId) : undefined;
    bucket?.push(template);
  }

  return (
    <main className="flex flex-1 flex-col px-6 py-8 max-w-xl mx-auto w-full gap-6">
      <h1 className="font-display text-xl font-bold">Arbres de compétences</h1>

      {sortedPhases.map((phase) => {
        const families = familiesByPhase.get(phase.id) ?? [];
        const circuits = circuitsByPhase.get(phase.id) ?? [];
        if (families.length === 0 && circuits.length === 0) return null;

        return (
          <section key={phase.id} className="flex flex-col gap-4">
            <h2 className="font-display text-base font-bold text-accent-strong">{phase.name}</h2>

            {families.length > 0 ? (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-muted">Compétences techniques</h3>
                {families
                  .sort((a, b) => a.family.sortOrder - b.family.sortOrder)
                  .map(({ family, exercises }) => {
                    const nodes = buildFamilyTree(exercises, progress);
                    const masteredCount = nodes.filter((n) => n.mastered).length;
                    const fullyMastered = nodes.length > 0 && masteredCount === nodes.length;
                    const level = familyLevel(nodes);

                    return (
                      <Link
                        key={family.id}
                        href={`/tree/${family.slug}`}
                        className={`p-4 flex items-center justify-between transition-colors ${
                          fullyMastered ? "panel-rpg panel-rpg-gold" : "panel-rpg hover:border-accent"
                        }`}
                      >
                        <div>
                          <p className="font-medium">
                            {family.name}
                            {fullyMastered ? <span className="text-gold ml-2">✓</span> : null}
                          </p>
                          <p className="text-sm text-muted">
                            {masteredCount}/{nodes.length} maîtrisés · niveau {level.level}
                          </p>
                        </div>
                        <span className="text-muted">→</span>
                      </Link>
                    );
                  })}
              </div>
            ) : null}

            {circuits.length > 0 ? (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-muted">Circuits</h3>
                {circuits.map((template) => {
                  const exerciseCount = template.exercises.length;
                  const acquiredCount = template.exercises.filter((e) =>
                    progress.some((p) => p.exerciseId === e.exerciseId && p.mastered)
                  ).length;
                  const completed = completedCircuitIds.has(template.id);

                  return (
                    <Link
                      key={template.id}
                      href={`/tree/circuit/${template.slug}`}
                      className={`p-4 flex items-center justify-between transition-colors ${
                        completed ? "panel-rpg panel-rpg-gold" : "panel-rpg hover:border-accent"
                      }`}
                    >
                      <div>
                        <p className="font-medium">
                          {template.name}
                          {completed ? <span className="text-gold ml-2">✓</span> : null}
                        </p>
                        <p className="text-sm text-muted">
                          {acquiredCount}/{exerciseCount} exercices acquis
                        </p>
                      </div>
                      <span className="text-muted">→</span>
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </section>
        );
      })}
    </main>
  );
}
