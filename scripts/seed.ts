/**
 * Charge seed/trees.json dans Supabase (exercise_families + exercises).
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

  console.log("Seed terminé.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
