-- Calisthenics RPG — planification par jour (lundi..dimanche) + jours de repos
-- Altère 0003_planning.sql de façon additive : nouvelles colonnes à défaut,
-- rien de supprimé.

alter table planned_sessions
  add column if not exists day_of_week int check (day_of_week between 0 and 6), -- 0=lundi .. 6=dimanche
  add column if not exists is_rest_day boolean not null default false;

create unique index if not exists planned_sessions_plan_day_unique
  on planned_sessions (weekly_plan_id, day_of_week)
  where day_of_week is not null;

alter table xp_bonuses drop constraint if exists xp_bonuses_source_check;
alter table xp_bonuses add constraint xp_bonuses_source_check
  check (source in ('session_complete', 'perfect_week', 'rest_day'));
