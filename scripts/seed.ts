/**
 * Charge seed/trees.json (exercise_families + exercises), seed/badges.json
 * (badges) et seed/session_templates.json (templates de séance) dans
 * Supabase. Idempotent : upsert sur le slug, exécutable plusieurs fois sans
 * dupliquer.
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
  exercises: SeedExercise[];
}

interface SeedBadge {
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
}

interface SeedSessionTemplateExercise {
  exerciseSlug: string;
  targetSets: number;
  targetPerformance: number;
  restBetweenSetsSeconds: number;
  restAfterExerciseSeconds: number;
  sortOrder: number;
}

interface SeedSessionTemplate {
  slug: string;
  name: string;
  sortOrder: number;
  rounds: number;
  restBetweenRoundsSeconds: number;
  exercises: SeedSessionTemplateExercise[];
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

  const raw = readFileSync(path.join(__dirname, "..", "seed", "trees.json"), "utf-8");
  const data = JSON.parse(raw) as { families: SeedFamily[] };

  for (const family of data.families) {
    const { data: familyRow, error: familyError } = await supabase
      .from("exercise_families")
      .upsert(
        {
          slug: family.slug,
          name: family.name,
          stat_tag: family.statTag,
          sort_order: family.sortOrder,
        },
        { onConflict: "slug" }
      )
      .select("id")
      .single();

    if (familyError || !familyRow) {
      throw new Error(
        `Échec upsert famille "${family.slug}": ${familyError?.message}`
      );
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
      throw new Error(
        `Échec upsert exercices pour "${family.slug}": ${exercisesError.message}`
      );
    }

    console.log(`✓ ${family.name} (${family.exercises.length} exercices)`);
  }

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

  const templatesRaw = readFileSync(
    path.join(__dirname, "..", "seed", "session_templates.json"),
    "utf-8"
  );
  const templatesData = JSON.parse(templatesRaw) as { templates: SeedSessionTemplate[] };

  const { data: allExercises, error: allExercisesError } = await supabase
    .from("exercises")
    .select("id, slug");
  if (allExercisesError || !allExercises) {
    throw new Error(`Échec lecture des exercices pour les templates: ${allExercisesError?.message}`);
  }
  const exerciseIdBySlug = new Map(allExercises.map((e) => [e.slug, e.id]));

  for (const template of templatesData.templates) {
    const { data: templateRow, error: templateError } = await supabase
      .from("session_templates")
      .upsert(
        {
          slug: template.slug,
          name: template.name,
          sort_order: template.sortOrder,
          rounds: template.rounds,
          rest_between_rounds_seconds: template.restBetweenRoundsSeconds,
        },
        { onConflict: "slug" }
      )
      .select("id")
      .single();

    if (templateError || !templateRow) {
      throw new Error(`Échec upsert template "${template.slug}": ${templateError?.message}`);
    }

    // Repartir de zéro à chaque seed plutôt que d'upsert : plus simple pour
    // refléter exactement le JSON (ajout/retrait/réordonnancement d'exos).
    const { error: deleteError } = await supabase
      .from("session_template_exercises")
      .delete()
      .eq("session_template_id", templateRow.id);
    if (deleteError) {
      throw new Error(`Échec nettoyage des exos du template "${template.slug}": ${deleteError.message}`);
    }

    const exerciseRows = template.exercises.map((ex) => {
      const exerciseId = exerciseIdBySlug.get(ex.exerciseSlug);
      if (!exerciseId) {
        throw new Error(`Exercice inconnu "${ex.exerciseSlug}" dans le template "${template.slug}"`);
      }
      return {
        session_template_id: templateRow.id,
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
      throw new Error(`Échec insertion des exos du template "${template.slug}": ${insertError.message}`);
    }

    console.log(`✓ Template "${template.name}" (${exerciseRows.length} exercices)`);
  }

  console.log("Seed terminé.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
