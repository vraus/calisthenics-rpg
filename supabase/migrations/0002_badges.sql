-- Calisthenics RPG - badges/hauts faits
-- Purement additif : aucune table existante n'est modifiée, aucune donnée
-- déjà en base (sessions, user_progress, exercises...) n'est touchée.

create table if not exists badges (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null,
  sort_order int not null default 0
);

-- Un badge obtenu reste acquis même si les critères de déblocage
-- changent plus tard : c'est un fait historique, pas un état recalculé.
create table if not exists user_badges (
  user_id uuid not null references auth.users (id) on delete cascade,
  badge_id uuid not null references badges (id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create index if not exists user_badges_user_id_idx on user_badges (user_id);

alter table badges enable row level security;
alter table user_badges enable row level security;

create policy "badges are readable by authenticated users"
  on badges for select
  to authenticated
  using (true);

create policy "users read their own badges"
  on user_badges for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users insert their own badges"
  on user_badges for insert
  to authenticated
  with check (auth.uid() = user_id);
