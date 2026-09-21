"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PlannedSession } from "@/lib/types";
import { validateSet, validateRemainingSets, finalizePlannedSession, markRestDayDone } from "../actions";
import { useLevelUp, LevelUpOverlay, BadgeChips } from "../../xp-feedback";

export default function SessionRunner({ session }: { session: PlannedSession }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [xpTotal, setXpTotal] = useState(0);
  const [badges, setBadges] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [finalized, setFinalized] = useState<{
    fullCompletion?: boolean;
    bonusXp?: number;
    perfectWeekBonusXp?: number;
  } | null>(session.completedAt ? { fullCompletion: session.fullCompletion } : null);
  const { level: levelUp, trigger: triggerLevelUp } = useLevelUp();

  function handleSet(plannedSetId: string) {
    setPendingId(plannedSetId);
    setError(null);
    startTransition(async () => {
      const result = await validateSet(plannedSetId);
      applyResult(result);
      setPendingId(null);
    });
  }

  function handleExercise(plannedExerciseId: string) {
    setPendingId(plannedExerciseId);
    setError(null);
    startTransition(async () => {
      const result = await validateRemainingSets(plannedExerciseId);
      applyResult(result);
      setPendingId(null);
    });
  }

  function handleFinalize() {
    setError(null);
    startTransition(async () => {
      const result = await finalizePlannedSession(session.id);
      if (!result.ok) {
        setError(result.error ?? "Erreur.");
        return;
      }
      setFinalized({
        fullCompletion: result.fullCompletion,
        bonusXp: result.bonusXp,
        perfectWeekBonusXp: result.perfectWeekBonusXp,
      });
      router.refresh();
    });
  }

  function handleRestDay() {
    setError(null);
    startTransition(async () => {
      const result = await markRestDayDone(session.id);
      if (!result.ok) {
        setError(result.error ?? "Erreur.");
        return;
      }
      setFinalized({
        fullCompletion: result.fullCompletion,
        bonusXp: result.bonusXp,
        perfectWeekBonusXp: result.perfectWeekBonusXp,
      });
      router.refresh();
    });
  }

  function applyResult(result: {
    ok: boolean;
    error?: string;
    xpEarned?: number;
    newBadgeNames?: string[];
    leveledUp?: boolean;
    newLevel?: number;
    sessionFinalized?: boolean;
    fullCompletion?: boolean;
    bonusXp?: number;
    perfectWeekBonusXp?: number;
  }) {
    if (!result.ok) {
      setError(result.error ?? "Erreur.");
      return;
    }
    setXpTotal((v) => v + (result.xpEarned ?? 0));
    if (result.newBadgeNames?.length) {
      setBadges((prev) => [...prev, ...result.newBadgeNames!]);
    }
    if (result.leveledUp && result.newLevel) {
      triggerLevelUp(result.newLevel);
    }
    if (result.sessionFinalized) {
      setFinalized({
        fullCompletion: result.fullCompletion,
        bonusXp: result.bonusXp,
        perfectWeekBonusXp: result.perfectWeekBonusXp,
      });
    }
    router.refresh();
  }

  if (session.isRestDay) {
    if (finalized) {
      return (
        <div className="panel-rpg panel-rpg-gold p-6 text-center flex flex-col gap-2">
          <p className="font-display text-2xl font-bold text-gold">Jour de repos terminé.</p>
          {finalized.bonusXp ? <p className="text-sm text-gold">+{finalized.bonusXp} XP repos</p> : null}
          {finalized.perfectWeekBonusXp ? (
            <p className="text-sm text-gold">+{finalized.perfectWeekBonusXp} XP bonus semaine parfaite !</p>
          ) : null}
          <button
            type="button"
            onClick={() => router.push("/plan")}
            className="mt-2 rounded-lg bg-accent px-4 py-3 font-medium text-white hover:bg-accent-strong transition-colors"
          >
            Retour au plan
          </button>
          <LevelUpOverlay level={levelUp} />
        </div>
      );
    }
    return (
      <div className="panel-rpg p-6 text-center flex flex-col gap-3">
        <p className="font-display text-xl font-bold">Jour de repos</p>
        <p className="text-sm text-muted">
          Pas de séance aujourd&apos;hui — récupérer fait aussi partie du plan.
        </p>
        <button
          type="button"
          onClick={handleRestDay}
          disabled={isPending}
          className="rounded-lg bg-accent px-4 py-3 font-medium text-white hover:bg-accent-strong transition-colors disabled:opacity-50"
        >
          {isPending ? "..." : "Marquer comme reposé"}
        </button>
        {error ? <p className="text-sm text-bordeaux">{error}</p> : null}
      </div>
    );
  }

  if (finalized) {
    return (
      <div className="panel-rpg panel-rpg-gold p-6 text-center flex flex-col gap-2">
        <p className="font-display text-2xl font-bold text-gold">
          {finalized.fullCompletion ? "Séance terminée à 100% !" : "Séance terminée."}
        </p>
        <p className="text-sm text-muted">{xpTotal} XP gagné sur cette séance.</p>
        {finalized.bonusXp ? (
          <p className="text-sm text-gold">+{finalized.bonusXp} XP bonus séance complète</p>
        ) : null}
        {finalized.perfectWeekBonusXp ? (
          <p className="text-sm text-gold">+{finalized.perfectWeekBonusXp} XP bonus semaine parfaite !</p>
        ) : null}
        <button
          type="button"
          onClick={() => router.push("/plan")}
          className="mt-2 rounded-lg bg-accent px-4 py-3 font-medium text-white hover:bg-accent-strong transition-colors"
        >
          Retour au plan
        </button>
        <BadgeChips names={badges} />
        <LevelUpOverlay level={levelUp} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {session.exercises.map((exercise) => {
        const remaining = exercise.sets.filter((s) => !s.doneAt).length;
        return (
          <div key={exercise.id} className="panel-rpg p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="font-medium">{exercise.exerciseName}</p>
              <span className="text-xs text-muted">
                {exercise.targetPerformance}
                {exercise.unlockType === "duration" ? " s" : " reps"} / série
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {exercise.sets.map((set) => (
                <button
                  key={set.id}
                  type="button"
                  disabled={Boolean(set.doneAt) || (isPending && pendingId === set.id)}
                  onClick={() => handleSet(set.id)}
                  className={`h-10 w-10 rounded-lg border text-sm font-medium transition-colors ${
                    set.doneAt
                      ? "border-gold bg-locked text-gold"
                      : "border-border text-foreground hover:border-accent"
                  }`}
                >
                  {set.doneAt ? "✓" : set.setNumber}
                </button>
              ))}
            </div>
            {remaining > 1 ? (
              <button
                type="button"
                disabled={isPending && pendingId === exercise.id}
                onClick={() => handleExercise(exercise.id)}
                className="text-sm text-accent-strong text-left"
              >
                Valider tout l&apos;exercice ({remaining} restantes)
              </button>
            ) : null}
          </div>
        );
      })}

      {xpTotal > 0 ? <p className="text-sm text-accent-strong">{xpTotal} XP gagné jusqu&apos;ici.</p> : null}
      <BadgeChips names={badges} />
      {error ? <p className="text-sm text-bordeaux">{error}</p> : null}

      <button
        type="button"
        onClick={handleFinalize}
        disabled={isPending}
        className="rounded-lg border border-gold px-4 py-3 font-medium text-gold hover:bg-locked transition-colors disabled:opacity-50"
      >
        Terminer la séance
      </button>

      <LevelUpOverlay level={levelUp} />
    </div>
  );
}
