import { getAuthenticatedUserId } from "@/lib/auth";
import { getFreeSessionHistoryDetail } from "@/lib/data";
import { SessionDetailView } from "../../session-detail-view";

export const metadata = { title: "Détail de la séance - Calisthenics RPG" };

function formatDate(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function FreeSessionHistoryPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-muted text-sm">Connecte-toi pour voir cette séance.</p>
      </main>
    );
  }

  const sets = await getFreeSessionHistoryDetail(userId, date);

  return <SessionDetailView title="Séance libre" subtitle={formatDate(date)} sets={sets} />;
}
