"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Phase } from "@/lib/types";
import { phasesToAskAbout, pickStartingPhase, type PhasePrerequisiteAnswer } from "@/lib/phase-placement";
import { completeOnboarding } from "./actions";

/**
 * Séquentiel, du plus dur au plus facile : "as-tu déjà les prérequis de la
 * phase N ?" — dès qu'on répond oui, ou qu'on atteint une phase sans
 * prérequis (phase 1), c'est fini (voir lib/phase-placement.ts).
 */
export function OnboardingWizard({ phases }: { phases: Phase[] }) {
  const router = useRouter();
  const questions = useMemo(() => phasesToAskAbout(phases), [phases]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<PhasePrerequisiteAnswer[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (questions.length === 0) {
    return <p className="text-sm text-muted">Aucune phase configurée pour le moment.</p>;
  }

  const current = questions[step];

  function answer(meetsPrerequisites: boolean) {
    const nextAnswers = [...answers, { phaseId: current.id, meetsPrerequisites }];

    if (meetsPrerequisites || !questions[step + 1]) {
      const chosenPhase = pickStartingPhase(phases, nextAnswers);
      setError(null);
      startTransition(async () => {
        const result = await completeOnboarding(chosenPhase.id);
        if (!result.ok) {
          setError(result.error ?? "Erreur.");
          return;
        }
        router.push("/dashboard");
        router.refresh();
      });
      return;
    }

    setAnswers(nextAnswers);
    setStep((s) => s + 1);
  }

  return (
    <div className="panel-rpg p-5 flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium text-accent-strong">{current.name}</p>
        {current.prerequisitesText ? (
          <p className="mt-1 text-sm text-muted">
            Peux-tu déjà faire : {current.prerequisitesText} ?
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted">
            Pas de prérequis — c&apos;est le point de départ par défaut.
          </p>
        )}
      </div>
      {current.prerequisitesText ? (
        <div className="flex gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={() => answer(true)}
            className="flex-1 rounded-lg bg-accent px-4 py-3 text-sm font-medium text-white hover:bg-accent-strong transition-colors disabled:opacity-50"
          >
            Oui
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => answer(false)}
            className="flex-1 rounded-lg border border-border px-4 py-3 text-sm font-medium hover:border-accent transition-colors disabled:opacity-50"
          >
            Pas encore
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={isPending}
          onClick={() => answer(false)}
          className="rounded-lg bg-accent px-4 py-3 text-sm font-medium text-white hover:bg-accent-strong transition-colors disabled:opacity-50"
        >
          {isPending ? "..." : "Commencer"}
        </button>
      )}
      {error ? <p className="text-xs text-bordeaux">{error}</p> : null}
    </div>
  );
}
