-- Calisthenics RPG - policies RLS manquantes pour la suppression de plan
-- 0003_planning.sql n'avait que select/insert/update sur weekly_plans et
-- les tables enfants : sans policy "delete", Supabase bloquait
-- silencieusement toute suppression (0 ligne affectée, aucune erreur
-- renvoyée) - d'où le bouton "Supprimer cette semaine" qui semblait
-- fonctionner mais ne supprimait rien.

create policy "users delete their own weekly plans"
  on weekly_plans for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "users delete their own planned sessions"
  on planned_sessions for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "users delete their own planned exercises"
  on planned_exercises for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "users delete their own planned sets"
  on planned_sets for delete
  to authenticated
  using (auth.uid() = user_id);
