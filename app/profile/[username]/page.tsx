import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getFamiliesWithExercises,
  getProfileByUsername,
  getRecentSessions,
  getRestDayCompletionDates,
  getUserProgress,
  getXpBonusTotal,
} from "@/lib/data";
import { buildMasteredByFamily, levelFromXp } from "@/lib/xp";
import { computeStreak } from "@/lib/streak";
import ProfileView from "../profile-view";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return { title: `${username} — Calisthenics RPG` };
}

interface Badge {
  slug: string;
  name: string;
  description: string;
  sort_order: number;
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const profile = await getProfileByUsername(username);
  if (!profile) notFound();

  const [familiesWithExercises, progress, sessions, badgesResult, earnedResult, bonusXp, restDayDates] =
    await Promise.all([
      getFamiliesWithExercises(),
      getUserProgress(profile.userId),
      getRecentSessions(profile.userId, 1000),
      supabase.from("badges").select("slug, name, description, sort_order").order("sort_order"),
      supabase.from("user_badges").select("earned_at, badges(slug)").eq("user_id", profile.userId),
      getXpBonusTotal(profile.userId),
      getRestDayCompletionDates(profile.userId),
    ]);

  const badges: Badge[] = badgesResult.data ?? [];
  const earnedAtBySlug = new Map<string, string>(
    (earnedResult.data ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((row: any): [string | undefined, string] => [row.badges?.slug, row.earned_at])
      .filter((entry): entry is [string, string] => Boolean(entry[0]))
  );

  const progressXp = progress.reduce((sum, p) => sum + p.xpInExercise, 0);
  const totalXp = progressXp + bonusXp;
  const global = levelFromXp(totalXp);
  const streak = computeStreak([...sessions.map((s) => s.performed_at), ...restDayDates]);
  const masteredByFamily = buildMasteredByFamily(familiesWithExercises, progress);

  return (
    <main className="flex flex-1 flex-col px-6 py-8 max-w-xl mx-auto w-full gap-6">
      <h1 className="font-display text-2xl font-bold">{profile.username}</h1>

      <ProfileView
        level={global.level}
        totalXp={totalXp}
        sessionCount={sessions.length}
        streak={streak}
        masteredByFamily={masteredByFamily}
        badges={badges.map((b) => ({ ...b, earnedAt: earnedAtBySlug.get(b.slug) }))}
      />
    </main>
  );
}
