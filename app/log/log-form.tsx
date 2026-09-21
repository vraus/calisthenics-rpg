"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { ExerciseFamily } from "@/lib/types";
import type { TreeNodeState } from "@/lib/xp";
import { logSession } from "./actions";

interface Group {
  family: ExerciseFamily;
  nodes: TreeNodeState[];
}

export default function LogForm({ groups }: { groups: Group[] }) {
  const allNodes = useMemo(() => groups.flatMap((g) => g.nodes), [groups]);
  const firstUnlocked = allNodes.find((n) => n.unlocked);

  const [exerciseId, setExerciseId] = useState(firstUnlocked?.id ?? "");
  const [sets, setSets] = useState(3);
  const [performance, setPerformance] = useState(8);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    { kind: "success" | "error"; message: string; badges?: string[] } | null
  >(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);

  useEffect(() => {
    if (levelUp === null) return;
    const timer = setTimeout(() => setLevelUp(null), 2500);
    return () => clearTimeout(timer);
  }, [levelUp]);

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
      if (result.leveledUp && result.newLevel) {
        setLevelUp(result.newLevel);
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
            value={sets}
            onChange={(e) => setSets(Number(e.target.value))}
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
            value={performance}
            onChange={(e) => setPerformance(Number(e.target.value))}
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
          className="rounded-lg bg-accent px-4 py-3 font-medium text-white transition-colors hover:bg-accent-strong disabled:opacity-50"
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
            {feedback.badges?.map((name) => (
              <span
                key={name}
                className="panel-rpg panel-rpg-gold inline-flex w-fit items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gold"
              >
                🏆 Nouveau badge : {name}
              </span>
            ))}
          </div>
        ) : null}
      </form>

      {levelUp !== null ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="panel-rpg panel-rpg-gold animate-level-up px-10 py-6 text-center">
            <p className="text-xs uppercase tracking-widest text-gold">Niveau supérieur</p>
            <p className="font-display text-4xl font-bold text-gold">Niveau {levelUp}</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
