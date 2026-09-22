-- Calisthenics RPG - trace le circuit d'origine d'une partie de séance
-- planifiée, pour pouvoir détecter "ce circuit a été entièrement validé"
-- (Jalon 6 : user_circuit_completions, posé en 0010 mais jamais alimenté).
-- null = partie construite à la main (pas depuis un circuit préfait).

alter table planned_session_parts add column if not exists session_template_id uuid references session_templates (id) on delete set null;
