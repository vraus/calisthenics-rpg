import { createClient } from "@/lib/supabase/server";
import { getRecentSessions } from "@/lib/data";

export const metadata = { title: "Historique — Calisthenics RPG" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-muted text-sm">Connecte-toi pour voir ton historique.</p>
      </main>
    );
  }

  const sessions = await getRecentSessions(user.id, 100);

  return (
    <main className="flex flex-1 flex-col px-6 py-8 max-w-xl mx-auto w-full gap-4">
      <h1 className="text-xl font-semibold">Historique des séances</h1>

      {sessions.length === 0 ? (
        <p className="text-sm text-muted">Aucune séance enregistrée pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions.map((s) => {
            const exerciseName =
              (s as { exercises?: { name?: string } | null }).exercises?.name ??
              "Exercice";
            const performance =
              s.reps_per_set != null
                ? `${s.sets} × ${s.reps_per_set} reps`
                : `${s.sets} × ${s.duration_seconds}s`;

            return (
              <li
                key={s.id}
                className="rounded-lg border border-border bg-surface p-3 flex items-center justify-between text-sm"
              >
                <div>
                  <p className="font-medium">{exerciseName}</p>
                  <p className="text-xs text-muted">
                    {performance} · {formatDate(s.performed_at)}
                  </p>
                </div>
                <span className="text-accent-strong font-medium">
                  +{s.xp_earned} XP
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
