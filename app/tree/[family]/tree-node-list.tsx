"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TreeNodeState } from "@/lib/xp";
import { selfReportMastery, unmasterLevel } from "../actions";
import { usePhaseAdvanced, PhaseAdvancedOverlay, BadgeChips } from "../../xp-feedback";

export function TreeNodeList({ nodes }: { nodes: TreeNodeState[] }) {
  const [selected, setSelected] = useState<TreeNodeState | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [newBadges, setNewBadges] = useState<string[]>([]);
  const { phaseName: phaseAdvanced, trigger: triggerPhaseAdvanced } = usePhaseAdvanced();

  function open(node: TreeNodeState) {
    setSelected(node);
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
      const result = await selfReportMastery(selected.id);
      if (!result.ok) {
        setError(result.error ?? "Erreur.");
        return;
      }
      // Déclenche l'état avant router.refresh() (pas l'inverse) - sinon le
      // rafraîchissement peut interrompre la mise à jour avant qu'elle ne
      // s'applique et la popup n'apparaît jamais.
      if (result.newPhaseName) triggerPhaseAdvanced(result.newPhaseName);
      if (result.newBadgeNames?.length) {
        // Pas de fermeture auto : le joueur doit voir les badges gagnés.
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
      const result = await unmasterLevel(selected.id);
      if (!result.ok) {
        setError(result.error ?? "Erreur.");
        return;
      }
      if (result.revertedPhaseName) {
        // Pas de fermeture auto : le joueur doit voir qu'il repasse de phase
        // avant que la dialogue ne disparaisse.
        setNote(`Les prérequis de la phase suivante ne sont plus remplis : retour à "${result.revertedPhaseName}".`);
        router.refresh();
        return;
      }
      close();
    });
  }

  return (
    <>
      <ol className="flex flex-col gap-2">
        {nodes.map((node, i) => {
          const state = node.mastered ? "mastered" : node.unlocked ? "unlocked" : "locked";

          return (
            <li key={node.id}>
              <button
                type="button"
                onClick={() => open(node)}
                className={`w-full text-left p-4 flex items-center gap-3 transition-colors ${
                  state === "locked"
                    ? "rounded-lg border border-border bg-locked text-muted hover:border-accent"
                    : state === "mastered"
                      ? "panel-rpg panel-rpg-gold"
                      : "panel-rpg hover:border-accent"
                }`}
              >
                <span className="text-xs w-6 text-center font-mono text-muted">{i + 1}</span>
                <div className="flex-1">
                  <p className="font-medium">{node.name}</p>
                  <p className="text-xs text-muted">
                    {state === "locked"
                      ? "Pas encore recommandé"
                      : `Seuil de maîtrise : ${node.unlockThreshold}${
                          node.unlockType === "duration" ? " s" : " reps"
                        }`}
                  </p>
                </div>
                {state === "mastered" ? <span className="text-gold text-sm font-medium">✓</span> : null}
              </button>
            </li>
          );
        })}
      </ol>

      <dialog
        ref={dialogRef}
        onClose={() => setSelected(null)}
        className="panel-rpg m-auto w-[calc(100%-3rem)] max-w-sm p-5 text-foreground backdrop:bg-black/60"
      >
        {selected ? (
          <div className="flex flex-col gap-3">
            <div>
              <p className="font-display text-lg font-bold text-accent-strong">{selected.name}</p>
              <p className="text-xs text-muted mt-1">
                Seuil de maîtrise : {selected.unlockThreshold}
                {selected.unlockType === "duration" ? " s" : " reps"}
              </p>
            </div>
            <p className="text-sm text-muted">
              {selected.description ?? "Description à venir."}
            </p>
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
                  {isPending ? "..." : "Je maîtrisais déjà ce niveau"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={invalidate}
                  className="flex-1 rounded-lg border border-bordeaux px-3 py-2 text-xs font-medium text-bordeaux hover:bg-locked transition-colors disabled:opacity-50"
                >
                  {isPending ? "..." : "Invalider ce niveau"}
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
