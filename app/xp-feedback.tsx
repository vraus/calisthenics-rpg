"use client";

import { useEffect, useState } from "react";

/** Tracks a level-up celebration that auto-dismisses after ~2.5s. */
export function useLevelUp() {
  const [level, setLevel] = useState<number | null>(null);

  useEffect(() => {
    if (level === null) return;
    const timer = setTimeout(() => setLevel(null), 2500);
    return () => clearTimeout(timer);
  }, [level]);

  return { level, trigger: setLevel };
}

export function LevelUpOverlay({ level }: { level: number | null }) {
  if (level === null) return null;
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center pointer-events-none">
      <div className="panel-rpg panel-rpg-gold animate-level-up px-10 py-6 text-center">
        <p className="text-xs uppercase tracking-widest text-gold">Niveau supérieur</p>
        <p className="font-display text-4xl font-bold text-gold">Niveau {level}</p>
      </div>
    </div>
  );
}

/** Tracks a perfect-week celebration that auto-dismisses after ~3.5s. */
export function usePerfectWeek() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setActive(false), 3500);
    return () => clearTimeout(timer);
  }, [active]);

  return { active, trigger: () => setActive(true) };
}

export function PerfectWeekOverlay({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none px-6">
      <div className="panel-rpg panel-rpg-gold animate-celebrate border-2 px-10 py-8 text-center">
        <p className="text-xs uppercase tracking-widest text-gold">Bonus débloqué</p>
        <p className="font-display text-3xl font-bold text-gold">Semaine parfaite !</p>
      </div>
    </div>
  );
}

/** Tracks a phase-advancement celebration ("nouvelle zone débloquée") that auto-dismisses after ~4s. */
export function usePhaseAdvanced() {
  const [phaseName, setPhaseName] = useState<string | null>(null);

  useEffect(() => {
    if (phaseName === null) return;
    const timer = setTimeout(() => setPhaseName(null), 4000);
    return () => clearTimeout(timer);
  }, [phaseName]);

  return { phaseName, trigger: setPhaseName };
}

export function PhaseAdvancedOverlay({ phaseName }: { phaseName: string | null }) {
  if (phaseName === null) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none px-6">
      <div className="panel-rpg panel-rpg-gold animate-celebrate border-2 px-10 py-8 text-center">
        <p className="text-xs uppercase tracking-widest text-gold">Nouvelle zone débloquée</p>
        <p className="font-display text-3xl font-bold text-gold">{phaseName}</p>
      </div>
    </div>
  );
}

export function BadgeChips({ names }: { names?: string[] }) {
  if (!names?.length) return null;
  return (
    <>
      {names.map((name) => (
        <span
          key={name}
          className="panel-rpg panel-rpg-gold inline-flex w-fit items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gold"
        >
          🏆 Nouveau badge : {name}
        </span>
      ))}
    </>
  );
}
