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
  type Phase,
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
  /** Matches a PartDraft.key - undefined = the day's implicit base part (rounds/restBetweenRoundsSeconds below). */
  partKey?: string;
}

/** A part added from a multi-part circuit (e.g. "Push A" p1/p2) - its own round count/pause, distinct from the day's base part. */
interface PartDraft {
  key: string;
  /** Shared by every part added from the same "+ Ajouter un circuit" pick - lets the whole circuit be removed in one go. */
  groupKey: string;
  /** Circuit name, for the "retirer ce circuit" label. */
  groupName: string;
  rounds: number;
  restBetweenRoundsSeconds: number;
  /** Circuit d'origine (session_templates.id) - undefined si non issue d'un circuit préfait. */
  templateId?: string;
}

interface DayDraft {
  dayOfWeek: DayOfWeek;
  locked: boolean;
  lockedLabel?: string;
  kind: DayKind | "unset";
  label: string;
  exercises: ExerciseRow[];
  parts: PartDraft[];
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
        label: "",
        exercises: [],
        parts: [],
        rounds: DEFAULT_ROUNDS,
        restBetweenRoundsSeconds: DEFAULT_REST_BETWEEN_ROUNDS,
      };
    }
    const locked = isDayLocked(existing);
    // Une partie explicite existante (posée par un circuit ajouté avant
    // édition) redevient une clé stable "existing-<partId>" pour que les
    // lignes d'exercices qui la référencent (via leur part_id résolu côté
    // données) la retrouvent ci-dessous. Le regroupement "ce sont les 2
    // parties du même circuit" ne survit pas à un enregistrement (pas
    // persisté) : chaque partie redevient son propre groupe après rechargement.
    const parts: PartDraft[] = existing.parts.map((p) => ({
      key: `existing-${p.id}`,
      groupKey: `existing-${p.id}`,
      groupName: p.label ?? "Circuit",
      rounds: p.rounds,
      restBetweenRoundsSeconds: p.restBetweenRoundsSeconds,
      templateId: p.sessionTemplateId,
    }));
    const partKeyByIndex = new Map(existing.parts.map((p, i) => [p.partIndex, parts[i].key]));
    const rows: ExerciseRow[] = existing.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      targetSets: e.targetSets,
      targetPerformance: e.targetPerformance,
      restBetweenSetsSeconds: e.restBetweenSetsSeconds,
      restAfterExerciseSeconds: e.restAfterExerciseSeconds,
      partKey: e.partIndex !== undefined ? partKeyByIndex.get(e.partIndex) : undefined,
    }));
    return {
      dayOfWeek,
      locked,
      lockedLabel: locked ? (existing.dayKind === "rest" ? "Repos" : existing.label) : undefined,
      kind: existing.dayKind,
      label: existing.label,
      exercises: rows,
      parts,
      rounds: existing.rounds,
      restBetweenRoundsSeconds: existing.restBetweenRoundsSeconds,
    };
  });
}

export default function WeekEditor({
  weekStart,
  plan,
  familiesWithExercises,
  circuitOnlyExercises,
  sessionTemplates,
  phases,
  currentPhaseId,
}: {
  weekStart: string;
  plan: WeeklyPlan | null;
  familiesWithExercises: Group[];
  circuitOnlyExercises: Exercise[];
  sessionTemplates: SessionTemplate[];
  phases: Phase[];
  currentPhaseId?: string;
}) {
  const router = useRouter();
  // Toutes les compétences/circuits restent utilisables (les select en
  // dessous s'appuient sur exerciseById/sessionTemplates non filtrés pour
  // résoudre ce qui est déjà planifié) - seul ce qui est PROPOSÉ dans les
  // sélecteurs se filtre par zone, par défaut celle du joueur.
  const skillExercises = familiesWithExercises.flatMap((g) => g.exercises);
  const allExercises = [...skillExercises, ...circuitOnlyExercises];
  const exerciseById = new Map(allExercises.map((ex) => [ex.id, ex]));
  const firstExercise = skillExercises[0];

  /**
   * Un exercice de circuit (ex. "Burpee") et ses variantes (ex. "Burpee sans
   * pompes") - le mouvement de base d'abord, puis ses variantes. Utilisé
   * pour la ligne d'un exercice ajouté depuis un circuit : on ne propose que
   * ce mouvement-là et ses variantes, pas tout le catalogue (voir
   * variantGroupFor plus bas pour la distinction avec le select "compétence
   * technique").
   */
  function variantGroupFor(exerciseId: string): Exercise[] {
    const ex = exerciseById.get(exerciseId);
    if (!ex) return [];
    const baseId = ex.variantOfId ?? ex.id;
    const base = exerciseById.get(baseId);
    const variants = allExercises.filter((e) => e.variantOfId === baseId);
    return base ? [base, ...variants] : variants;
  }
  const sortedPhases = [...phases].sort((a, b) => a.sortOrder - b.sortOrder);
  const [phaseFilter, setPhaseFilter] = useState<string | "all">(currentPhaseId ?? "all");
  const visibleTemplates =
    phaseFilter === "all" ? sessionTemplates : sessionTemplates.filter((t) => t.phaseId === phaseFilter);
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
          // Coming from "rest"/"unset": start fresh, empty - the user builds
          // it up from scratch with "+ Ajouter un exercice"/"+ Ajouter un
          // circuit".
          return {
            ...d,
            kind,
            label: `Séance ${DAY_LABELS[dayOfWeek]}`,
            exercises: [],
            parts: [],
            rounds: DEFAULT_ROUNDS,
            restBetweenRoundsSeconds: DEFAULT_REST_BETWEEN_ROUNDS,
          };
        }
        return { ...d, kind };
      })
    );
  }

  /**
   * Ajoute tous les exercices d'un circuit à la liste existante du jour
   * (additif, ne remplace rien) - ses parties (p1/p2...) deviennent des
   * PartDraft avec leurs propres tours/pause, distinctes de la partie de
   * base du jour et des autres circuits déjà ajoutés.
   */
  function addCircuit(dayOfWeek: DayOfWeek, templateId: string) {
    const template = sessionTemplates.find((t) => t.id === templateId);
    if (!template) return;

    const uid = `${template.slug}-${Date.now()}`;
    const newParts: PartDraft[] = template.parts.map((p) => ({
      key: `${uid}-p${p.partIndex}`,
      groupKey: uid,
      groupName: template.name,
      templateId: template.id,
      rounds: p.rounds,
      restBetweenRoundsSeconds: p.restBetweenRoundsSeconds,
    }));
    const partKeyByIndex = new Map(template.parts.map((p, i) => [p.partIndex, newParts[i].key]));
    const newRows: ExerciseRow[] = template.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      targetSets: e.targetSets,
      targetPerformance: e.targetPerformance,
      restBetweenSetsSeconds: e.restBetweenSetsSeconds,
      restAfterExerciseSeconds: e.restAfterExerciseSeconds,
      partKey: partKeyByIndex.get(e.partIndex),
    }));

    setDays((prev) =>
      prev.map((d) =>
        d.dayOfWeek !== dayOfWeek
          ? d
          : {
              ...d,
              label: d.label || `${DAY_LABELS[dayOfWeek]} ${template.name}`,
              exercises: [...d.exercises, ...newRows],
              parts: [...d.parts, ...newParts],
            }
      )
    );
  }

  function updatePart(dayOfWeek: DayOfWeek, partKey: string, update: Partial<PartDraft>) {
    setDays((prev) =>
      prev.map((d) =>
        d.dayOfWeek !== dayOfWeek
          ? d
          : { ...d, parts: d.parts.map((p) => (p.key === partKey ? { ...p, ...update } : p)) }
      )
    );
  }

  /** Retire une seule partie (et ses exercices) - pour un circuit à plusieurs parties, les autres restent. */
  function removePart(dayOfWeek: DayOfWeek, partKey: string) {
    setDays((prev) =>
      prev.map((d) =>
        d.dayOfWeek !== dayOfWeek
          ? d
          : {
              ...d,
              exercises: d.exercises.filter((e) => e.partKey !== partKey),
              parts: d.parts.filter((p) => p.key !== partKey),
            }
      )
    );
  }

  /** Retire toutes les parties d'un même circuit ajouté (et tous leurs exercices) en une fois. */
  function removeCircuitGroup(dayOfWeek: DayOfWeek, groupKey: string) {
    setDays((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek !== dayOfWeek) return d;
        const partKeysToRemove = new Set(d.parts.filter((p) => p.groupKey === groupKey).map((p) => p.key));
        return {
          ...d,
          exercises: d.exercises.filter((e) => !e.partKey || !partKeysToRemove.has(e.partKey)),
          parts: d.parts.filter((p) => p.groupKey !== groupKey),
        };
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

  function handleExerciseChange(dayOfWeek: DayOfWeek, rowIndex: number, exerciseId: string) {
    const exercise = exerciseById.get(exerciseId);
    setDays((prev) =>
      prev.map((d) =>
        d.dayOfWeek !== dayOfWeek
          ? d
          : {
              ...d,
              exercises: d.exercises.map((e, i) =>
                i !== rowIndex
                  ? e
                  : {
                      ...e,
                      exerciseId,
                      // Un mouvement de circuit n'a pas de seuil de maîtrise
                      // propre (ce n'est pas une compétence technique) :
                      // basculer vers une variante ne doit pas écraser
                      // l'objectif déjà réglé par le circuit (ex. burpee
                      // x10) - seul un vrai changement de compétence
                      // technique en propose un nouveau.
                      targetPerformance: exercise?.unlockThreshold ?? e.targetPerformance,
                    }
              ),
            }
      )
    );
  }

  function addExerciseRow(dayOfWeek: DayOfWeek) {
    setDays((prev) =>
      prev.map((d) => (d.dayOfWeek !== dayOfWeek ? d : { ...d, exercises: [...d.exercises, defaultRow(firstExercise)] }))
    );
  }

  function removeExerciseRow(dayOfWeek: DayOfWeek, rowIndex: number) {
    setDays((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek !== dayOfWeek) return d;
        const removed = d.exercises[rowIndex];
        const exercises = d.exercises.filter((_, i) => i !== rowIndex);
        // Une partie dont c'était le dernier exercice n'a plus de raison
        // d'exister - évite d'accumuler des parties vides au fil des ajouts/
        // suppressions de circuits.
        const stillUsed = new Set(exercises.map((e) => e.partKey).filter(Boolean));
        const parts = removed?.partKey ? d.parts.filter((p) => stillUsed.has(p.key)) : d.parts;
        return { ...d, exercises, parts };
      })
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
      parts: d.kind === "session" ? d.parts : undefined,
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
      {sortedPhases.length > 0 ? (
        <div className="panel-rpg p-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted shrink-0">Compétences/circuits proposés</span>
          {sortedPhases.map((phase) => (
            <button
              key={phase.id}
              type="button"
              onClick={() => setPhaseFilter(phase.id)}
              className={`rounded-lg px-2 py-1 border ${
                phaseFilter === phase.id
                  ? "border-accent text-accent-strong"
                  : "border-border text-muted hover:border-accent"
              }`}
            >
              Zone {phase.sortOrder}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPhaseFilter("all")}
            className={`rounded-lg px-2 py-1 border ${
              phaseFilter === "all"
                ? "border-accent text-accent-strong"
                : "border-border text-muted hover:border-accent"
            }`}
          >
            Toutes
          </button>
        </div>
      ) : null}
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
              {day.exercises.map((row, rowIndex, allRows) => {
                const exercise = exerciseById.get(row.exerciseId);
                const unit = exercise?.unlockType === "duration" ? "s" : "reps";
                const part = row.partKey ? day.parts.find((p) => p.key === row.partKey) : undefined;
                const showPartHeader = part && allRows[rowIndex - 1]?.partKey !== row.partKey;
                // Une ligne ajoutée depuis un circuit ne propose que ce
                // mouvement et ses variantes (pas tout le catalogue) - une
                // ligne ajoutée via "+ Ajouter un exercice" garde le
                // sélecteur complet par compétence technique.
                const variantOptions = row.partKey ? variantGroupFor(row.exerciseId) : [];
                // Parties du même circuit ajouté, dans l'ordre où on les
                // enchaîne réellement (une partie entière avant la suivante).
                const groupParts = part ? day.parts.filter((p) => p.groupKey === part.groupKey) : [];
                const partIndexInGroup = part ? groupParts.findIndex((p) => p.key === part.key) : -1;
                const isSingleParCircuit = groupParts.length <= 1;

                return (
                  <div key={rowIndex} className="flex flex-col gap-2">
                    {showPartHeader && part ? (
                      <div className="flex flex-col gap-1 border-t border-border pt-2 first:border-t-0 first:pt-0">
                        {!isSingleParCircuit && partIndexInGroup === 0 ? (
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-medium text-foreground">{part.groupName}</span>
                            <button
                              type="button"
                              onClick={() => removeCircuitGroup(day.dayOfWeek, part.groupKey)}
                              className="shrink-0 text-bordeaux"
                            >
                              ✕ Retirer tout le circuit
                            </button>
                          </div>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-accent-strong">
                          <span className="font-medium">
                            {isSingleParCircuit ? part.groupName : `Partie ${partIndexInGroup + 1}`}
                          </span>
                          <span className="text-muted">· tours</span>
                          <input
                            type="number"
                            min={1}
                            value={part.rounds === 0 ? "" : part.rounds}
                            onChange={(e) => {
                              const raw = e.target.value;
                              updatePart(day.dayOfWeek, part.key, { rounds: raw === "" ? 0 : Number(raw) });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.preventDefault();
                            }}
                            className="w-12 shrink-0 rounded-lg border border-border bg-surface px-2 py-1 text-foreground text-xs"
                          />
                          <span className="text-muted">· pause entre tours</span>
                          <input
                            type="number"
                            min={0}
                            value={part.restBetweenRoundsSeconds === 0 ? "" : part.restBetweenRoundsSeconds}
                            onChange={(e) => {
                              const raw = e.target.value;
                              updatePart(day.dayOfWeek, part.key, {
                                restBetweenRoundsSeconds: raw === "" ? 0 : Number(raw),
                              });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.preventDefault();
                            }}
                            className="w-14 shrink-0 rounded-lg border border-border bg-surface px-2 py-1 text-foreground text-xs"
                          />
                          <span className="text-muted">s</span>
                          <button
                            type="button"
                            onClick={() =>
                              isSingleParCircuit
                                ? removeCircuitGroup(day.dayOfWeek, part.groupKey)
                                : removePart(day.dayOfWeek, part.key)
                            }
                            className="ml-auto shrink-0 text-bordeaux"
                          >
                            {isSingleParCircuit ? "✕ Retirer ce circuit" : "✕ Supprimer cette partie"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  <div className="rounded-lg border border-border p-2 flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {row.partKey ? (
                        // Exercice de circuit : seul son mouvement de base et
                        // ses variantes sont proposés (pas tout le catalogue).
                        <select
                          value={row.exerciseId}
                          onChange={(e) => handleExerciseChange(day.dayOfWeek, rowIndex, e.target.value)}
                          className="min-w-0 flex-1 basis-40 rounded-lg border border-border bg-surface px-3 py-2 text-foreground text-sm"
                        >
                          {variantOptions.map((ex) => (
                            <option key={ex.id} value={ex.id}>
                              {ex.name}
                              {ex.variantOfId ? " (variante)" : ""}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <select
                          value={row.exerciseId}
                          onChange={(e) => handleExerciseChange(day.dayOfWeek, rowIndex, e.target.value)}
                          className="min-w-0 flex-1 basis-40 rounded-lg border border-border bg-surface px-3 py-2 text-foreground text-sm"
                        >
                          {(
                            // La famille de l'exercice déjà choisi sur cette
                            // ligne reste visible même filtrée par une autre
                            // zone - sinon le select retombe visuellement sur
                            // la 1ʳᵉ option sans que la ligne change vraiment.
                            phaseFilter === "all"
                              ? familiesWithExercises
                              : familiesWithExercises.filter(
                                  (g) =>
                                    g.family.phaseId === phaseFilter ||
                                    g.exercises.some((ex) => ex.id === row.exerciseId)
                                )
                          ).map(({ family, exercises }) => (
                            <optgroup key={family.id} label={family.name}>
                              {exercises.map((ex) => (
                                <option key={ex.id} value={ex.id}>
                                  {ex.name}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                          {circuitOnlyExercises.length > 0 ? (
                            <optgroup label="Mouvements de circuit">
                              {circuitOnlyExercises.map((ex) => (
                                <option key={ex.id} value={ex.id}>
                                  {ex.name}
                                </option>
                              ))}
                            </optgroup>
                          ) : null}
                        </select>
                      )}
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
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => addExerciseRow(day.dayOfWeek)}
                  className="text-sm text-accent-strong text-left"
                >
                  + Ajouter un exercice
                </button>
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) addCircuit(day.dayOfWeek, e.target.value);
                    e.target.value = "";
                  }}
                  className="min-w-0 flex-1 basis-40 rounded-lg border border-border bg-surface px-2 py-1 text-accent-strong text-sm"
                >
                  <option value="">
                    {visibleTemplates.length === 0 ? "Aucun circuit dans cette zone" : "+ Ajouter un circuit..."}
                  </option>
                  {visibleTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

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
