-- Calisthenics RPG - profils publics + annuaire
-- Ajoute la table profiles et élargit la lecture de user_progress/sessions/
-- xp_bonuses à tout utilisateur authentifié (choix produit assumé : l'app
-- est restreinte à un petit groupe d'invités qui se connaissent déjà).

create table if not exists profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles are readable by authenticated users"
  on profiles for select
  to authenticated
  using (true);

create policy "users insert their own profile"
  on profiles for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users update their own profile"
  on profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_progress is readable by authenticated users"
  on user_progress for select
  to authenticated
  using (true);

create policy "sessions are readable by authenticated users"
  on sessions for select
  to authenticated
  using (true);

create policy "xp_bonuses are readable by authenticated users"
  on xp_bonuses for select
  to authenticated
  using (true);
