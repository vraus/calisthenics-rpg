"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PlannedSession } from "@/lib/types";
import { validateSet, validateRemainingSets, finalizePlannedSession, markRestDayDone } from "./actions";
import {
  useLevelUp,
  LevelUpOverlay,
  BadgeChips,
  usePerfectWeek,
  PerfectWeekOverlay,
  usePhaseAdvanced,
  PhaseAdvancedOverlay,
} from "../xp-feedback";
import { fireConfettiBurst, fireConfettiCelebration, fireConfettiGrand } from "../confetti";

interface InitialSummary {
  xpEarned: number;
  bonusXp?: number;
}

const PRESS_EFFECT = "active:scale-95 duration-100";

export default function SessionRunner({
  session,
  initialSummary,
}: {
  session: PlannedSession;
  initialSummary?: InitialSummary;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [doneSetIds, setDoneSetIds] = useState<Set<string>>(
    () => new Set(session.exercises.flatMap((ex) => ex.sets.filter((s) => s.doneAt).map((s) => s.id)))
  );
  const [xpTotal, setXpTotal] = useState(initialSummary?.xpEarned ?? 0);
  const [badges, setBadges] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Combien de reps/secondes réellement faites, éditable par exercice —
  // pré-rempli avec la cible du planning (0 pour un objectif "X MAX", à
  // renseigner soi-même en validant). Partagé par toutes les séries d'un
  // même exercice : la case se réédite entre deux clics si une série
  // diffère de la précédente.
  const [performanceByExercise, setPerformanceByExercise] = useState<Record<string, number>>(() =>
    Object.fromEntries(session.exercises.map((ex) => [ex.id, ex.targetPerformance]))
  );
  const [finalized, setFinalized] = useState<{
    fullCompletion?: boolean;
    bonusXp?: number;
    perfectWeekBonusXp?: number;
  } | null>(
    session.completedAt
      ? { fullCompletion: session.fullCompletion, bonusXp: initialSummary?.bonusXp }
      : null
  );
  const { level: levelUp, trigger: triggerLevelUp } = useLevelUp();
  const { active: perfectWeek, trigger: triggerPerfectWeek } = usePerfectWeek();
  const { phaseName: phaseAdvanced, trigger: triggerPhaseAdvanced } = usePhaseAdvanced();

  // Une phase qui vient de se compléter change aussi le thème par défaut
  // (lib/theme.ts) : router.refresh() force le layout racine (<html
  // data-zone>) à se re-rendre tout de suite, sans attendre une navigation.
  function celebratePhaseAdvance(newPhaseName?: string) {
    if (!newPhaseName) return;
    triggerPhaseAdvanced(newPhaseName);
    router.refresh();
  }

  /** Escalating confetti for a just-finalized day, plus the perfect-week wave on top. */
  function celebrateFinalization(fullCompletion?: boolean, perfectWeekBonusXp?: number) {
    if (fullCompletion) {
      fireConfettiGrand();
    } else {
      fireConfettiCelebration();
    }
    if (perfectWeekBonusXp) {
      setTimeout(() => {
        fireConfettiGrand();
        triggerPerfectWeek();
      }, 500);
    }
  }

  function handleSet(plannedSetId: string, exerciseId: string) {
    setPendingId(plannedSetId);
    setError(null);
    const performance = performanceByExercise[exerciseId];
    startTransition(async () => {
      const result = await validateSet(plannedSetId, performance);
      if (result.ok) {
        setDoneSetIds((prev) => new Set(prev).add(plannedSetId));
      }
      applyResult(result);
      setPendingId(null);
    });
  }

  function handleExercise(plannedExerciseId: string) {
    setPendingId(plannedExerciseId);
    setError(null);
    const exercise = session.exercises.find((ex) => ex.id === plannedExerciseId);
    const remainingSetIds = exercise?.sets.filter((s) => !s.doneAt).map((s) => s.id) ?? [];
    const performance = performanceByExercise[plannedExerciseId];
    startTransition(async () => {
      const result = await validateRemainingSets(plannedExerciseId, performance);
      if (result.ok) {
        setDoneSetIds((prev) => {
          const next = new Set(prev);
          for (const id of remainingSetIds) next.add(id);
          return next;
        });
      }
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
      celebrateFinalization(result.fullCompletion, result.perfectWeekBonusXp);
      celebratePhaseAdvance(result.newPhaseName);
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
      celebrateFinalization(result.fullCompletion, result.perfectWeekBonusXp);
      celebratePhaseAdvance(result.newPhaseName);
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
    newPhaseName?: string;
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
    celebratePhaseAdvance(result.newPhaseName);
    if (result.sessionFinalized) {
      setFinalized({
        fullCompletion: result.fullCompletion,
        bonusXp: result.bonusXp,
        perfectWeekBonusXp: result.perfectWeekBonusXp,
      });
      celebrateFinalization(result.fullCompletion, result.perfectWeekBonusXp);
    } else {
      fireConfettiBurst();
    }
  }

  if (session.dayKind === "rest") {
    if (finalized) {
      return (
        <div
          className={`panel-rpg panel-rpg-gold p-6 text-center flex flex-col gap-2 ${
            finalized.fullCompletion ? "animate-celebrate-in" : ""
          }`}
        >
          <p className="font-display text-2xl font-bold text-gold">Jour de repos terminé.</p>
          {finalized.bonusXp ? <p className="text-sm text-gold">+{finalized.bonusXp} XP repos</p> : null}
          {finalized.perfectWeekBonusXp ? (
            <p className="text-sm text-gold">+{finalized.perfectWeekBonusXp} XP bonus semaine parfaite !</p>
          ) : null}
          <button
            type="button"
            onClick={() => router.push("/plan")}
            className={`mt-2 rounded-lg bg-accent px-4 py-3 font-medium text-white hover:bg-accent-strong transition-all ${PRESS_EFFECT}`}
          >
            Retour au plan
          </button>
          <LevelUpOverlay level={levelUp} />
          <PerfectWeekOverlay active={perfectWeek} />
          <PhaseAdvancedOverlay phaseName={phaseAdvanced} />
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
          className={`rounded-lg bg-accent px-4 py-3 font-medium text-white hover:bg-accent-strong transition-all disabled:opacity-50 ${PRESS_EFFECT}`}
        >
          {isPending ? "..." : "Marquer comme reposé"}
        </button>
        {error ? <p className="text-sm text-bordeaux">{error}</p> : null}
      </div>
    );
  }

  if (finalized) {
    return (
      <div
        className={`panel-rpg panel-rpg-gold p-6 text-center flex flex-col gap-2 ${
          finalized.fullCompletion ? "animate-celebrate-in" : ""
        }`}
      >
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
          className={`mt-2 rounded-lg bg-accent px-4 py-3 font-medium text-white hover:bg-accent-strong transition-all ${PRESS_EFFECT}`}
        >
          Retour au plan
        </button>
        <BadgeChips names={badges} />
        <LevelUpOverlay level={levelUp} />
        <PerfectWeekOverlay active={perfectWeek} />
        <PhaseAdvancedOverlay phaseName={phaseAdvanced} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {session.rounds > 1 ? (
        <p className="text-sm text-muted">
          {session.rounds} tours · {session.restBetweenRoundsSeconds}s de repos entre chaque tour
        </p>
      ) : null}
      {session.exercises.map((exercise) => {
        const remaining = exercise.sets.filter((s) => !doneSetIds.has(s.id)).length;
        const performance = performanceByExercise[exercise.id] ?? exercise.targetPerformance;
        const unit = exercise.unlockType === "duration" ? "s" : "reps";
        return (
          <div key={exercise.id} className="panel-rpg p-4 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <p className="min-w-0 font-medium">{exercise.exerciseName}</p>
              <span className="shrink-0 whitespace-nowrap text-xs text-muted">
                Cible : {exercise.targetPerformance || "MAX"}
                {exercise.unlockType === "duration" ? " s" : " reps"} / série
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="shrink-0">Fait :</span>
              <input
                type="number"
                min={1}
                value={performance === 0 ? "" : performance}
                onChange={(e) => {
                  const raw = e.target.value;
                  setPerformanceByExercise((prev) => ({
                    ...prev,
                    [exercise.id]: raw === "" ? 0 : Number(raw),
                  }));
                }}
                placeholder={exercise.targetPerformance === 0 ? "?" : undefined}
                className="w-16 shrink-0 rounded-lg border border-border bg-surface px-2 py-1 text-foreground text-sm"
              />
              <span className="shrink-0">{unit}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {exercise.sets.map((set) => {
                const done = doneSetIds.has(set.id);
                return (
                  <button
                    key={set.id}
                    type="button"
                    disabled={done || (isPending && pendingId === set.id)}
                    onClick={() => handleSet(set.id, exercise.id)}
                    className={`h-10 w-10 rounded-lg border text-sm font-medium transition-all ${PRESS_EFFECT} ${
                      done
                        ? "border-gold bg-locked text-gold"
                        : "border-border text-foreground hover:border-accent"
                    }`}
                  >
                    {done ? "✓" : set.setNumber}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted">
              Repos : {exercise.restBetweenSetsSeconds}s entre séries ·{" "}
              {Math.round(exercise.restAfterExerciseSeconds / 60) >= 1 &&
              exercise.restAfterExerciseSeconds % 60 === 0
                ? `${exercise.restAfterExerciseSeconds / 60} min`
                : `${exercise.restAfterExerciseSeconds}s`}{" "}
              avant l&apos;exercice suivant
            </p>
            {remaining > 1 ? (
              <button
                type="button"
                disabled={isPending && pendingId === exercise.id}
                onClick={() => handleExercise(exercise.id)}
                className={`text-sm text-accent-strong text-left ${PRESS_EFFECT}`}
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
        className={`rounded-lg border border-gold px-4 py-3 font-medium text-gold hover:bg-locked transition-all disabled:opacity-50 ${PRESS_EFFECT}`}
      >
        Terminer la séance
      </button>

      <LevelUpOverlay level={levelUp} />
      <PhaseAdvancedOverlay phaseName={phaseAdvanced} />
    </div>
  );
}
