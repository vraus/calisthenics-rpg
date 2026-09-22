"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DAY_LABELS,
  isDayLocked,
  type DayKind,
  type DayOfWeek,
  type Exercise,
  type ExerciseFamily,
  type SessionTemplate,
  type WeeklyPlan,
} from "@/lib/types";
import { saveWeeklyPlanDays } from "../../../actions";

interface Group {
  family: ExerciseFamily;
  exercises: Exercise[];
}

interface ExerciseRow {
  exerciseId: string;
  targetSets: number;
  targetPerformance: number;
  restBetweenSetsSeconds: number;
  restAfterExerciseSeconds: number;
}

/** Only meaningful when kind === "session": start from a template or build from scratch. */
type SessionMode = "template" | "custom";

interface DayDraft {
  dayOfWeek: DayOfWeek;
  locked: boolean;
  lockedLabel?: string;
  kind: DayKind | "unset";
  mode: SessionMode;
  label: string;
  exercises: ExerciseRow[];
  rounds: number;
  restBetweenRoundsSeconds: number;
}

const DAY_ORDER: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];
const DEFAULT_REST_BETWEEN_SETS = 30;
const DEFAULT_REST_AFTER_EXERCISE = 60;
const DEFAULT_ROUNDS = 1;
const DEFAULT_REST_BETWEEN_ROUNDS = 90;

function defaultRow(exercise: Exercise | undefined): ExerciseRow {
  return {
    exerciseId: exercise?.id ?? "",
    targetSets: 3,
    targetPerformance: exercise?.unlockThreshold ?? 1,
    restBetweenSetsSeconds: DEFAULT_REST_BETWEEN_SETS,
    restAfterExerciseSeconds: DEFAULT_REST_AFTER_EXERCISE,
  };
}

function buildInitialDays(plan: WeeklyPlan | null): DayDraft[] {
  const byDay = new Map((plan?.sessions ?? []).map((s) => [s.dayOfWeek, s]));

  return DAY_ORDER.map((dayOfWeek) => {
    const existing = byDay.get(dayOfWeek);
    if (!existing) {
      return {
        dayOfWeek,
        locked: false,
        kind: "rest",
        mode: "custom",
        label: "",
        exercises: [],
        rounds: DEFAULT_ROUNDS,
        restBetweenRoundsSeconds: DEFAULT_REST_BETWEEN_ROUNDS,
      };
    }
    const locked = isDayLocked(existing);
    const rows: ExerciseRow[] = existing.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      targetSets: e.targetSets,
      targetPerformance: e.targetPerformance,
      restBetweenSetsSeconds: e.restBetweenSetsSeconds,
      restAfterExerciseSeconds: e.restAfterExerciseSeconds,
    }));
    return {
      dayOfWeek,
      locked,
      lockedLabel: locked ? (existing.dayKind === "rest" ? "Repos" : existing.label) : undefined,
      kind: existing.dayKind,
      // Which of "template"/"custom" originally built this day isn't
      // persisted — editing an existing session always shows it as its own
      // exercise list, same as "custom".
      mode: "custom",
      label: existing.label,
      exercises: rows,
      rounds: existing.rounds,
      restBetweenRoundsSeconds: existing.restBetweenRoundsSeconds,
    };
  });
}

export default function WeekEditor({
  weekStart,
  plan,
  familiesWithExercises,
  sessionTemplates,
}: {
  weekStart: string;
  plan: WeeklyPlan | null;
  familiesWithExercises: Group[];
  sessionTemplates: SessionTemplate[];
}) {
  const router = useRouter();
  const allExercises = familiesWithExercises.flatMap((g) => g.exercises);
  const exerciseById = new Map(allExercises.map((ex) => [ex.id, ex]));
  const firstExercise = allExercises[0];
  const [days, setDays] = useState<DayDraft[]>(() => buildInitialDays(plan));
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
          // Coming from "rest"/"unset": start fresh, empty — the user picks
          // a template or builds their own list from scratch.
          return {
            ...d,
            kind,
            mode: "custom",
            label: `Séance ${DAY_LABELS[dayOfWeek]}`,
            exercises: [],
            rounds: DEFAULT_ROUNDS,
            restBetweenRoundsSeconds: DEFAULT_REST_BETWEEN_ROUNDS,
          };
        }
        return { ...d, kind };
      })
    );
  }

  function setMode(dayOfWeek: DayOfWeek, mode: SessionMode) {
    updateDay(dayOfWeek, { mode });
  }

  function applyTemplate(dayOfWeek: DayOfWeek, templateId: string) {
    const template = sessionTemplates.find((t) => t.id === templateId);
    if (!template) return;
    // Les circuits à plusieurs parties (p1/p2...) sont aplatis en une seule
    // liste ici : l'éditeur de semaine ne gère qu'une partie implicite pour
    // l'instant (voir plan Jalon 5). On reprend les réglages de la 1ʳᵉ partie.
    const firstPart = template.parts[0];
    updateDay(dayOfWeek, {
      label: `${DAY_LABELS[dayOfWeek]} ${template.name}`,
      exercises: template.exercises.map((e) => ({
        exerciseId: e.exerciseId,
        targetSets: e.targetSets,
        targetPerformance: e.targetPerformance,
        restBetweenSetsSeconds: e.restBetweenSetsSeconds,
        restAfterExerciseSeconds: e.restAfterExerciseSeconds,
      })),
      rounds: firstPart?.rounds ?? DEFAULT_ROUNDS,
      restBetweenRoundsSeconds: firstPart?.restBetweenRoundsSeconds ?? DEFAULT_REST_BETWEEN_ROUNDS,
    });
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

  function handleExerciseChange(dayOfWeek: DayOfWeek, rowIndex: number, exerciseId: string) {
    const exercise = exerciseById.get(exerciseId);
    updateExerciseRow(dayOfWeek, rowIndex, {
      exerciseId,
      targetPerformance: exercise?.unlockThreshold ?? 1,
    });
  }

  function addExerciseRow(dayOfWeek: DayOfWeek) {
    setDays((prev) =>
      prev.map((d) => (d.dayOfWeek !== dayOfWeek ? d : { ...d, exercises: [...d.exercises, defaultRow(firstExercise)] }))
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
      rounds: d.kind === "session" ? d.rounds : undefined,
      restBetweenRoundsSeconds: d.kind === "session" ? d.restBetweenRoundsSeconds : undefined,
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
              <div className="flex flex-wrap gap-1 text-xs">
                {(["template", "custom"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(day.dayOfWeek, m)}
                    className={`rounded-lg px-2 py-1 border ${
                      day.mode === m
                        ? "border-accent text-accent-strong"
                        : "border-border text-muted hover:border-accent"
                    }`}
                  >
                    {m === "template" ? "Template" : "Custom"}
                  </button>
                ))}
              </div>

              {day.mode === "template" ? (
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) applyTemplate(day.dayOfWeek, e.target.value);
                  }}
                  className="min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-foreground text-sm"
                >
                  <option value="">
                    {sessionTemplates.length === 0
                      ? "Aucun template disponible pour l'instant"
                      : "Charger un template..."}
                  </option>
                  {sessionTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              ) : null}
              <input
                value={day.label}
                onChange={(e) => updateDay(day.dayOfWeek, { label: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-foreground font-medium text-sm"
                placeholder="Nom de la séance"
              />
              {day.exercises.map((row, rowIndex) => {
                const exercise = exerciseById.get(row.exerciseId);
                const unit = exercise?.unlockType === "duration" ? "s" : "reps";
                return (
                  <div key={rowIndex} className="rounded-lg border border-border p-2 flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={row.exerciseId}
                        onChange={(e) => handleExerciseChange(day.dayOfWeek, rowIndex, e.target.value)}
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
                      <button
                        type="button"
                        onClick={() => removeExerciseRow(day.dayOfWeek, rowIndex)}
                        className="shrink-0 text-xs text-bordeaux"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        // Empty string while editing (not 0): a controlled
                        // number input showing "0" can't be backspaced down
                        // to nothing on mobile keyboards.
                        value={row.targetSets === 0 ? "" : row.targetSets}
                        onChange={(e) => {
                          const raw = e.target.value;
                          updateExerciseRow(day.dayOfWeek, rowIndex, {
                            targetSets: raw === "" ? 0 : Number(raw),
                          });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.preventDefault();
                        }}
                        className="w-16 shrink-0 rounded-lg border border-border bg-surface px-2 py-2 text-foreground text-sm"
                      />
                      <span className="shrink-0 whitespace-nowrap text-xs text-muted">séries de</span>
                      <input
                        type="number"
                        min={1}
                        value={row.targetPerformance === 0 ? "" : row.targetPerformance}
                        onChange={(e) => {
                          const raw = e.target.value;
                          updateExerciseRow(day.dayOfWeek, rowIndex, {
                            targetPerformance: raw === "" ? 0 : Number(raw),
                          });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.preventDefault();
                        }}
                        className="w-16 shrink-0 rounded-lg border border-border bg-surface px-2 py-2 text-foreground text-sm"
                      />
                      <span className="shrink-0 whitespace-nowrap text-xs text-muted">{unit}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className="shrink-0">Repos entre séries</span>
                      <input
                        type="number"
                        min={0}
                        value={row.restBetweenSetsSeconds === 0 ? "" : row.restBetweenSetsSeconds}
                        onChange={(e) => {
                          const raw = e.target.value;
                          updateExerciseRow(day.dayOfWeek, rowIndex, {
                            restBetweenSetsSeconds: raw === "" ? 0 : Number(raw),
                          });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.preventDefault();
                        }}
                        className="w-14 shrink-0 rounded-lg border border-border bg-surface px-2 py-1 text-foreground text-xs"
                      />
                      <span className="shrink-0">s · avant l&apos;exo suivant</span>
                      <input
                        type="number"
                        min={0}
                        value={row.restAfterExerciseSeconds === 0 ? "" : row.restAfterExerciseSeconds}
                        onChange={(e) => {
                          const raw = e.target.value;
                          updateExerciseRow(day.dayOfWeek, rowIndex, {
                            restAfterExerciseSeconds: raw === "" ? 0 : Number(raw),
                          });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.preventDefault();
                        }}
                        className="w-14 shrink-0 rounded-lg border border-border bg-surface px-2 py-1 text-foreground text-xs"
                      />
                      <span className="shrink-0">s</span>
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => addExerciseRow(day.dayOfWeek)}
                className="text-sm text-accent-strong text-left"
              >
                + Ajouter un exercice
              </button>

              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2 text-xs text-muted">
                <span className="shrink-0">Nombre de tours</span>
                <input
                  type="number"
                  min={1}
                  value={day.rounds === 0 ? "" : day.rounds}
                  onChange={(e) => {
                    const raw = e.target.value;
                    updateDay(day.dayOfWeek, { rounds: raw === "" ? 0 : Number(raw) });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.preventDefault();
                  }}
                  className="w-14 shrink-0 rounded-lg border border-border bg-surface px-2 py-1 text-foreground text-xs"
                />
                {day.rounds > 1 ? (
                  <>
                    <span className="shrink-0">· pause entre tours</span>
                    <input
                      type="number"
                      min={0}
                      value={day.restBetweenRoundsSeconds === 0 ? "" : day.restBetweenRoundsSeconds}
                      onChange={(e) => {
                        const raw = e.target.value;
                        updateDay(day.dayOfWeek, {
                          restBetweenRoundsSeconds: raw === "" ? 0 : Number(raw),
                        });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.preventDefault();
                      }}
                      className="w-14 shrink-0 rounded-lg border border-border bg-surface px-2 py-1 text-foreground text-xs"
                    />
                    <span className="shrink-0">s</span>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ))}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-accent px-4 py-3 font-medium text-white transition-all duration-150 active:scale-95 hover:bg-accent-strong disabled:opacity-50"
      >
        {isPending ? "Enregistrement..." : "Enregistrer ma semaine"}
      </button>

      {error ? <p className="text-sm text-bordeaux">{error}</p> : null}
    </form>
  );
}
