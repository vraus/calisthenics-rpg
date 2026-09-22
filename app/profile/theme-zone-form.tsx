"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Phase } from "@/lib/types";
import { setThemeZone } from "./actions";

interface ThemeZoneFormProps {
  phases: Phase[];
  /** Zone actuellement affichée : themeZoneId si posé, sinon currentPhaseId. */
  activePhaseId?: string;
  /** sortOrder de la phase de progression réelle du joueur — verrouille les zones au-delà. */
  unlockedSortOrder: number;
}

export function ThemeZoneForm({ phases, activePhaseId, unlockedSortOrder }: ThemeZoneFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function choose(phaseId: string) {
    setError(null);
    startTransition(async () => {
      const result = await setThemeZone(phaseId);
      if (!result.ok) {
        setError(result.error ?? "Erreur.");
        return;
      }
      router.refresh();
    });
  }

  const sorted = [...phases].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted">Thème</p>
      <div className="flex gap-2">
        {sorted.map((phase) => {
          const active = phase.id === activePhaseId;
          const locked = phase.sortOrder > unlockedSortOrder;
          return (
            <button
              key={phase.id}
              type="button"
              disabled={isPending || locked}
              onClick={() => choose(phase.id)}
              title={locked ? "Zone pas encore débloquée" : undefined}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                locked
                  ? "border-border text-muted opacity-50 cursor-not-allowed"
                  : active
                    ? "border-accent bg-accent text-white"
                    : "border-border hover:border-accent"
              }`}
            >
              {locked ? "🔒 " : ""}Zone {phase.sortOrder}
            </button>
          );
        })}
      </div>
      {error ? <p className="text-xs text-bordeaux">{error}</p> : null}
    </div>
  );
}
