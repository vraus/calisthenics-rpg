-- Calisthenics RPG — planification hebdomadaire + bonus XP
-- Purement additif : aucune table existante n'est modifiée, aucune donnée
-- déjà en base (sessions, user_progress, badges...) n'est touchée.

create table if not exists weekly_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null, -- lundi de la semaine concernée
  perfect_week_awarded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table if not exists planned_sessions (
  id uuid primary key default gen_random_uuid(),
  weekly_plan_id uuid not null references weekly_plans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  sort_order int not null default 0,
  completed_at timestamptz,
  full_completion boolean not null default false
);

create table if not exists planned_exercises (
  id uuid primary key default gen_random_uuid(),
  planned_session_id uuid not null references planned_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references exercises (id) on delete cascade,
  target_sets int not null check (target_sets > 0),
  -- reps or seconds depending on exercises.unlock_type, copied from
  -- unlock_threshold at plan-creation time (not a live reference).
  target_performance int not null,
  sort_order int not null default 0
);

create table if not exists planned_sets (
  id uuid primary key default gen_random_uuid(),
  planned_exercise_id uuid not null references planned_exercises (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  set_number int not null,
  done_at timestamptz,
  session_id uuid references sessions (id) on delete set null,
  unique (planned_exercise_id, set_number)
);

-- Generic ledger for XP not tied to a specific exercise (full-session bonus,
-- perfect-week bonus). Global level = sum(user_progress.xp_in_exercise) +
-- sum(xp_bonuses.amount) — never folded into a family level.
create table if not exists xp_bonuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric not null,
  source text not null check (source in ('session_complete', 'perfect_week')),
  planned_session_id uuid references planned_sessions (id) on delete set null,
  weekly_plan_id uuid references weekly_plans (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists weekly_plans_user_id_idx on weekly_plans (user_id);
create index if not exists planned_sessions_user_id_idx on planned_sessions (user_id);
create index if not exists planned_sessions_weekly_plan_id_idx on planned_sessions (weekly_plan_id);
create index if not exists planned_exercises_user_id_idx on planned_exercises (user_id);
create index if not exists planned_exercises_planned_session_id_idx on planned_exercises (planned_session_id);
create index if not exists planned_sets_user_id_idx on planned_sets (user_id);
create index if not exists planned_sets_planned_exercise_id_idx on planned_sets (planned_exercise_id);
create index if not exists xp_bonuses_user_id_idx on xp_bonuses (user_id);

alter table weekly_plans enable row level security;
alter table planned_sessions enable row level security;
alter table planned_exercises enable row level security;
alter table planned_sets enable row level security;
alter table xp_bonuses enable row level security;

create policy "users read their own weekly plans" on weekly_plans for select to authenticated using (auth.uid() = user_id);
create policy "users insert their own weekly plans" on weekly_plans for insert to authenticated with check (auth.uid() = user_id);
create policy "users update their own weekly plans" on weekly_plans for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users read their own planned sessions" on planned_sessions for select to authenticated using (auth.uid() = user_id);
create policy "users insert their own planned sessions" on planned_sessions for insert to authenticated with check (auth.uid() = user_id);
create policy "users update their own planned sessions" on planned_sessions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users read their own planned exercises" on planned_exercises for select to authenticated using (auth.uid() = user_id);
create policy "users insert their own planned exercises" on planned_exercises for insert to authenticated with check (auth.uid() = user_id);

create policy "users read their own planned sets" on planned_sets for select to authenticated using (auth.uid() = user_id);
create policy "users insert their own planned sets" on planned_sets for insert to authenticated with check (auth.uid() = user_id);
create policy "users update their own planned sets" on planned_sets for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users read their own xp bonuses" on xp_bonuses for select to authenticated using (auth.uid() = user_id);
create policy "users insert their own xp bonuses" on xp_bonuses for insert to authenticated with check (auth.uid() = user_id);
