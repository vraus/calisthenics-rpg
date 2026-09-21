"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateUsername } from "./actions";

export default function UsernameForm({ username }: { username: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(username);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const formData = new FormData();
    formData.set("username", value);

    startTransition(async () => {
      const result = await updateUsername(formData);
      if (!result.ok) {
        setError(result.error ?? "Erreur.");
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between">
        <p className="font-display text-2xl font-bold text-foreground">{username}</p>
        <button
          type="button"
          onClick={() => {
            setValue(username);
            setError(null);
            setEditing(true);
          }}
          className="text-xs text-accent-strong"
        >
          Modifier
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-foreground text-sm"
          autoFocus
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-strong transition-colors disabled:opacity-50"
        >
          {isPending ? "..." : "Enregistrer"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-xs text-muted">
          Annuler
        </button>
      </div>
      {error ? <p className="text-xs text-bordeaux">{error}</p> : null}
    </form>
  );
}
