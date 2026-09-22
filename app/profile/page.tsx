import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUserEmail, getAuthenticatedUserId } from "@/lib/auth";
import {
  ensureProfile,
  getFamiliesWithExercises,
  getPhases,
  getProfile,
  getRecentSessions,
  getRestDayCompletionDates,
  getUserProgress,
  getXpBonusTotal,
} from "@/lib/data";
import { buildMasteredByFamily, levelFromXp } from "@/lib/xp";
import { computeStreak } from "@/lib/streak";
import ProfileView from "./profile-view";
import UsernameForm from "./username-form";
import { ThemeZoneForm } from "./theme-zone-form";

export const metadata = { title: "Profil — Calisthenics RPG" };

interface SessionRow {
  id: string;
  performed_at: string;
  sets: number;
  reps_per_set: number | null;
  duration_seconds: number | null;
  exercises?: { name?: string; slug?: string } | null;
}

interface Badge {
  slug: string;
  name: string;
  description: string;
  sort_order: number;
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const userId = await getAuthenticatedUserId();
  const userEmail = await getAuthenticatedUserEmail();

  if (!userId) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-muted text-sm">Connecte-toi pour voir ton profil.</p>
      </main>
    );
  }

  await ensureProfile(supabase, userId, userEmail);

  const [profile, phases, familiesWithExercises, progress, sessions, badgesResult, earnedResult, bonusXp, restDayDates] =
    await Promise.all([
      getProfile(userId),
      getPhases(),
      getFamiliesWithExercises(),
      getUserProgress(userId),
      getRecentSessions(userId, 1000) as Promise<SessionRow[]>,
      supabase.from("badges").select("slug, name, description, sort_order").order("sort_order"),
      supabase.from("user_badges").select("earned_at, badges(slug)").eq("user_id", userId),
      getXpBonusTotal(userId),
      getRestDayCompletionDates(userId),
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

  const bestByExercise = new Map<string, { value: number; unit: "reps" | "s" }>();
  for (const s of sessions) {
    const name = s.exercises?.name;
    if (!name) continue;
    const isReps = s.reps_per_set != null;
    const value = isReps ? s.reps_per_set! : s.duration_seconds!;
    const current = bestByExercise.get(name);
    if (!current || value > current.value) {
      bestByExercise.set(name, { value, unit: isReps ? "reps" : "s" });
    }
  }

  return (
    <main className="flex flex-1 flex-col px-6 py-8 max-w-xl mx-auto w-full gap-6">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm text-muted mb-1">Mon profil</p>
          <UsernameForm username={profile?.username ?? "aventurier"} />
        </div>
        <ThemeZoneForm
          phases={phases}
          activePhaseId={profile?.themeZoneId ?? profile?.currentPhaseId}
          unlockedSortOrder={phases.find((p) => p.id === profile?.currentPhaseId)?.sortOrder ?? 1}
        />
      </div>

      <ProfileView
        level={global.level}
        totalXp={totalXp}
        sessionCount={sessions.length}
        streak={streak}
        masteredByFamily={masteredByFamily}
        badges={badges.map((b) => ({ ...b, earnedAt: earnedAtBySlug.get(b.slug) }))}
        records={[...bestByExercise.entries()].map(([name, r]) => ({ name, ...r }))}
      />

      <Link href="/profile/annuaire" className="text-sm text-accent-strong text-center">
        Voir les autres profils →
      </Link>
    </main>
  );
}
