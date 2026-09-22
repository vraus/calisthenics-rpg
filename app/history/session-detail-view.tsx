import Link from "next/link";
import type { HistorySetDetail } from "@/lib/data";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Shared "séance" detail rendering — grouped by exercise, one chip per série réellement faite. */
export function SessionDetailView({
  title,
  subtitle,
  fullCompletion,
  sets,
}: {
  title: string;
  subtitle?: string;
  fullCompletion?: boolean;
  sets: HistorySetDetail[];
}) {
  const totalXp = sets.reduce((sum, s) => sum + s.xpEarned, 0);

  const byExercise = new Map<string, HistorySetDetail[]>();
  for (const s of sets) {
    (byExercise.get(s.exerciseName) ?? byExercise.set(s.exerciseName, []).get(s.exerciseName)!).push(s);
  }

  return (
    <main className="flex flex-1 flex-col px-6 py-8 max-w-xl mx-auto w-full gap-4">
      <Link href="/history" className="text-sm text-accent-strong">
        ← Historique
      </Link>

      <div>
        <h1 className="font-display text-xl font-bold">
          {title}
          {fullCompletion ? <span className="text-gold ml-2">✓</span> : null}
        </h1>
        {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
        <p className="text-sm text-accent-strong font-medium mt-1">{totalXp} XP au total</p>
      </div>

      {sets.length === 0 ? (
        <p className="text-sm text-muted">Aucune série enregistrée.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {[...byExercise.entries()].map(([exerciseName, exerciseSets]) => {
            const unit = exerciseSets[0].unlockType === "duration" ? "s" : "reps";
            const xp = exerciseSets.reduce((sum, s) => sum + s.xpEarned, 0);
            return (
              <div key={exerciseName} className="panel-rpg p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{exerciseName}</p>
                  <span className="text-xs text-accent-strong shrink-0">+{Math.round(xp * 100) / 100} XP</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {exerciseSets.map((s, i) => (
                    <span
                      key={i}
                      className="rounded-lg border border-border bg-locked px-2 py-1 text-xs text-foreground"
                    >
                      {s.performance} {unit}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-muted">{formatDateTime(exerciseSets[0].performedAt)}</p>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
