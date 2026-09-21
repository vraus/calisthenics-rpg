"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DAY_LABELS, isDayLocked, type DayOfWeek, type Exercise, type ExerciseFamily, type WeeklyPlan } from "@/lib/types";
import { saveWeeklyPlanDays } from "../../../actions";

interface Group {
  family: ExerciseFamily;
  exercises: Exercise[];
}

interface ExerciseRow {
  exerciseId: string;
  targetSets: number;
}

interface DayDraft {
  dayOfWeek: DayOfWeek;
  locked: boolean;
  lockedLabel?: string;
  kind: "unset" | "rest" | "session";
  label: string;
  exercises: ExerciseRow[];
}

const DAY_ORDER: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

function buildInitialDays(plan: WeeklyPlan | null, firstExerciseId: string): DayDraft[] {
  const byDay = new Map((plan?.sessions ?? []).map((s) => [s.dayOfWeek, s]));

  return DAY_ORDER.map((dayOfWeek) => {
    const existing = byDay.get(dayOfWeek);
    if (!existing) {
      return { dayOfWeek, locked: false, kind: "rest", label: "", exercises: [] };
    }
    const locked = isDayLocked(existing);
    if (locked) {
      return {
        dayOfWeek,
        locked: true,
        lockedLabel: existing.isRestDay ? "Repos" : existing.label,
        kind: existing.isRestDay ? "rest" : "session",
        label: existing.label,
        exercises: existing.exercises.map((e) => ({ exerciseId: e.exerciseId, targetSets: e.targetSets })),
      };
    }
    return {
      dayOfWeek,
      locked: false,
      kind: existing.isRestDay ? "rest" : "session",
      label: existing.label,
      exercises: existing.exercises.length
        ? existing.exercises.map((e) => ({ exerciseId: e.exerciseId, targetSets: e.targetSets }))
        : [{ exerciseId: firstExerciseId, targetSets: 3 }],
    };
  });
}

export default function WeekEditor({
  weekStart,
  plan,
  familiesWithExercises,
}: {
  weekStart: string;
  plan: WeeklyPlan | null;
  familiesWithExercises: Group[];
}) {
  const router = useRouter();
  const firstExerciseId = familiesWithExercises.flatMap((g) => g.exercises)[0]?.id ?? "";
  const [days, setDays] = useState<DayDraft[]>(() => buildInitialDays(plan, firstExerciseId));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function updateDay(dayOfWeek: DayOfWeek, update: Partial<DayDraft>) {
    setDays((prev) => prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...update } : d)));
  }

  function setKind(dayOfWeek: DayOfWeek, kind: DayDraft["kind"]) {
    setDays((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek !== dayOfWeek) return d;
        if (kind === "session" && d.kind !== "session") {
          // Coming from "rest"/"unset": the previous label ("Repos" or
          // empty) isn't a valid session name, so start fresh instead of
          // carrying it over.
          return {
            ...d,
            kind,
            label: `Séance ${DAY_LABELS[dayOfWeek]}`,
            exercises: d.exercises.length ? d.exercises : [{ exerciseId: firstExerciseId, targetSets: 3 }],
          };
        }
        return { ...d, kind };
      })
    );
  }

  function updateExerciseRow(dayOfWeek: DayOfWeek, rowIndex: number, update: Partial<ExerciseRow>) {
    setDays((prev) =>
      prev.map((d) =>
        d.dayOfWeek !== dayOfWeek
          ? d
          : { ...d, exercises: d.exercises.map((e, i) => (i === rowIndex ? { ...e, ...update } : e)) }
      )
    );
  }

  function addExerciseRow(dayOfWeek: DayOfWeek) {
    setDays((prev) =>
      prev.map((d) =>
        d.dayOfWeek !== dayOfWeek
          ? d
          : { ...d, exercises: [...d.exercises, { exerciseId: firstExerciseId, targetSets: 3 }] }
      )
    );
  }

  function removeExerciseRow(dayOfWeek: DayOfWeek, rowIndex: number) {
    setDays((prev) =>
      prev.map((d) =>
        d.dayOfWeek !== dayOfWeek ? d : { ...d, exercises: d.exercises.filter((_, i) => i !== rowIndex) }
      )
    );
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const payload = days.map((d) => ({
      dayOfWeek: d.dayOfWeek,
      kind: d.kind,
      label: d.kind === "session" ? d.label : undefined,
      exercises: d.kind === "session" ? d.exercises : undefined,
    }));

    const formData = new FormData();
    formData.set("days", JSON.stringify(payload));

    startTransition(async () => {
      const result = await saveWeeklyPlanDays(weekStart, formData);
      if (!result.ok) {
        setError(result.error ?? "Erreur.");
        return;
      }
      router.push("/plan");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {days.map((day) => (
        <div key={day.dayOfWeek} className="panel-rpg p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{DAY_LABELS[day.dayOfWeek]}</p>
            {day.locked ? (
              <span className="text-xs text-gold">Verrouillé ({day.lockedLabel})</span>
            ) : (
              <div className="flex flex-wrap gap-1 text-xs">
                {(["unset", "rest", "session"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(day.dayOfWeek, k)}
                    className={`rounded-lg px-2 py-1 border ${
                      day.kind === k
                        ? "border-gold text-gold"
                        : "border-border text-muted hover:border-accent"
                    }`}
                  >
                    {k === "unset" ? "Vide" : k === "rest" ? "Repos" : "Séance"}
                  </button>
                ))}
              </div>
            )}
          </div>

          {!day.locked && day.kind === "session" ? (
            <div className="flex flex-col gap-2">
              <input
                value={day.label}
                onChange={(e) => updateDay(day.dayOfWeek, { label: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-foreground font-medium text-sm"
                placeholder="Nom de la séance"
              />
              {day.exercises.map((row, rowIndex) => (
                <div key={rowIndex} className="flex flex-wrap items-center gap-2">
                  <select
                    value={row.exerciseId}
                    onChange={(e) =>
                      updateExerciseRow(day.dayOfWeek, rowIndex, { exerciseId: e.target.value })
                    }
                    className="min-w-0 flex-1 basis-40 rounded-lg border border-border bg-surface px-3 py-2 text-foreground text-sm"
                  >
                    {familiesWithExercises.map(({ family, exercises }) => (
                      <optgroup key={family.id} label={family.name}>
                        {exercises.map((ex) => (
                          <option key={ex.id} value={ex.id}>
                            {ex.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    // Empty string while editing (not 0): a controlled
                    // number input showing "0" can't be backspaced down to
                    // nothing on mobile keyboards, since a blank field
                    // instantly re-renders as "0" again.
                    value={row.targetSets === 0 ? "" : row.targetSets}
                    onChange={(e) => {
                      const raw = e.target.value;
                      updateExerciseRow(day.dayOfWeek, rowIndex, {
                        targetSets: raw === "" ? 0 : Number(raw),
                      });
                    }}
                    onKeyDown={(e) => {
                      // Mobile numeric keyboards' "Go"/"Next" key otherwise
                      // submits the whole week form from inside one row.
                      if (e.key === "Enter") e.preventDefault();
                    }}
                    className="w-16 shrink-0 rounded-lg border border-border bg-surface px-2 py-2 text-foreground text-sm"
                  />
                  <span className="shrink-0 whitespace-nowrap text-xs text-muted">séries</span>
                  {day.exercises.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeExerciseRow(day.dayOfWeek, rowIndex)}
                      className="shrink-0 text-xs text-bordeaux"
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
              ))}
              <button
                type="button"
                onClick={() => addExerciseRow(day.dayOfWeek)}
                className="text-sm text-accent-strong text-left"
              >
                + Ajouter un exercice
              </button>
            </div>
          ) : null}
        </div>
      ))}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-accent px-4 py-3 font-medium text-white transition-colors hover:bg-accent-strong disabled:opacity-50"
      >
        {isPending ? "Enregistrement..." : "Enregistrer ma semaine"}
      </button>

      {error ? <p className="text-sm text-bordeaux">{error}</p> : null}
    </form>
  );
}
