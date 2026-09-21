-- Calisthenics RPG — nombre de tours (répétitions du circuit complet) pour
-- une séance/jour HIIT, + pause entre deux tours. Additif, complète
-- 0007_hiit_and_rest_times.sql (repos par exercice) sans le modifier.

alter table planned_sessions
  add column if not exists rounds int not null default 1 check (rounds > 0),
  add column if not exists rest_between_rounds_seconds int not null default 90;

alter table hiit_templates
  add column if not exists rounds int not null default 1 check (rounds > 0),
  add column if not exists rest_between_rounds_seconds int not null default 90;
