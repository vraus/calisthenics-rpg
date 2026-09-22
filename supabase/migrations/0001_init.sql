-- Calisthenics RPG - schéma initial
-- Familles de mouvements, exercices/tiers, séances loggées, progression utilisateur.

create table if not exists exercise_families (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  stat_tag text not null,
  sort_order int not null default 0
);

create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references exercise_families (id) on delete cascade,
  slug text unique not null,
  name text not null,
  tier int not null,
  unlock_type text not null check (unlock_type in ('reps', 'duration')),
  unlock_threshold int not null,
  xp_coefficient numeric not null,
  unique (family_id, tier)
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references exercises (id) on delete cascade,
  performed_at timestamptz not null default now(),
  sets int not null check (sets > 0),
  reps_per_set int,
  duration_seconds int,
  xp_earned numeric not null,
  created_at timestamptz not null default now(),
  constraint sessions_reps_or_duration check (
    (reps_per_set is not null and duration_seconds is null)
    or (reps_per_set is null and duration_seconds is not null)
  )
);

-- Progression par exercice. "mastered" = l'utilisateur a déjà atteint le
-- seuil de déblocage de CET exercice au moins une fois (voir
-- meetsUnlockThreshold côté lib/xp.ts), ce qui déverrouille le tier suivant
-- de la même famille. Le tier 1 de chaque famille est toujours déverrouillé
-- sans qu'une ligne n'existe ici.
create table if not exists user_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references exercises (id) on delete cascade,
  xp_in_exercise numeric not null default 0,
  mastered boolean not null default false,
  mastered_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

create index if not exists sessions_user_id_idx on sessions (user_id, performed_at desc);
create index if not exists user_progress_user_id_idx on user_progress (user_id);
create index if not exists exercises_family_id_idx on exercises (family_id, tier);

-- Row Level Security : chaque utilisateur ne voit et n'écrit que ses propres
-- séances et sa propre progression. Les tables de référence (familles,
-- exercices) sont en lecture publique authentifiée.

alter table exercise_families enable row level security;
alter table exercises enable row level security;
alter table sessions enable row level security;
alter table user_progress enable row level security;

create policy "exercise_families are readable by authenticated users"
  on exercise_families for select
  to authenticated
  using (true);

create policy "exercises are readable by authenticated users"
  on exercises for select
  to authenticated
  using (true);

create policy "users read their own sessions"
  on sessions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users insert their own sessions"
  on sessions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users read their own progress"
  on user_progress for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users upsert their own progress"
  on user_progress for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users update their own progress"
  on user_progress for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
