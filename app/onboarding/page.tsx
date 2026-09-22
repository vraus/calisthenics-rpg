import { redirect } from "next/navigation";
import { getAuthenticatedUserId } from "@/lib/auth";
import { getPhases, getProfile } from "@/lib/data";
import { OnboardingWizard } from "./onboarding-wizard";

export const metadata = { title: "Placement — Calisthenics RPG" };

export default async function OnboardingPage() {
  const userId = await getAuthenticatedUserId();
  if (!userId) redirect("/login");

  const [profile, phases] = await Promise.all([getProfile(userId), getPhases()]);

  // Déjà placé : pas de deuxième passage (voir completeOnboarding, jamais
  // ré-exécuté après le premier).
  if (profile?.onboardingCompletedAt) redirect("/dashboard");

  return (
    <main className="flex flex-1 flex-col px-6 py-8 max-w-xl mx-auto w-full gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-accent-strong">Bienvenue !</h1>
        <p className="mt-1 text-sm text-muted">
          Quelques questions pour te placer dans la bonne zone de progression.
        </p>
      </div>
      <OnboardingWizard phases={phases} />
    </main>
  );
}
