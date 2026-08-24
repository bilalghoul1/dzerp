# Audit — Erreurs Runtime après implémentation Global Super Admin + Company Owner

Date : 2026-08-08
Périmètre : deux erreurs de runtime relevées en dev :
1. `ApiError: Aucune société accessible.` lors de l'accès aux pages d'administration par un
   SUPER_ADMIN global.
2. Console error « Encountered a script tag while rendering React component » provenant du
   bootstrap de thème.

Ce document est l'**étape 1** du plan. Aucune modification de code n'a encore été appliquée :
il s'agit d'un audit de suivi du chemin d'exécution complet, du point d'entrée jusqu'à la source,
avant toute décision d'implémentation.

---

## 1. Problème 1 — « Aucune société accessible. » (Super Admin bloqué)

### 1.1 Stack trace

```
ApiError: "Aucune société accessible."
  at resolveCompanyContext (src/features/company/resolver.ts:183)
  ← appelé depuis src/app/(app)/layout.tsx:21
```

### 1.2 Chemin d'exécution complet (du point d'entrée jusqu'à l'erreur)

1. `GET /…` → l'utilisateur authentifié ouvre n'importe quelle page du groupe `(app)`, y compris
   `/admin`, `/admin/companies`, `/admin/companies/nouveau`…
2. `src/app/(app)/layout.tsx` (layout parent de **toutes** les pages du groupe `(app)`) :
   - `getCurrentUser()` détermine la session (détecte `isSuperAdmin`, permissions globales) ;
   - appelle ensuite **inconditionnellement** `resolveCompanyContext(session)` (ligne 21), puis
     `runWithCompanyContext(context, …)` pour envelopper le shell `AppShell`.
3. `src/features/company/resolver.ts :: resolveCompanyContext` :
   - `listAssignedCompanies(session.user.id)` → `listCompaniesForUser` → interroge `UserCompany`.
     Pour un SUPER_ADMIN **sans aucun `UserCompany`**, ce tableau est **vide**.
   - `resolveActiveCompany(companies, sessionActive?.activeCompanyId)` → retourne **`null`** (aucune
     adhésion valide ; cookie/session invalides ; aucune société par défaut).
   - ligne 183-185 : `throw new ApiError(403, "Aucune société accessible.", "FORBIDDEN")`.
4. **Résultat** : le SUPER_ADMIN ne peut accéder à **aucune page du groupe `(app)`**, y compris les
   pages globales `/admin/*`, parce que le `layout` parent lève l'erreur avant que la page ne soit
   rendue.

### 1.3 Explication de la cause

Le **layout `(app)`** est le point unique qui résout OBLIGATOIREMENT le contexte société pour
chaque route. La résolution (`resolveCompanyContext`) est rigoureuse : elle exige une adhésion
(`UserCompany`) active et un contexte société résolu, sinon **403**. Ceci est voulu et **correct**
pour un **tenant user** (Owner / USER), qui doit effectivement opérer uniquement en contexte de
société.

Le problème vient de la **nouvelle exigence métier SUPER_ADMIN** : un Super Admin global n'a pas
d'adhésion `UserCompany` (c'est une propriété de la plateforme, documentée dans
`docs/admin/super-admin-implementation.md` : « Aucune `UserCompany` n'est créé »). Il est donc
actuellement impossible d'atteindre les pages `/admin/*` car le layout exige un contexte société
que le Super Admin n'a pas.

**Ce n'est ni un bug de RBAC, ni un bug du resolver en lui-même** (le resolver est correct et
fail-closed pour les tenants). C'est un **couplage non prévu** entre :
- le layout global `(app)` (qui force **toutes** les routes à avoir un contexte société), et
- la nouvelle entité Super Admin globale (qui, par définition, n'a pas de société).

### 1.4 Pistes écartées (conformément aux règles du brief)

| Piste | Raison d'abandon |
|---|---|
| Créer un `UserCompany` factice au Super Admin | Violation explicite (« pas de fausse adhésion ») |
| Créer une société par défaut pour lui | Violation explicite (« pas de société factice ») |
| Ajouter un `try/catch` dans le resolver pour masquer le 403 | Anti-pattern, cache l'erreur au lieu de la traiter |
| `bypass` inconditionnel dans le resolver | Retire le fail-safe tenant |
| Second système Super Admin (UserRole doublé) | Déjà en place, pas de doublon |
| Réintroduire le modèle « Super Admin membre d'une société » | Contre la conception cible |

### 1.5 Cause racine à corriger

Le **point de résolution** doit devenir « contexte tolérant » pour un super-admin sans société :
- Pour un **tenant user** (Owner / USER), le comportement demeure fail-closed (403 s'il n'a aucune
  société).
- Pour un **SUPER_ADMIN** (rôle global — hors société), le contexte société **peut être absent**
  (`company = null`) **sans erreur** : c'est le mode « plateforme », légitime pour les pages
  `/admin/*`, qui doit rester **sans contexte de société** (sans fabriquer de société).

En pratique le **layout `(app)`** ne doit pas être le point qui exige la société : il doit pouvoir
rendre le shell avec un contexte « plateforme » si l'acteur est SUPER_ADMIN, et laisser les pages
**métier** (qui, elles, exigent un contexte) faire leur propre `requireCompanyContext()`.
Les pages **admin globales** (`/admin/companies*`) n'ont, par conception, **aucun** besoin de
contexte : elles utilisent déjà `getAdminActor()` et le service `runUnscoped`.

---

## 2. Problème 2 — « Encountered a script tag while rendering React component »

### 2.1 Stack trace

```
Console Error:
"Encountered a script tag while rendering React component.
Scripts inside React components are never executed when rendering on the client.
Consider using template tag instead."
  at BootstrapScript (src/features/theme/bootstrap-script.tsx:16)
```

### 2.2 Chemin d'exécution

1. `src/app/layout.tsx` (layout racine RSC) insère `<BootstrapScript />` dans `<head>` (ligne 42).
2. `BootstrapScript` renvoie un élément React :
   `<script dangerouslySetInnerHTML={{ __html: script }} />` (ligne 16).
3. Pendant le **rendu Client (hydration)**, React rencontre un élément `<script>` créé par un
   **composant React** ; or React n'exécute **jamais** les scripts déclarés de cette façon côté
   client (par sécurité, ils sont ignorés). Le moteur émet le message et le script ne s'exécute pas.

### 2.3 Objectif visé du script

Le script vise à **masquer le Flash of Unstyled Content (FOUC)** du thème : avant toute hydration,
le plus tôt possible dans le parseur (dans `<head>`), il lit `localStorage["dzerp.theme"]` et ajoute
`.dark` sur `<html>` (et applique lang/dir selon `dzerp.lang`). Il doit s'exécuter **avant** le
premier paint pour éviter le flash clair → sombre.

### 2.4 Pourquoi la solution brute est incorrecte dans Next.js

- En **SSR**, le `<script>` est bien rendu dans le HTML.
- En **hydration Client**, React le voit et **l'ignore** (ne l'exécute pas) → la fenêtre de flash
  existe malgré tout, et une **erreur console** est émise.

### 2.5 Solutions candidates (à trancher à l'étape 2)

| Option | Compatibilité Next 16 | Mérite |
|---|---|---|
| `next/script` (`beforeInteractive` / `afterInteractive`) | ✔ | Chargé hors-rendu React ; évite le message. `beforeInteractive` au top de `<html>` est le cas « inline earliest ». |
| Script inline **dans le `<head>` du layout racine côté serveur** (sans composant React enfant), via `dangerouslySetInnerHTML` sur le `<head>` existant | ✔ | Le script est dans le HTML SSR sous `<head>` ; il s'exécute avant hydration, et comme il n'est pas créé par le client React, il n'est pas ignoré. |
| `template` tag (celui suggéré par React) | ✗ | `template` n'exécute PAS le script immédiatement (il est inerte) — inadapté au FOUC ; il serait actif seulement à l'insertion ultérieure. |

**Décision retenue :** approche **inline `<head>` servé côté serveur** (non-client), conforme à
Next.js App Router : elle s'exécute avant le premier paint et n'est pas neutralisée par
l'hydration. Elle conserve le rôle anti-FOUC et supprime l'erreur console.

**Note sur hydration mismatch :** le script ne modifie rien que le SSR/le client ne re-rendent
incompatiblement : il ne modifie que `document.documentElement` (class/lang/dir) **avant** le
render. Le `suppressHydrationWarning` déjà présent sur `<html>` (layout racine) et la synchro du
`ThemeProvider` (qui utilise `usePersistedState` lisant `localStorage["dzerp.theme"]`, même source
côté client) évitent tout mismatch. Le bootstrap ne fait que poser `class/lang/dir`, sans changer
la valeur gérée par React.

---

## 3. Fichiers affectés (trace)

**Problème 1 (contexte société)**
- `src/app/(app)/layout.tsx` : point de déclenchement (le `resolveCompanyContext` inconditionnel).
- `src/features/company/resolver.ts : resolveCompanyContext / getCompanyContextOrResolve` : point
  de la faille (lève le 403 sans distinguer SUPER_ADMIN).
- `src/features/auth/rbac.ts : getCurrentUser` : détecte correctement `isSuperAdmin` (rôle global).
- `src/app/(app)/admin/companies/page.tsx` (et `[companyId]`) : utilise déjà `context?.company?.id ?? null` — déjà tolérant au null.
- `src/features/company-admin/api.ts / service.ts` : `adminGuard` / `getAdminActor` / `runUnscoped` —
  déjà prévus pour `activeCompanyId: null`.
- `src/components/shell/app-shell.tsx` : attend `context.company` toujours défini (CompanySwitcher,
  BranchSelector) — devra gérer un profil « plateforme ».

**Problème 2 (thème)**
- `src/features/theme/bootstrap-script.tsx` : le composant qui rend `script`.
- `src/app/layout.tsx` : où `BootstrapScript` est inséré dans `<head>`.

---

## 4. Pourquoi la correction projetée est sûre

- **Pas de fake membership/company** : le SUPER_ADMIN reste sans adhésion ; le « contexte
  plateforme » est une représentation vide du contexte (`company: null`) jamais utilisée pour
  filtrer sur une vraie société.
- **Pas de `try/catch` masquant** : la logique est *sémantique* — `isSuperAdmin` est une propriété
  fiable de la session (rôle global de plateforme). Si un SUPER_ADMIN tente d'atteindre une page
  nécessitant une société, cette page continue d'échouer fail-safe par son propre
  `requireCompanyContext()` (jamais d'accès cross-tenant). Le 403 du layout disparaît, mais le
  guard réel des pages métier demeure.
- **Company isolation conservée** : le scope `companyScopeExtension` / `runUnscoped` /
  `assertCompanyAccess` est inchangé ; seul le chemin « SUPER_ADMIN sans société » obtient l'état
  « plateforme ».
- **Thème** : l'ordre d'injection server-only inline n'ajoute ni ne retire de JS métier ; il
  restaure exactement le rôle anti-FOUC, sans que React ne l'ignore côté client.

## 5. Risque de régression à surveiller

1. Le layout `(app)` passant un contexte « plateforme » pour SUPER_ADMIN : vérifier de **ne pas**
   perturber (CRUD) les fonctions des pages métier (déjà guardées). Les pages `/admin/companies*`
   utilisent `context?.company?.id` — ok avec `null`.
2. Le `AppShell` doit afficher un en-tête cohérent quand `company === null` (voir
   company-switcher / branch-selector), sinon crash de `CompanySwitcher` (accède `company.name`).
3. L'hydration mismatch du thème doit rester absent même dans le nouveau mode d'injection.

→ Toute cette section sera validée à l'étape 4 (qualité + runtime).

---

## 6. Récapitulatif pour l'étape 2

| Erreur | Cause racine | Correction prévue (à valider étape 2) |
|---|---|---|
| 403 « Aucune société » | Layout `(app)` exige un contexte société y compris pour SUPER_ADMIN sans adhésion ; resolver émet 403 sans distinguer SUPER_ADMIN | Définir un contexte « plateforme » pour SUPER_ADMIN (`company = null`) dans la résolution, et rendre le shell `(app)` tolérant aux profils sans société ; les pages métier gardent leur fail-safe `requireCompanyContext` |
| « Encountered a script tag » | Bootstrap thème injecté comme **composant React `<script>`**, ignoré côté client | Rendre le bootstrap en inline `<head>` serveur, sans composant-`script` React, pour préserver l'anti-FOUC sans erreur d'hydration |