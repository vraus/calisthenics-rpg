import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPlannedSessionDetail } from "@/lib/data";
import SessionRunner from "./session-runner";

export const metadata = { title: "Séance — Calisthenics RPG" };

export default async function PlannedSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const session = await getPlannedSessionDetail(user.id, sessionId);
  if (!session) notFound();

  return (
    <main className="flex flex-1 flex-col px-6 py-8 max-w-xl mx-auto w-full gap-4">
      <h1 className="font-display text-xl font-bold">{session.label}</h1>
      <SessionRunner session={session} />
    </main>
  );
}
