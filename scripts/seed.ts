/**
 * Charge seed/phases.json (phases), seed/trees.json (exercise_families +
 * exercises), seed/badges.json (badges), seed/circuit-exercises.json
 * (mouvements de circuit sans progression technique + leurs variantes) et
 * seed/circuits.json (circuits préfaits, avec leurs parties) dans Supabase.
 * Idempotent : upsert sur le slug, exécutable plusieurs fois sans dupliquer.
 *
 * Usage : npm run seed
 * Requiert dans l'environnement : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * (la clé service role, pas la clé anon — ce script contourne RLS pour
 * écrire dans les tables de référence).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ce script tourne en dehors de Next.js (via tsx), qui ne charge donc pas
// .env.local automatiquement contrairement à `next dev`/`next build`.
config({ path: path.join(__dirname, "..", ".env.local") });

interface SeedPhase {
  slug: string;
  name: string;
  sortOrder: number;
  prerequisitesText: string | null;
}

interface SeedExercise {
  slug: string;
  name: string;
  tier: number;
  unlockType: "reps" | "duration";
  unlockThreshold: number;
  xpCoefficient: number;
}

interface SeedFamily {
  slug: string;
  name: string;
  statTag: string;
  sortOrder: number;
  phaseSlug: string;
  exercises: SeedExercise[];
}

interface SeedBadge {
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
}

interface SeedCircuitExercise {
  slug: string;
  name: string;
  variantOfSlug?: string;
}

interface SeedCircuitPartExercise {
  exerciseSlug: string;
  targetSets: number;
  targetPerformance: number;
  restBetweenSetsSeconds: number;
  restAfterExerciseSeconds: number;
  sortOrder: number;
}

interface SeedCircuitPart {
  partIndex: number;
  label?: string;
  rounds: number;
  restBetweenRoundsSeconds: number;
  exercises: SeedCircuitPartExercise[];
}

interface SeedCircuit {
  slug: string;
  name: string;
  sortOrder: number;
  phaseSlug: string;
  parts: SeedCircuitPart[];
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error(
      "Variables manquantes : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies."
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey);

  // 1. Phases.
  const phasesRaw = readFileSync(path.join(__dirname, "..", "seed", "phases.json"), "utf-8");
  const phasesData = JSON.parse(phasesRaw) as { phases: SeedPhase[] };

  const { error: phasesError } = await supabase.from("phases").upsert(
    phasesData.phases.map((p) => ({
      slug: p.slug,
      name: p.name,
      sort_order: p.sortOrder,
      prerequisites_text: p.prerequisitesText,
    })),
    { onConflict: "slug" }
  );
  if (phasesError) throw new Error(`Échec upsert phases: ${phasesError.message}`);

  const { data: allPhases, error: allPhasesError } = await supabase.from("phases").select("id, slug");
  if (allPhasesError || !allPhases) throw new Error(`Échec lecture des phases: ${allPhasesError?.message}`);
  const phaseIdBySlug = new Map(allPhases.map((p) => [p.slug, p.id]));

  console.log(`✓ Phases (${phasesData.phases.length})`);

  // 2. Familles (compétences techniques) + exercices (niveaux).
  const treesRaw = readFileSync(path.join(__dirname, "..", "seed", "trees.json"), "utf-8");
  const treesData = JSON.parse(treesRaw) as { families: SeedFamily[] };

  for (const family of treesData.families) {
    const phaseId = phaseIdBySlug.get(family.phaseSlug);
    if (!phaseId) throw new Error(`Phase inconnue "${family.phaseSlug}" pour la famille "${family.slug}"`);

    const { data: familyRow, error: familyError } = await supabase
      .from("exercise_families")
      .upsert(
        {
          slug: family.slug,
          name: family.name,
          stat_tag: family.statTag,
          sort_order: family.sortOrder,
          phase_id: phaseId,
        },
        { onConflict: "slug" }
      )
      .select("id")
      .single();

    if (familyError || !familyRow) {
      throw new Error(`Échec upsert famille "${family.slug}": ${familyError?.message}`);
    }

    // Détache (sans supprimer) les exercices qui appartenaient à cette
    // famille dans un seed précédent mais dont le slug n'existe plus dans le
    // contenu actuel (ex. ancien contenu placeholder) : évite un conflit sur
    // exercises_family_id_tier_idx quand le nouveau contenu réoccupe les
    // mêmes tiers, sans casser sessions/user_progress qui référencent encore
    // ces lignes (on delete cascade sur exercise_id).
    const currentSlugs = family.exercises.map((ex) => ex.slug);
    const { error: orphanError } = await supabase
      .from("exercises")
      .update({ family_id: null, tier: null, unlock_type: null, unlock_threshold: null, xp_coefficient: null })
      .eq("family_id", familyRow.id)
      .not("slug", "in", `(${currentSlugs.map((s) => `"${s}"`).join(",")})`);
    if (orphanError) {
      throw new Error(`Échec détachement des anciens exercices de "${family.slug}": ${orphanError.message}`);
    }

    const exerciseRows = family.exercises.map((ex) => ({
      family_id: familyRow.id,
      slug: ex.slug,
      name: ex.name,
      tier: ex.tier,
      unlock_type: ex.unlockType,
      unlock_threshold: ex.unlockThreshold,
      xp_coefficient: ex.xpCoefficient,
    }));

    const { error: exercisesError } = await supabase
      .from("exercises")
      .upsert(exerciseRows, { onConflict: "slug" });

    if (exercisesError) {
      throw new Error(`Échec upsert exercices pour "${family.slug}": ${exercisesError.message}`);
    }

    console.log(`✓ ${family.name} (${family.exercises.length} niveaux)`);
  }

  // 3. Badges.
  const badgesRaw = readFileSync(path.join(__dirname, "..", "seed", "badges.json"), "utf-8");
  const badgesData = JSON.parse(badgesRaw) as { badges: SeedBadge[] };

  const { error: badgesError } = await supabase.from("badges").upsert(
    badgesData.badges.map((b) => ({
      slug: b.slug,
      name: b.name,
      description: b.description,
      sort_order: b.sortOrder,
    })),
    { onConflict: "slug" }
  );

  if (badgesError) {
    throw new Error(`Échec upsert badges: ${badgesError.message}`);
  }

  console.log(`✓ Badges (${badgesData.badges.length})`);

  // 4. Mouvements de circuit (sans famille/tier) + leurs variantes. Deux
  // passes : d'abord les mouvements de base (pour avoir leur id), puis les
  // variantes qui référencent ce id via variant_of_id.
  const circuitExercisesRaw = readFileSync(
    path.join(__dirname, "..", "seed", "circuit-exercises.json"),
    "utf-8"
  );
  const circuitExercisesData = JSON.parse(circuitExercisesRaw) as { exercises: SeedCircuitExercise[] };

  const baseMovements = circuitExercisesData.exercises.filter((e) => !e.variantOfSlug);
  const variantMovements = circuitExercisesData.exercises.filter((e) => e.variantOfSlug);

  const { error: baseMovementsError } = await supabase.from("exercises").upsert(
    baseMovements.map((e) => ({
      slug: e.slug,
      name: e.name,
      // Explicite (pas juste omis) : un slug réutilisé depuis l'ancien
      // contenu (ex. "burpee" appartenait à l'ex-famille "hiit") doit bien
      // perdre son ancien family_id/tier, pas le garder par défaut.
      family_id: null,
      tier: null,
      unlock_type: null,
      unlock_threshold: null,
      xp_coefficient: null,
      variant_of_id: null,
    })),
    { onConflict: "slug" }
  );
  if (baseMovementsError) {
    throw new Error(`Échec upsert mouvements de circuit: ${baseMovementsError.message}`);
  }

  const { data: allExercisesSoFar, error: allExercisesSoFarError } = await supabase
    .from("exercises")
    .select("id, slug");
  if (allExercisesSoFarError || !allExercisesSoFar) {
    throw new Error(`Échec lecture des exercices: ${allExercisesSoFarError?.message}`);
  }
  const exerciseIdBySlugSoFar = new Map(allExercisesSoFar.map((e) => [e.slug, e.id]));

  const { error: variantMovementsError } = await supabase.from("exercises").upsert(
    variantMovements.map((e) => {
      const variantOfId = exerciseIdBySlugSoFar.get(e.variantOfSlug!);
      if (!variantOfId) {
        throw new Error(`Mouvement de base inconnu "${e.variantOfSlug}" pour la variante "${e.slug}"`);
      }
      return {
        slug: e.slug,
        name: e.name,
        variant_of_id: variantOfId,
        family_id: null,
        tier: null,
        unlock_type: null,
        unlock_threshold: null,
        xp_coefficient: null,
      };
    }),
    { onConflict: "slug" }
  );
  if (variantMovementsError) {
    throw new Error(`Échec upsert variantes de circuit: ${variantMovementsError.message}`);
  }

  console.log(
    `✓ Mouvements de circuit (${baseMovements.length} de base, ${variantMovements.length} variantes)`
  );

  // Nettoyage des familles d'un seed précédent qui n'existent plus dans
  // trees.json (ex. "hiit", devenu un circuit plutôt qu'une compétence
  // technique) : supprimable sans risque une fois qu'on a vérifié qu'aucun
  // exercice ne la référence plus (orphelinage ci-dessus).
  const currentFamilySlugs = new Set(treesData.families.map((f) => f.slug));
  const { data: staleFamilies, error: staleFamiliesError } = await supabase
    .from("exercise_families")
    .select("id, slug");
  if (staleFamiliesError) {
    throw new Error(`Échec lecture des familles pour nettoyage: ${staleFamiliesError.message}`);
  }
  for (const fam of staleFamilies ?? []) {
    if (currentFamilySlugs.has(fam.slug)) continue;
    const { count, error: countError } = await supabase
      .from("exercises")
      .select("id", { count: "exact", head: true })
      .eq("family_id", fam.id);
    if (countError) throw new Error(`Échec vérification famille obsolète "${fam.slug}": ${countError.message}`);
    if (count && count > 0) {
      console.log(`⚠ Famille obsolète "${fam.slug}" conservée : ${count} exercice(s) y référencent encore.`);
      continue;
    }
    const { error: deleteFamilyError } = await supabase.from("exercise_families").delete().eq("id", fam.id);
    if (deleteFamilyError) throw new Error(`Échec suppression famille obsolète "${fam.slug}": ${deleteFamilyError.message}`);
    console.log(`✓ Famille obsolète "${fam.slug}" supprimée (plus aucun exercice ne la référence).`);
  }

  // 5. Circuits (avec leurs parties). Repartir de zéro à chaque seed plutôt
  // que d'upsert les parties/exercices : plus simple pour refléter
  // exactement le JSON (ajout/retrait/réordonnancement). Supprimer les
  // parties d'un circuit cascade sur ses session_template_exercises.
  const circuitsRaw = readFileSync(path.join(__dirname, "..", "seed", "circuits.json"), "utf-8");
  const circuitsData = JSON.parse(circuitsRaw) as { circuits: SeedCircuit[] };

  const { data: allExercises, error: allExercisesError } = await supabase
    .from("exercises")
    .select("id, slug");
  if (allExercisesError || !allExercises) {
    throw new Error(`Échec lecture des exercices pour les circuits: ${allExercisesError?.message}`);
  }
  const exerciseIdBySlug = new Map(allExercises.map((e) => [e.slug, e.id]));

  for (const circuit of circuitsData.circuits) {
    const phaseId = phaseIdBySlug.get(circuit.phaseSlug);
    if (!phaseId) throw new Error(`Phase inconnue "${circuit.phaseSlug}" pour le circuit "${circuit.slug}"`);

    const { data: circuitRow, error: circuitError } = await supabase
      .from("session_templates")
      .upsert(
        { slug: circuit.slug, name: circuit.name, sort_order: circuit.sortOrder, phase_id: phaseId },
        { onConflict: "slug" }
      )
      .select("id")
      .single();

    if (circuitError || !circuitRow) {
      throw new Error(`Échec upsert circuit "${circuit.slug}": ${circuitError?.message}`);
    }

    const { error: deletePartsError } = await supabase
      .from("session_template_parts")
      .delete()
      .eq("session_template_id", circuitRow.id);
    if (deletePartsError) {
      throw new Error(`Échec nettoyage des parties du circuit "${circuit.slug}": ${deletePartsError.message}`);
    }

    let exerciseCount = 0;
    for (const part of circuit.parts) {
      const { data: partRow, error: partError } = await supabase
        .from("session_template_parts")
        .insert({
          session_template_id: circuitRow.id,
          part_index: part.partIndex,
          label: part.label ?? null,
          rounds: part.rounds,
          rest_between_rounds_seconds: part.restBetweenRoundsSeconds,
        })
        .select("id")
        .single();

      if (partError || !partRow) {
        throw new Error(`Échec insertion partie ${part.partIndex} du circuit "${circuit.slug}": ${partError?.message}`);
      }

      const exerciseRows = part.exercises.map((ex) => {
        const exerciseId = exerciseIdBySlug.get(ex.exerciseSlug);
        if (!exerciseId) {
          throw new Error(`Exercice inconnu "${ex.exerciseSlug}" dans le circuit "${circuit.slug}"`);
        }
        return {
          session_template_id: circuitRow.id,
          part_id: partRow.id,
          exercise_id: exerciseId,
          target_sets: ex.targetSets,
          target_performance: ex.targetPerformance,
          rest_between_sets_seconds: ex.restBetweenSetsSeconds,
          rest_after_exercise_seconds: ex.restAfterExerciseSeconds,
          sort_order: ex.sortOrder,
        };
      });

      const { error: insertError } = await supabase.from("session_template_exercises").insert(exerciseRows);
      if (insertError) {
        throw new Error(`Échec insertion des exos de la partie ${part.partIndex} du circuit "${circuit.slug}": ${insertError.message}`);
      }
      exerciseCount += exerciseRows.length;
    }

    console.log(`✓ Circuit "${circuit.name}" (${circuit.parts.length} partie(s), ${exerciseCount} exercices)`);
  }

  console.log("Seed terminé.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
