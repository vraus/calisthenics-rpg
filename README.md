# Calisthenics RPG

Application web (en développement actif) de suivi gamifié de progression en
calisthénie : log de séances, calcul d'XP, arbres de progression par famille
de mouvement (tractions, pompes/équilibre, gainage), niveaux par famille et
niveau global. PWA installable sur mobile.

## Stack

- Next.js 16 (App Router, TypeScript), déployable sur Vercel.
- Supabase (Postgres + Auth magic link), appelé directement depuis
  Server Components / Server Actions.
- Tailwind CSS.
- PWA : manifest + service worker écrit à la main (`public/sw.js`,
  `app/register-sw.tsx`).

## Mise en route

### 1. Projet Supabase

1. Créer un projet sur [supabase.com](https://supabase.com).
2. Dans SQL Editor, exécuter les fichiers de `supabase/migrations/` dans
   l'ordre (`0001_init.sql` puis `0002_badges.sql`, etc.).
3. Dans Authentication → Providers → Email, laisser Email activé
   (authentification par mot de passe). Désactiver "Confirm email" si tu
   veux que les comptes créés via le code d'invitation soient actifs sans
   étape de confirmation par email (recommandé tant qu'aucun SMTP
   personnalisé n'est configuré, cf. limite d'envoi du service email par
   défaut de Supabase).
4. Récupérer l'URL du projet et les clés dans Project Settings → API.

### 2. Variables d'environnement

Copier `.env.example` vers `.env.local` et remplir :

```
NEXT_PUBLIC_SUPABASE_URL=       # Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # anon / public key

SUPABASE_URL=                   # même valeur, pour le script de seed
SUPABASE_SERVICE_ROLE_KEY=      # service_role key (jamais exposée au client)

SIGNUP_INVITE_CODE=             # code demandé à l'inscription (app/login/actions.ts)
```

### 3. Installation et seed

```bash
npm install
npm run seed   # charge seed/trees.json (3 familles, 19 exercices) dans Supabase
```

### 4. Lancer en local

```bash
npm run dev
```

Ouvrir `http://localhost:3000`, créer un compte via le code d'invitation
(ou se connecter si le compte existe déjà), puis logger une première
séance.

### 5. Déploiement

Pousser sur un repo Git, importer dans Vercel, renseigner les mêmes
variables d'environnement (sauf `SUPABASE_SERVICE_ROLE_KEY`, à garder
seulement en local pour le seed - ne pas la mettre sur Vercel si le
projet ne s'en sert pas côté serveur ailleurs).

Sur mobile : ouvrir l'URL Vercel dans le navigateur, puis "Ajouter à
l'écran d'accueil" pour installer la PWA.

## Tests

```bash
npm test
```

Couvre le moteur XP (`lib/xp.ts`) : calcul XP par séance, courbe de
niveau, agrégation par famille et globale, déblocage de tier.

## Structure

- `lib/xp.ts` - moteur XP, sans dépendance UI ni Supabase. Réutilisable
  tel quel par un futur serveur MCP.
- `lib/data.ts` - couche d'accès aux données (lectures Supabase côté
  serveur, RLS-scopées).
- `lib/supabase/` - clients Supabase (navigateur / serveur).
- `seed/trees.json` - configuration des arbres de progression, éditable
  sans toucher au code. **Règle de compatibilité : ne jamais renommer ni
  supprimer un `slug` d'exercice ou de famille existant** - `sessions` et
  `user_progress` y font référence pour de vrais utilisateurs ; on ajoute
  toujours de nouveaux tiers/familles, jamais en remplaçant les existants.
  `npm run seed` est idempotent (upsert par slug).
- `seed/badges.json` - catalogue des badges (même règle de compatibilité :
  un `slug` de badge ne se renomme ni ne se supprime, `user_badges` y fait
  référence). `lib/badges.ts` définit les critères de déblocage (pur, testé,
  sans dépendance Supabase).
- `lib/streak.ts` - calcul du streak d'assiduité à partir des séances
  loggées, rien n'est stocké.
- `app/stats/` - page stats/records perso et badges obtenus.
- `app/log/` - page + Server Action de logging de séance.
- `app/tree/` - vue arbres de compétences (index + détail par famille).
- `app/dashboard/` - niveau global, XP, séances récentes.
- `app/history/` - historique complet des séances.
- `proxy.ts` - refresh de session Supabase + redirection si non connecté
  (équivalent du middleware, renommé en Next 16).
- `app/login/` - connexion, inscription (code d'invitation) et mot de passe
  oublié. `app/logout/` - déconnexion. `app/auth/reset-password/` -
  définition/changement de mot de passe.
- `lib/supabase/remember.ts` - logique du "rester connecté 30 jours".
- `mcp-server/` - serveur MCP exposant `lib/xp.ts` (projet Node séparé, voir
  son propre `package.json`).

## Pas encore couvert

Reconnaissance de forme par caméra, notifications.
