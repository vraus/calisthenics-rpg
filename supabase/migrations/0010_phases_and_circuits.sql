-- Calisthenics RPG — phases (zones de progression), description des niveaux,
-- variantes d'exercices de circuit, parties de circuit (p1/p2...), suivi de
-- complétion des circuits, phase courante du profil.
-- Fondation du refactor "phases/compétences techniques/circuits" (Jalon 1) :
-- réécrit le contenu pédagogique sans encore changer les parcours UI.

-- Phases = zones de progression (3 aujourd'hui). Lecture publique comme
-- exercise_families/exercises.
create table if not exists phases (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  sort_order int not null default 0,
  -- Texte des prérequis affiché pendant l'onboarding (Jalon 2) pour situer
  -- un nouveau joueur. Vide pour la phase 1 (aucun prérequis).
  prerequisites_text text,
  created_at timestamptz not null default now()
);

alter table exercise_families add column if not exists phase_id uuid references phases (id) on delete set null;
alter table session_templates add column if not exists phase_id uuid references phases (id) on delete set null;

-- Un exercice peut maintenant : appartenir à une compétence technique
-- (family_id + tier, comme avant), OU être un mouvement de circuit sans
-- progression technique (family_id/tier null, ex. burpee, jumping jack), OU
-- être la variante d'un autre exercice de circuit (variant_of_id).
-- unlock_type/threshold/xp_coefficient ne s'appliquent qu'aux exercices de
-- compétence technique — nullable pour les mouvements de circuit purs.
alter table exercises alter column family_id drop not null;
alter table exercises alter column tier drop not null;
alter table exercises alter column unlock_type drop not null;
alter table exercises alter column unlock_threshold drop not null;
alter table exercises alter column xp_coefficient drop not null;

alter table exercises add column if not exists description text;
alter table exercises add column if not exists variant_of_id uuid references exercises (id) on delete cascade;

-- Le unique(family_id, tier) d'origine bloquait toute valeur null (deux
-- exercices sans famille ne pourraient jamais coexister) : remplacé par un
-- index partiel qui ne s'applique qu'aux exercices réellement dans une
-- compétence technique.
alter table exercises drop constraint if exists exercises_family_id_tier_key;
create unique index if not exists exercises_family_id_tier_idx
  on exercises (family_id, tier)
  where family_id is not null;

create index if not exists exercises_variant_of_id_idx on exercises (variant_of_id);

-- Parties d'un circuit préfait (ex. "Push A" a p1 puis p2, chacune avec son
-- propre nombre de tours et sa pause entre tours). Remplace
-- session_templates.rounds/rest_between_rounds_seconds (posés en 0008),
-- devenus incohérents dès qu'un circuit a plusieurs parties aux réglages
-- différents.
create table if not exists session_template_parts (
  id uuid primary key default gen_random_uuid(),
  session_template_id uuid not null references session_templates (id) on delete cascade,
  part_index int not null default 0,
  label text,
  rounds int not null default 1 check (rounds > 0),
  rest_between_rounds_seconds int not null default 90,
  unique (session_template_id, part_index)
);

-- Migration des données existantes : une partie unique par template, avec
-- les valeurs actuelles de rounds/rest_between_rounds_seconds.
insert into session_template_parts (session_template_id, part_index, rounds, rest_between_rounds_seconds)
select id, 0, rounds, rest_between_rounds_seconds
from session_templates
where not exists (
  select 1 from session_template_parts where session_template_parts.session_template_id = session_templates.id
);

alter table session_template_exercises add column if not exists part_id uuid references session_template_parts (id) on delete cascade;
update session_template_exercises ste
set part_id = stp.id
from session_template_parts stp
where stp.session_template_id = ste.session_template_id and stp.part_index = 0 and ste.part_id is null;
alter table session_template_exercises alter column part_id set not null;

-- rounds/rest_between_rounds_seconds vivent maintenant sur
-- session_template_parts (un circuit peut avoir plusieurs parties aux
-- réglages différents) : les colonnes au niveau template n'ont plus de sens.
alter table session_templates drop column if exists rounds;
alter table session_templates drop column if exists rest_between_rounds_seconds;

create index if not exists session_template_parts_template_id_idx on session_template_parts (session_template_id);
create index if not exists session_template_exercises_part_id_idx on session_template_exercises (part_id);

alter table session_template_parts enable row level security;

create policy "session_template_parts are readable by authenticated users"
  on session_template_parts for select
  to authenticated
  using (true);

-- Équivalent côté plan réel (Jalon 5/6) : purement additif, aucune donnée
-- existante touchée. part_id nullable sur planned_exercises = "partie
-- implicite unique", qui continue d'utiliser
-- planned_sessions.rounds/rest_between_rounds_seconds comme aujourd'hui.
-- Une séance construite depuis un circuit à plusieurs parties utilisera des
-- lignes planned_session_parts explicites à la place.
create table if not exists planned_session_parts (
  id uuid primary key default gen_random_uuid(),
  planned_session_id uuid not null references planned_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  part_index int not null default 0,
  label text,
  rounds int not null default 1 check (rounds > 0),
  rest_between_rounds_seconds int not null default 90,
  unique (planned_session_id, part_index)
);

alter table planned_exercises add column if not exists part_id uuid references planned_session_parts (id) on delete cascade;

create index if not exists planned_session_parts_session_id_idx on planned_session_parts (planned_session_id);
create index if not exists planned_session_parts_user_id_idx on planned_session_parts (user_id);
create index if not exists planned_exercises_part_id_idx on planned_exercises (part_id);

alter table planned_session_parts enable row level security;

create policy "users read their own planned session parts" on planned_session_parts for select to authenticated using (auth.uid() = user_id);
create policy "users insert their own planned session parts" on planned_session_parts for insert to authenticated with check (auth.uid() = user_id);
create policy "users update their own planned session parts" on planned_session_parts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users delete their own planned session parts" on planned_session_parts for delete to authenticated using (auth.uid() = user_id);

-- Suivi "j'ai validé ce circuit au moins une fois" (condition de passage de
-- phase, Jalon 7) — fait historique comme user_badges, jamais recalculé.
create table if not exists user_circuit_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_template_id uuid not null references session_templates (id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (user_id, session_template_id)
);

create index if not exists user_circuit_completions_user_id_idx on user_circuit_completions (user_id);

alter table user_circuit_completions enable row level security;

create policy "users read their own circuit completions" on user_circuit_completions for select to authenticated using (auth.uid() = user_id);
create policy "users insert their own circuit completions" on user_circuit_completions for insert to authenticated with check (auth.uid() = user_id);

-- Phase courante du joueur (posée par l'onboarding, Jalon 2) + marqueur
-- "onboarding fait" pour savoir s'il faut rediriger vers le questionnaire de
-- placement.
alter table profiles add column if not exists current_phase_id uuid references phases (id) on delete set null;
alter table profiles add column if not exists onboarding_completed_at timestamptz;

alter table phases enable row level security;

create policy "phases are readable by authenticated users"
  on phases for select
  to authenticated
  using (true);
