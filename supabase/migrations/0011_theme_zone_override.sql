-- Calisthenics RPG - choix manuel du thème de zone
-- Permet au joueur de forcer l'affichage du thème d'une zone donnée,
-- indépendamment de sa phase de progression réelle (profiles.current_phase_id).
-- null = suivre la progression (comportement par défaut, voir lib/theme.ts).

alter table profiles add column if not exists theme_zone_id uuid references phases (id) on delete set null;
