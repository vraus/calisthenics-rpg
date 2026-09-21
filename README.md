# Calisthenics RPG

MVP web de suivi gamifié de progression en calisthénie : log de séances,
calcul d'XP, arbres de progression linéaires par famille de mouvement
(tractions, pompes/équilibre, gainage), niveaux par famille et niveau
global. PWA installable sur mobile.

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
2. Dans SQL Editor, exécuter `supabase/migrations/0001_init.sql`.
3. Dans Authentication → Providers, laisser Email activé (magic link,
   pas de mot de passe requis) ; désactiver l'inscription publique si tu
   veux rester seul utilisateur (Authentication → Settings).
4. Récupérer l'URL du projet et les clés dans Project Settings → API.

### 2. Variables d'environnement

Copier `.env.example` vers `.env.local` et remplir :

```
NEXT_PUBLIC_SUPABASE_URL=       # Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # anon / public key

SUPABASE_URL=                   # même valeur, pour le script de seed
SUPABASE_SERVICE_ROLE_KEY=      # service_role key (jamais exposée au client)
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

Ouvrir `http://localhost:3000`, se connecter via lien magique (vérifier
la boîte mail utilisée), puis logger une première séance.

### 5. Déploiement

Pousser sur un repo Git, importer dans Vercel, renseigner les mêmes
variables d'environnement (sauf `SUPABASE_SERVICE_ROLE_KEY`, à garder
seulement en local pour le seed — ne pas la mettre sur Vercel si le
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

- `lib/xp.ts` — moteur XP, sans dépendance UI ni Supabase. Réutilisable
  tel quel par un futur serveur MCP.
- `lib/data.ts` — couche d'accès aux données (lectures Supabase côté
  serveur, RLS-scopées).
- `lib/supabase/` — clients Supabase (navigateur / serveur).
- `seed/trees.json` — configuration des arbres de progression, éditable
  sans toucher au code.
- `app/log/` — page + Server Action de logging de séance.
- `app/tree/` — vue arbres de compétences (index + détail par famille).
- `app/dashboard/` — niveau global, XP, séances récentes.
- `app/history/` — historique complet des séances.
- `proxy.ts` — refresh de session Supabase + redirection si non connecté
  (équivalent du middleware, renommé en Next 16).

## Non couvert par ce MVP

Reconnaissance de forme par caméra, serveur MCP exposant la même
logique (`lib/xp.ts` est déjà isolé pour ça), notifications, multi-
utilisateurs au-delà de l'auth de base.
