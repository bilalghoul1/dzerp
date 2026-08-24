# Fix — Erreurs Runtime après implémentation Global Super Admin + Company Owner

Date : 2026-08-08
Statut des signatures : **Quality Gates ❌→✅** ; **Tests service/DB ✅** ; **Runtime HTTP ✅ (exécuté réellement le 2026-08-08, voir §4.3).**

Ce document est l'**étape 5**. Il décrit les causes racines, les fichiers modifiés, les correctifs
appliqués, les tests effectués et ce qui reste à confirmer en navigation réelle.

> L'étape 1 (audit complet, chemin d'exécution, causes racines) est dans
> `docs/debug/super-admin-runtime-errors-audit.md`.

---

## 1. Cause racine — Problème 1 : « Aucune société accessible. » (403)

**Symptôme** : `ApiError: "Aucune société accessible."` lancé depuis
`src/app/(app)/layout.tsx` (ligne ~21), pour tout accès d'un SUPER_ADMIN aux pages
d'administration (`/admin*`).

**Cause racine** : le layout `(app)` résolvait **inconditionnellement** le contexte société pour
chaque route (`resolveCompanyContext(session)`). Ce résolveur est correct et *fail-closed* pour
les tenants (il exige une adhésion `UserCompany` active + un contexte société). Or un
**SUPER_ADMIN est une entité de plateforme** : il n'a **aucun** `UserCompany` par définition
(documenté dans `docs/admin/super-admin-implementation.md`). Le layout exigeait donc un contexte
société que le Super Admin ne peut pas avoir → 403 sur **toutes** les pages `(app)`, y compris
`/admin/*`. **Ce n'était ni un bug de RBAC ni un bug du resolver** : c'était un couplage non prévu
entre le layout global (qui force un contexte société pour chaque route) et l'entité Super Admin
globale (hors société).

**Règle respectée** : aucun `UserCompany` factice, aucune société par défaut fabriquée, aucun
`try/catch` masquant, pas de `bypass` inconditionnel. L'isolation societaire est conservée.

## 2. Cause racine — Problème 2 : « Encountered a script tag while rendering React component »

**Symptôme** : console error provenant de `src/features/theme/bootstrap-script.tsx` (rendu d'un
`<script dangerouslySetInnerHTML>`).

**Cause racine** : le bootstrap anti-FOUC était rendu comme **élément `<script>` créé par un
composant React**. En rendu client (hydration), React ne ré-exécute **jamais** les scripts déclarés
de cette façon et émet le warning → risque de flash + erreur console.

**Correctif** : `BootstrapScript` utilise désormais `next/script` avec la stratégie
`beforeInteractive` (méthode App Router documentée). Le script inline est injecté dans `<head>`
**depuis le serveur** et s'exécute **avant toute hydratation / premier paint** (anti-FOUC conservé),
sans être recréé comme élément `<script>` par React côté client (plus d'erreur console, pas de
mismatch d'hydration — le `<html>` porte déjà `suppressHydrationWarning`).

---

## 3. Fichiers modifiés

### Problème 1 (contexte société)
| Fichier | Modification |
|---|---|
| `src/app/(app)/layout.tsx` | Bifurcation du layout : si `session.isSuperAdmin` **et** aucune adhésion → rend un shell « plateforme » `context={null}` (sans `resolveCompanyContext`, sans société incompatible). Sinon comportement inchangé. |
| `src/components/shell/app-shell.tsx` | Accepte `context: CompanyContext \| null` + props `user`/`permissions`. Profil « plateforme » : badge « Plateforme » (pas de CompanySwitcher/BranchSelector), pas de `CompanyProvider`. Profil société : comportement inchangé. |
| `src/app/(app)/admin/companies/page.tsx` | Utilise `getAdminActor()` (`company-admin/api`) au lieu de `getOrResolveCompanyContext()` → l'acteur SA porte ses **permissions globales** (évite liste société vide pour le SA). |
| `src/app/(app)/admin/companies/[companyId]/page.tsx` | Idem (acteur correct pour le SA global). |
| `src/features/i18n/dictionaries.ts` | Ajout clé `header.platform` (fr/ar/en) pour le badge plateforme. |
| `scripts/ensure-demo-super-admin.ts` | **Ajouté** : provision idempotent, **non-destructif** d'un SA de test pour la vérification runtime (génère le rôle SUPER_ADMIN + perms `admin.*` + compte `superadmin` ; ne supprime jamais de données). |

### Bug 2 (thème)
| Fichier | Modification |
|---|---|
| `src/features/theme/bootstrap-script.tsx` | Remplace le `<script dangerouslySetInnerHTML>` par `next/script` `beforeInteractive` (id requis pour inline), + suppression justifyée du warning lint (fausse-positif App Router). |
| `src/app/layout.tsx` | Déplace `<BootstrapScript />` du `<head>` vers `<body>` (place média documentée pour `beforeInteractive` ; Next l'injecte dans `<head>` au runtime). |

> Aucune modification de logique métier, du Document Engine, ni du modèle Prisma. Aucune nouvelle
> fonctionnalité métier : uniquement la prise en charge du profil plateforme pour le Super Admin et
> la correction de l'injection du bootstrap thème.

---

## 4. Tests effectués

### 4.1 Quality gates (STATIQUE)
| Gate | Résultat |
|---|---|
| `npx prisma validate` | ✅ schéma valide |
| `npx tsc --noEmit` | ✅ aucune erreur de compilation |
| `npm run lint` | ✅ **0 erreur** (9 warnings : 8 préexistants hors périmètre, 1 lié à `next/script` corrigé par suppression justifyée) |
| `npm run build` | ✅ build complet sans erreur |

### 4.2 Tests service/DB (régression, `scripts/verify-super-admin.ts`)
**27 / 27 vérifications réussies**, couvrant :
- **SA connectable SANS adhésion `UserCompany`** (`memberships=0`), mot de passe vérifié (login possible).
- Permissions globales `admin.company.create/archive/restore` présentes ; `isGlobalAdmin(acteur sans société)` = true.
- SA **crée une Société + Propriétaire**, liste la société, consulte le détail.
- **Owner** : rôle exactement `OWNER` (scoped), appartient uniquement à sa société, `mustChangePassword` obligatoire, login avec le mot de passe temporaire.
- **Isolation** : le Owner A ne voit **aucune** donnée métier de B (scope lecture A) ; l'écriture métier est rattachée à SA société (contexte) ; le service refuse la gestion de la société B (`assertCompanyAccess`).
- SA opère globalement **même si** un contexte société est passé ; reste **sans adhésion** après les opérations.
- Reset de mot de passe Owner : ancien MDP invalide, nouveau valide ; après 1er changement `mustChangePassword=false`.

### 4.3 Runtime HTTP — **EXÉCUTÉ (réel, 2026-08-08)**

Serveur réel : `next dev` (Turbopack, Next 16.2.12). Session HTTP complète avec curl (cookies).

| Vérification | Résultat |
|---|---|
| POST `/api/auth/login` (superadmin / Super-Admin-Dev-2026!) | ✅ 200, session cookie, `mustChangePassword:false` |
| GET `/api/current-user` | ✅ 200 — `isSuperAdmin:true`, **10 permissions globales `admin.*`**, zéro adhésion requise |
| GET `/admin` (ciblait l'erreur « Aucune société accessible. ») | ✅ **200** (redirige 307 vers `/admin/companies` puis 200) — plus aucun 403 |
| GET `/admin/companies` (liste globale des sociétés) | ✅ **200** — le SA voit la liste globale (pas vide grâce à `getAdminActor`) |
| GET `/` (page scopée société, SA sans société) | ✅ redirige vers `/login` — comportement *fail-closed* conservé : une page société exige un contexte société |
| GET `/login` HTML → bootstrap thème | ✅ le script anti-FOUC (`localStorage dzerp.theme/dzerp.lang`) est enregistré via le chargeur `next/script` (`self.__next_s`, `id="theme-bootstrap"`), **pas** rendu comme élément `<script>` React → plus d'error « Encountered a script tag » |

## 5. Réponses au brief

- **Cause racine 1** : layout `(app)` exigeait un contexte société y compris pour un SUPER_ADMIN de plateforme
  (aucune adhésion) → 403. → corrigé par une bifurcation « plateforme » dans le layout.
- **Cause racine 2** : `<script>` rendu par un composant React, ignoré côté client à l'hydration → erreur console.
  Corrigé en utilisant `next/script beforeInteractive` (injection serveur dans `<head>` pré-hydration).
- **Fichiers modifiés** : voir §3.
- **Tests** : qualité gate ❌→✅ ; service/DB ✅ (27/27) ; runtime HTTP ✅ (réel).
- **Le Super Admin peut-il se connecter sans société ?** ✅ **Oui, confirmé en réel** : login
  réussi sans aucune adhésion `UserCompany`, `/api/current-user` renvoie `isSuperAdmin:true` +
  permissions globales, `/admin*` accessible (200), liste société globale non vide.
- **Le Company Owner fonctionne-t-il encore ?** ✅ (testé au niveau service : rôle scoped, isolation, reset MDP).
- **L'erreur « script tag » a-t-elle disparu ?** Oui par construction (`next/script`), à confirmer en
  console navigateur au prochain lancement.
- **Régression ?** Aucune détectée : tests de régression service/DB intacts, gates statiques vertes.

## 6. Ce qui reste
- **Vérification interactive de l'expérience navigateur** (rendu visuel du shell « plateforme »,
  bascule Dark/Light/System, RTL au clic) : le comportement racine est confirmé au HTTP (§4.3) et le
  thème est bien délivré via `next/script`, mais la validation manuelle dans un navigateur
  (flash/bascule) relève d'un test utilisateur final, non couvert par curl.
- **Le compte `superadmin` provisionné reste présent en base de dev** (créé par
  `scripts/ensure-demo-super-admin.ts`, non-destructif). À supprimer avant une mise en prod ou à
  protéger selon votre politique.**