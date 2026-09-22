-- Calisthenics RPG - policy RLS manquante pour l'invalidation d'un circuit
-- 0010_phases_and_circuits.sql n'avait que select/insert sur
-- user_circuit_completions : sans policy "delete", Supabase bloquait
-- silencieusement toute suppression (0 ligne affectée, aucune erreur
-- renvoyée) - même bug déjà rencontré et documenté dans
-- 0005_planning_delete_policies.sql pour weekly_plans et ses tables filles.
-- app/tree/actions.ts::uncompleteCircuit "réussissait" sans rien changer.

create policy "users delete their own circuit completions"
  on user_circuit_completions for delete
  to authenticated
  using (auth.uid() = user_id);
