"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { copyWeekToNextWeek } from "./actions";

export default function CopyWeekButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await copyWeekToNextWeek();
      if (!result.ok) {
        setError(result.error ?? "Erreur.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="text-sm text-accent-strong text-left disabled:opacity-50"
      >
        {isPending ? "Copie..." : "Copier vers la semaine prochaine →"}
      </button>
      {error ? <p className="text-xs text-bordeaux">{error}</p> : null}
    </div>
  );
}
