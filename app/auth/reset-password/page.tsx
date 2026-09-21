"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(null);

    if (password.length < 8) {
      setStatus("error");
      setErrorMessage("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirmation) {
      setStatus("error");
      setErrorMessage("Les mots de passe ne correspondent pas.");
      return;
    }

    setStatus("saving");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus("error");
      setErrorMessage("Le lien a peut-être expiré. Redemande un email.");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-foreground mb-1">
          Nouveau mot de passe
        </h1>
        <p className="text-sm text-muted mb-8">
          Choisis un mot de passe pour ton compte.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            required
            placeholder="Nouveau mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="rounded-lg border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <input
            type="password"
            required
            placeholder="Confirme le mot de passe"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoComplete="new-password"
            className="rounded-lg border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            type="submit"
            disabled={status === "saving"}
            className="rounded-lg bg-accent px-4 py-3 font-medium text-white transition-colors hover:bg-accent-strong disabled:opacity-50"
          >
            {status === "saving" ? "Enregistrement..." : "Enregistrer"}
          </button>
          {status === "error" && errorMessage ? (
            <p className="text-sm text-bordeaux">{errorMessage}</p>
          ) : null}
        </form>
      </div>
    </main>
  );
}
