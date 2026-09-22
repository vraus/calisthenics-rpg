"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ExerciseFamily } from "@/lib/types";
import type { TreeNodeState } from "@/lib/xp";
import { logSession } from "./actions";
import { useLevelUp, LevelUpOverlay, BadgeChips, usePhaseAdvanced, PhaseAdvancedOverlay } from "../xp-feedback";
import { fireConfettiCelebration } from "../confetti";

interface Group {
  family: ExerciseFamily;
  nodes: TreeNodeState[];
}

export default function LogForm({ groups }: { groups: Group[] }) {
  const router = useRouter();
  const allNodes = useMemo(() => groups.flatMap((g) => g.nodes), [groups]);
  const firstUnlocked = allNodes.find((n) => n.unlocked);

  const [exerciseId, setExerciseId] = useState(firstUnlocked?.id ?? "");
  const [sets, setSets] = useState(3);
  const [performance, setPerformance] = useState(8);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    { kind: "success" | "error"; message: string; badges?: string[] } | null
  >(null);
  const { level: levelUp, trigger: triggerLevelUp } = useLevelUp();
  const { phaseName: phaseAdvanced, trigger: triggerPhaseAdvanced } = usePhaseAdvanced();

  const selected = allNodes.find((n) => n.id === exerciseId);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;

    const formData = new FormData();
    formData.set("exerciseId", selected.id);
    formData.set("sets", String(sets));
    if (selected.unlockType === "reps") {
      formData.set("repsPerSet", String(performance));
    } else {
      formData.set("durationSeconds", String(performance));
    }

    startTransition(async () => {
      const result = await logSession(formData);
      if (!result.ok) {
        setFeedback({ kind: "error", message: result.error ?? "Erreur." });
        return;
      }
      const masteredNote = result.justMastered
        ? ` Tier suivant débloqué sur ${selected.name}.`
        : "";
      setFeedback({
        kind: "success",
        message: `+${result.xpEarned} XP.${masteredNote}`,
        badges: result.newBadgeNames,
      });
      fireConfettiCelebration();
      if (result.leveledUp && result.newLevel) {
        triggerLevelUp(result.newLevel);
      }
      if (result.newPhaseName) {
        triggerPhaseAdvanced(result.newPhaseName);
        // Force le layout racine (<html data-zone>) à se re-rendre tout de
        // suite avec le nouveau thème, sans attendre une navigation.
        router.refresh();
      }
    });
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-2">
          <span className="text-sm text-muted">Exercice</span>
          <select
            value={exerciseId}
            onChange={(e) => setExerciseId(e.target.value)}
            className="rounded-lg border border-border bg-surface px-4 py-3 text-foreground"
          >
            {groups.map(({ family, nodes }) => (
              <optgroup key={family.id} label={family.name}>
                {nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm text-muted">Séries</span>
          <input
            type="number"
            min={1}
            value={sets === 0 ? "" : sets}
            onChange={(e) => {
              const raw = e.target.value;
              setSets(raw === "" ? 0 : Number(raw));
            }}
            className="rounded-lg border border-border bg-surface px-4 py-3 text-foreground"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm text-muted">
            {selected?.unlockType === "duration"
              ? "Durée par série (secondes)"
              : "Répétitions par série"}
          </span>
          <input
            type="number"
            min={1}
            value={performance === 0 ? "" : performance}
            onChange={(e) => {
              const raw = e.target.value;
              setPerformance(raw === "" ? 0 : Number(raw));
            }}
            className="rounded-lg border border-border bg-surface px-4 py-3 text-foreground"
          />
          {selected ? (
            <span className="text-xs text-muted">
              Seuil de maîtrise : {selected.unlockThreshold}
              {selected.unlockType === "duration" ? " s" : " reps"}
            </span>
          ) : null}
        </label>

        <button
          type="submit"
          disabled={isPending || !selected}
          className="rounded-lg bg-accent px-4 py-3 font-medium text-white transition-all duration-150 active:scale-95 hover:bg-accent-strong disabled:opacity-50"
        >
          {isPending ? "Enregistrement..." : "Valider la séance"}
        </button>

        {feedback ? (
          <div className="flex flex-col gap-2">
            <p
              className={`text-sm ${
                feedback.kind === "success" ? "text-accent-strong" : "text-bordeaux"
              }`}
            >
              {feedback.message}
            </p>
            <BadgeChips names={feedback.badges} />
          </div>
        ) : null}
      </form>

      <LevelUpOverlay level={levelUp} />
      <PhaseAdvancedOverlay phaseName={phaseAdvanced} />
    </>
  );
}
