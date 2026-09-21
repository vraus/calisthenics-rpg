import Link from "next/link";
import { getAuthenticatedUserId } from "@/lib/auth";
import { getAllProfilesWithLevel } from "@/lib/data";

export const metadata = { title: "Annuaire — Calisthenics RPG" };

export default async function AnnuairePage() {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-muted text-sm">Connecte-toi pour voir l&apos;annuaire.</p>
      </main>
    );
  }

  // "test" is the internal debug account, not a real user — excluded here.
  const profiles = (await getAllProfilesWithLevel()).filter(
    (p) => p.username.toLowerCase() !== "test"
  );

  return (
    <main className="flex flex-1 flex-col px-6 py-8 max-w-xl mx-auto w-full gap-4">
      <h1 className="font-display text-xl font-bold">Annuaire</h1>

      <ul className="flex flex-col gap-2">
        {profiles.map((p) => (
          <li key={p.userId}>
            <Link
              href={`/profile/${p.username}`}
              className="panel-rpg p-3 flex items-center justify-between hover:border-accent transition-colors"
            >
              <span className="font-medium text-sm">
                {p.username}
                {p.userId === userId ? <span className="text-muted"> (toi)</span> : null}
              </span>
              <span className="text-sm text-muted">niveau {p.level}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
