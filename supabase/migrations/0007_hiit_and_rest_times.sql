-- Calisthenics RPG - 3ᵉ type de jour (HIIT), reps/durée éditables par
-- exercice planifié, temps de repos configurables, templates HIIT.

-- day_kind remplace is_rest_day (booléen à 2 états, insuffisant pour 3 types).
alter table planned_sessions add column if not exists day_kind text;
update planned_sessions set day_kind = case when is_rest_day then 'rest' else 'session' end
  where day_kind is null;
alter table planned_sessions alter column day_kind set not null;
alter table planned_sessions alter column day_kind set default 'session';
alter table planned_sessions add constraint planned_sessions_day_kind_check
  check (day_kind in ('rest', 'session', 'hiit'));
alter table planned_sessions drop column is_rest_day;

-- Temps de repos par exercice planifié : entre deux séries du même exercice,
-- et entre cet exercice et le suivant. Valeurs par défaut demandées : 30s / 1min.
alter table planned_exercises
  add column if not exists rest_between_sets_seconds int not null default 30,
  add column if not exists rest_after_exercise_seconds int not null default 60;

-- Templates HIIT préfaits : liste d'exercices/séries/reps réutilisable pour
-- pré-remplir un jour "hiit" dans l'éditeur de semaine. Lecture publique
-- authentifiée comme exercises/exercise_families ; pas de policy insert/update
-- côté app pour l'instant (peuplés via migration/script).
create table if not exists hiit_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists hiit_template_exercises (
  id uuid primary key default gen_random_uuid(),
  hiit_template_id uuid not null references hiit_templates (id) on delete cascade,
  exercise_id uuid not null references exercises (id) on delete cascade,
  target_sets int not null check (target_sets > 0),
  target_performance int not null,
  rest_between_sets_seconds int not null default 30,
  rest_after_exercise_seconds int not null default 60,
  sort_order int not null default 0
);

create index if not exists hiit_template_exercises_template_id_idx
  on hiit_template_exercises (hiit_template_id);

alter table hiit_templates enable row level security;
alter table hiit_template_exercises enable row level security;

create policy "hiit_templates are readable by authenticated users"
  on hiit_templates for select to authenticated using (true);

create policy "hiit_template_exercises are readable by authenticated users"
  on hiit_template_exercises for select to authenticated using (true);
