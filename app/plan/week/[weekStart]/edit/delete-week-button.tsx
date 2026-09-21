"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteWeeklyPlan } from "../../../actions";

export default function DeleteWeekButton({ weekStart }: { weekStart: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteWeeklyPlan(weekStart);
      if (!result.ok) {
        setError(result.error ?? "Erreur.");
        return;
      }
      router.push("/plan");
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs text-bordeaux text-left"
      >
        Supprimer cette semaine
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3 text-xs">
        <span className="text-bordeaux">Supprimer toute la semaine ?</span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="text-bordeaux underline"
        >
          {isPending ? "..." : "Confirmer"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="text-muted">
          Annuler
        </button>
      </div>
      {error ? <p className="text-xs text-bordeaux">{error}</p> : null}
    </div>
  );
}
