"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { selfReportCircuitCompletion, uncompleteCircuit } from "../../actions";
import { usePhaseAdvanced, PhaseAdvancedOverlay, BadgeChips } from "../../../xp-feedback";

export function CircuitCompletionToggle({ templateId, completed }: { templateId: string; completed: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [newBadges, setNewBadges] = useState<string[]>([]);
  const { phaseName: phaseAdvanced, trigger: triggerPhaseAdvanced } = usePhaseAdvanced();

  function toggle() {
    setError(null);
    setNote(null);
    setNewBadges([]);
    startTransition(async () => {
      const result = completed
        ? await uncompleteCircuit(templateId)
        : await selfReportCircuitCompletion(templateId);
      if (!result.ok) {
        setError(result.error ?? "Erreur.");
        return;
      }
      if (result.newPhaseName) triggerPhaseAdvanced(result.newPhaseName);
      if (result.revertedPhaseName) {
        setNote(`Les prérequis de la phase suivante ne sont plus remplis : retour à "${result.revertedPhaseName}".`);
      }
      if (result.newBadgeNames?.length) setNewBadges(result.newBadgeNames);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={toggle}
        className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors disabled:opacity-50 ${
          completed
            ? "border border-bordeaux text-bordeaux hover:bg-locked"
            : "bg-accent text-white hover:bg-accent-strong"
        }`}
      >
        {isPending ? "..." : completed ? "✓ Circuit acquis - invalider" : "J'ai déjà fait ce circuit"}
      </button>
      {error ? <p className="text-xs text-bordeaux">{error}</p> : null}
      {note ? <p className="text-xs text-gold">{note}</p> : null}
      <BadgeChips names={newBadges} />
      <PhaseAdvancedOverlay phaseName={phaseAdvanced} />
    </div>
  );
}
