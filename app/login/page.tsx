"use client";

import { useState, useTransition } from "react";
import { login, requestPasswordReset, signup } from "./actions";

type Mode = "login" | "reset" | "signup";

export default function LoginPage() {
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>("login");
  const [loginError, setLoginError] = useState<string | null>(null);

  const [resetEmail, setResetEmail] = useState("");
  const [resetStatus, setResetStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [resetError, setResetError] = useState<string | null>(null);

  const [signupStatus, setSignupStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [signupError, setSignupError] = useState<string | null>(null);

  function resetSubStates() {
    setResetStatus("idle");
    setResetError(null);
    setSignupStatus("idle");
    setSignupError(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await login(formData);
      if (result?.error) {
        setLoginError(result.error);
      }
    });
  }

  function handleResetSubmit(event: React.FormEvent) {
    event.preventDefault();
    setResetStatus("sending");
    setResetError(null);

    const formData = new FormData();
    formData.set("email", resetEmail);

    startTransition(async () => {
      const result = await requestPasswordReset(formData);
      if (result.error) {
        setResetStatus("error");
        setResetError(result.error);
        return;
      }
      setResetStatus("sent");
    });
  }

  function handleSignupSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSignupStatus("sending");
    setSignupError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await signup(formData);
      if (result.error) {
        setSignupStatus("error");
        setSignupError(result.error);
        return;
      }
      setSignupStatus("sent");
    });
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-foreground mb-1">
          Calisthenics RPG
        </h1>
        <p className="text-sm text-muted mb-8">Connecte-toi pour continuer.</p>

        {mode === "login" ? (
          <>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <input
                type="email"
                name="email"
                required
                placeholder="ton@email.com"
                autoComplete="email"
                className="rounded-lg border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <input
                type="password"
                name="password"
                required
                placeholder="Mot de passe"
                autoComplete="current-password"
                className="rounded-lg border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <label className="flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" name="remember" className="h-4 w-4" />
                Rester connecté sur cet appareil pendant 30 jours
              </label>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-accent px-4 py-3 font-medium text-white transition-colors hover:bg-accent-strong disabled:opacity-50"
              >
                {isPending ? "Connexion..." : "Se connecter"}
              </button>
              {loginError ? (
                <p className="text-sm text-bordeaux">{loginError}</p>
              ) : null}
            </form>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  resetSubStates();
                  setMode("reset");
                }}
                className="text-sm text-muted underline underline-offset-2 hover:text-accent-strong text-left"
              >
                Mot de passe oublié ?
              </button>
              <button
                type="button"
                onClick={() => {
                  resetSubStates();
                  setMode("signup");
                }}
                className="text-sm text-muted underline underline-offset-2 hover:text-accent-strong text-left"
              >
                Créer un compte
              </button>
            </div>
          </>
        ) : mode === "reset" ? (
          <div className="flex flex-col gap-4">
            {resetStatus === "sent" ? (
              <p className="rounded-lg border border-border bg-surface p-4 text-sm text-foreground">
                Si un compte existe pour {resetEmail}, un email vient d&apos;être
                envoyé avec un lien pour définir ton mot de passe.
              </p>
            ) : (
              <form onSubmit={handleResetSubmit} className="flex flex-col gap-4">
                <input
                  type="email"
                  required
                  placeholder="ton@email.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="rounded-lg border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <button
                  type="submit"
                  disabled={resetStatus === "sending"}
                  className="rounded-lg bg-accent px-4 py-3 font-medium text-white transition-colors hover:bg-accent-strong disabled:opacity-50"
                >
                  {resetStatus === "sending" ? "Envoi..." : "Recevoir le lien"}
                </button>
                {resetStatus === "error" && resetError ? (
                  <p className="text-sm text-bordeaux">{resetError}</p>
                ) : null}
              </form>
            )}
            <button
              type="button"
              onClick={() => setMode("login")}
              className="text-sm text-muted underline underline-offset-2 hover:text-accent-strong"
            >
              Retour à la connexion
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {signupStatus === "sent" ? (
              <p className="rounded-lg border border-border bg-surface p-4 text-sm text-foreground">
                Compte créé. Vérifie ta boîte mail pour l&apos;activer, puis
                connecte-toi.
              </p>
            ) : (
              <form onSubmit={handleSignupSubmit} className="flex flex-col gap-4">
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="ton@email.com"
                  autoComplete="email"
                  className="rounded-lg border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <input
                  type="password"
                  name="password"
                  required
                  placeholder="Mot de passe"
                  autoComplete="new-password"
                  className="rounded-lg border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <input
                  type="password"
                  name="confirmPassword"
                  required
                  placeholder="Confirme le mot de passe"
                  autoComplete="new-password"
                  className="rounded-lg border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <input
                  type="text"
                  name="inviteCode"
                  required
                  placeholder="Code d'invitation"
                  className="rounded-lg border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <button
                  type="submit"
                  disabled={signupStatus === "sending"}
                  className="rounded-lg bg-accent px-4 py-3 font-medium text-white transition-colors hover:bg-accent-strong disabled:opacity-50"
                >
                  {signupStatus === "sending" ? "Création..." : "Créer le compte"}
                </button>
                {signupStatus === "error" && signupError ? (
                  <p className="text-sm text-bordeaux">{signupError}</p>
                ) : null}
              </form>
            )}
            <button
              type="button"
              onClick={() => setMode("login")}
              className="text-sm text-muted underline underline-offset-2 hover:text-accent-strong"
            >
              Retour à la connexion
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
