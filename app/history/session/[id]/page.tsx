import { notFound } from "next/navigation";
import { getAuthenticatedUserId } from "@/lib/auth";
import { getPlannedSessionHistoryDetail } from "@/lib/data";
import { SessionDetailView } from "../../session-detail-view";

export const metadata = { title: "Détail de la séance - Calisthenics RPG" };

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function PlannedSessionHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-muted text-sm">Connecte-toi pour voir cette séance.</p>
      </main>
    );
  }

  const detail = await getPlannedSessionHistoryDetail(userId, id);
  if (!detail) notFound();

  return (
    <SessionDetailView
      title={detail.label}
      subtitle={detail.completedAt ? formatDateTime(detail.completedAt) : undefined}
      sets={detail.sets}
    />
  );
}
