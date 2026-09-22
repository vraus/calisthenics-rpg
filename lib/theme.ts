import { cache } from "react";
import { getAuthenticatedUserId } from "@/lib/auth";
import { getPhases, getProfile } from "@/lib/data";

/**
 * The zone number (a phase's sortOrder - 1, 2, 3...) whose theme should be
 * displayed, used to set [data-zone="n"] (see app/globals.css). Prefers the
 * player's manually-chosen theme (profiles.theme_zone_id, set from the
 * profile page - see app/profile/theme-zone-form.tsx) over their actual
 * progression phase (profiles.current_phase_id). `null` when logged out or
 * not yet placed by onboarding: the default (zone 1) theme applies.
 *
 * Wrapped in React's `cache()` because this runs in the root layout on
 * every request - without it, any page that also reads the profile (e.g.
 * dashboard's onboarding gate) would trigger a second, redundant query
 * within the same render, which is exactly the kind of round-trip this
 * project has deliberately eliminated elsewhere (see lib/auth.ts).
 */
export const getCurrentZone = cache(async (): Promise<number | null> => {
  const userId = await getAuthenticatedUserId();
  if (!userId) return null;

  const [profile, phases] = await Promise.all([getProfile(userId), getPhases()]);
  const zonePhaseId = profile?.themeZoneId ?? profile?.currentPhaseId;
  if (!zonePhaseId) return null;

  return phases.find((p) => p.id === zonePhaseId)?.sortOrder ?? null;
});
