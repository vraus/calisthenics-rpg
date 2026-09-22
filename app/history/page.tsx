import Link from "next/link";
import { getAuthenticatedUserId } from "@/lib/auth";
import { getHistoryEntries } from "@/lib/data";

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
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-muted text-sm">Connecte-toi pour voir ton historique.</p>
      </main>
    );
  }

  const entries = await getHistoryEntries(userId, 50);

  return (
    <main className="flex flex-1 flex-col px-6 py-8 max-w-xl mx-auto w-full gap-4">
      <h1 className="font-display text-xl font-bold">Historique des séances</h1>

      {entries.length === 0 ? (
        <p className="text-sm text-muted">Aucune séance enregistrée pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => {
            const [, key] = entry.id.split(":");
            const href = entry.kind === "planned" ? `/history/session/${key}` : `/history/free/${key}`;
            return (
              <li key={entry.id}>
                <Link
                  href={href}
                  className={`p-3 flex items-center justify-between text-sm transition-colors ${
                    entry.fullCompletion ? "panel-rpg panel-rpg-gold" : "panel-rpg hover:border-accent"
                  }`}
                >
                  <div>
                    <p className="font-medium">
                      {entry.label}
                      {entry.fullCompletion ? <span className="text-gold ml-2">✓</span> : null}
                    </p>
                    <p className="text-xs text-muted">
                      {entry.exerciseCount} exercice{entry.exerciseCount > 1 ? "s" : ""} · {formatDate(entry.date)}
                    </p>
                  </div>
                  <span className="text-accent-strong font-medium shrink-0">+{entry.xpEarned} XP</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
