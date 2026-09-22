-- Calisthenics RPG - généralise hiit_templates en session_templates : HIIT
-- n'est plus un type de jour à part, mais un template parmi d'autres à
-- venir (choisi quand le jour est "session", au même titre que "Custom").
-- Remplace 0009_hiit_template_slug.sql (jamais appliquée) : même rôle
-- (ajouter un slug unique pour un seed idempotent), en plus du renommage.

alter table hiit_templates rename to session_templates;
alter table hiit_template_exercises rename to session_template_exercises;
alter table session_template_exercises rename column hiit_template_id to session_template_id;

alter table session_templates add column if not exists slug text;
update session_templates set slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
  where slug is null;
alter table session_templates alter column slug set not null;
create unique index if not exists session_templates_slug_idx on session_templates (slug);

alter policy "hiit_templates are readable by authenticated users"
  on session_templates rename to "session_templates are readable by authenticated users";
alter policy "hiit_template_exercises are readable by authenticated users"
  on session_template_exercises rename to "session_template_exercises are readable by authenticated users";

-- 'hiit' n'est plus une valeur valide de day_kind (aucune session réelle ne
-- devrait encore l'utiliser à ce stade, mais on convertit par sécurité
-- avant de resserrer la contrainte).
update planned_sessions set day_kind = 'session' where day_kind = 'hiit';
alter table planned_sessions drop constraint if exists planned_sessions_day_kind_check;
alter table planned_sessions add constraint planned_sessions_day_kind_check
  check (day_kind in ('rest', 'session'));
