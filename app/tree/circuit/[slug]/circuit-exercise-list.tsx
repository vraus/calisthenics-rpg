"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SessionTemplateExercise, SessionTemplatePart } from "@/lib/types";
import { selfReportMastery, unmasterLevel } from "../../actions";
import { usePhaseAdvanced, PhaseAdvancedOverlay, BadgeChips } from "../../../xp-feedback";

interface CircuitExerciseItem extends SessionTemplateExercise {
  mastered: boolean;
}

export function CircuitExerciseList({
  parts,
  exercises,
}: {
  parts: SessionTemplatePart[];
  exercises: CircuitExerciseItem[];
}) {
  const [selected, setSelected] = useState<CircuitExerciseItem | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [newBadges, setNewBadges] = useState<string[]>([]);
  const { phaseName: phaseAdvanced, trigger: triggerPhaseAdvanced } = usePhaseAdvanced();

  function open(exercise: CircuitExerciseItem) {
    setSelected(exercise);
    setError(null);
    setNote(null);
    setNewBadges([]);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  function reportMastery() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const result = await selfReportMastery(selected.exerciseId);
      if (!result.ok) {
        setError(result.error ?? "Erreur.");
        return;
      }
      if (result.newPhaseName) triggerPhaseAdvanced(result.newPhaseName);
      if (result.newBadgeNames?.length) {
        setNewBadges(result.newBadgeNames);
        router.refresh();
        return;
      }
      close();
      router.refresh();
    });
  }

  function invalidate() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const result = await unmasterLevel(selected.exerciseId);
      if (!result.ok) {
        setError(result.error ?? "Erreur.");
        return;
      }
      if (result.revertedPhaseName) {
        setNote(`Les prérequis de la phase suivante ne sont plus remplis : retour à "${result.revertedPhaseName}".`);
        router.refresh();
        return;
      }
      close();
      router.refresh();
    });
  }

  const showParts = parts.length > 1;

  return (
    <>
      <div className="flex flex-col gap-2">
        {parts.map((part, partIdx) => {
          const partExercises = exercises.filter((e) => e.partIndex === part.partIndex);
          if (partExercises.length === 0) return null;
          return (
            <div key={part.id} className="flex flex-col gap-2">
              {showParts ? (
                <p className="text-xs font-medium text-accent-strong border-t border-border pt-2 first:border-t-0 first:pt-0">
                  Partie {partIdx + 1} · {part.rounds} tour{part.rounds > 1 ? "s" : ""}
                </p>
              ) : null}
              <ol className="flex flex-col gap-2">
                {partExercises.map((exercise) => (
                  <li key={exercise.id}>
                    <button
                      type="button"
                      onClick={() => open(exercise)}
                      className={`w-full text-left p-4 flex items-center justify-between gap-3 transition-colors ${
                        exercise.mastered ? "panel-rpg panel-rpg-gold" : "panel-rpg hover:border-accent"
                      }`}
                    >
                      <div>
                        <p className="font-medium">{exercise.exerciseName}</p>
                        <p className="text-xs text-muted">
                          {exercise.targetSets} séries de{" "}
                          {exercise.targetPerformance || "MAX"}
                          {exercise.unlockType === "duration" ? " s" : " reps"}
                        </p>
                      </div>
                      {exercise.mastered ? <span className="text-gold text-sm font-medium">✓</span> : null}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>

      <dialog
        ref={dialogRef}
        onClose={() => setSelected(null)}
        className="panel-rpg m-auto w-[calc(100%-3rem)] max-w-sm p-5 text-foreground backdrop:bg-black/60"
      >
        {selected ? (
          <div className="flex flex-col gap-3">
            <div>
              <p className="font-display text-lg font-bold text-accent-strong">{selected.exerciseName}</p>
              <p className="text-xs text-muted mt-1">
                {selected.targetSets} séries de {selected.targetPerformance || "MAX"}
                {selected.unlockType === "duration" ? " s" : " reps"}
              </p>
            </div>
            <p className="text-sm text-muted">{selected.exerciseDescription ?? "Description à venir."}</p>
            {error ? <p className="text-xs text-bordeaux">{error}</p> : null}
            {note ? <p className="text-xs text-gold">{note}</p> : null}
            <BadgeChips names={newBadges} />
            <div className="flex gap-2 mt-1">
              {!selected.mastered ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={reportMastery}
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:border-accent transition-colors disabled:opacity-50"
                >
                  {isPending ? "..." : "Marquer comme acquis"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={invalidate}
                  className="flex-1 rounded-lg border border-bordeaux px-3 py-2 text-xs font-medium text-bordeaux hover:bg-locked transition-colors disabled:opacity-50"
                >
                  {isPending ? "..." : "Invalider"}
                </button>
              )}
              <button
                type="button"
                onClick={close}
                className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-accent-strong transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
      <PhaseAdvancedOverlay phaseName={phaseAdvanced} />
    </>
  );
}
