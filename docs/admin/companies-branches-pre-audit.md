# DzERP — Administration Sociétés & Branches : Pré-audit

> **Statut** : Phase d'audit (aucun code modifié). Rédigé **avant** toute modification.
> **Objectif** : documenter l'état actuel de la gestion des sociétés et des branches
> (Administration → Sociétés / Branches), diagnostiquer **en s'appuyant sur le code** les
> causes racines des problèmes signalés, et définir un plan de correction qui respecte
> l'architecture existante (multi-tenant, `companyScope`, permissions, soft-delete).

---

## 1. État actuel — table des matières

| Sujet | Fichiers responsables |
|---|---|
| Modèles Prisma | `prisma/schema.prisma` (Company, Branch, UserCompany, RoleAssignment, Session, CompanyDraft) |
| Contexte société (ALS) | `src/features/company/context.ts`, `resolver.ts`, `store.ts` |
| Isolation par société | `src/lib/db/company-scope.ts` |
| Soft-delete | `src/lib/db/soft-delete.ts` |
| Service admin sociétés | `src/features/company-admin/service.ts` (+ `api.ts`, `types.ts`, `defaults.ts`) |
| API admin sociétés | `src/app/api/admin/companies/**` |
| API branches (société active) | `src/app/api/branches/route.ts` |
| API changement de société | `src/app/api/session/company/route.ts` |
| Pages Administration → Sociétés | `src/app/(app)/admin/companies/page.tsx`, `[companyId]/page.tsx`, `nouveau/page.tsx` |
| Composants UI | `src/components/admin/companies-table.tsx`, `company-detail.tsx`, `company-wizard.tsx` |
| Branches (société active) | `src/components/settings/branches-manager.tsx` + page `src/app/(app)/parametres/branches/page.tsx` |
| Sélecteur de société | `src/components/shell/company-switcher.tsx` |
| Paramètres → Société | `src/components/settings/company-form.tsx` + `src/features/settings/config.ts` |
| Traductions | `src/i18n/dictionaries.ts` (blocs `admin` fr/ar/en) |
| Permissions | `src/features/auth/permissions.ts` (catalogue), `src/features/auth/rbac.ts` |

---

## 2. Modèles Prisma (extraits pertinents)

- **Company** : `id`, `code` (unique), `name`, `nameAr`, `commercialName`, `legalName`,
  `legalForm`, `activity`, `taxId`, `rc`, `nis`, `ai`, `vatNumber`, adresse/contacts,
  `currency` (défaut `DZD`), `fiscalYear`, `isDefault`, `isActive`, `status`
  (`CompanyStatus` ACTIVE/INACTIVE/SUSPENDED/ARCHIVED), `deletedAt`/`deletedById`
  (soft-delete), `defaultBranchId`, banque/RIB/SWIFT, identité visuelle, impression,
  `createdById`/`updatedById`.
- **Branch** : `id`, `code` (`@@unique([companyId, code])`), `name`, `nameAr`,
  `type` (BranchType, défaut `DIRECTION`), `city`, `address`, `phone`, `email`,
  `manager`, `isActive` (défaut `true`), `companyId`, `defaultBranchFor`. **Pas de
  `deletedAt`** : l'archivage d'une branche = `isActive: false`.
- **UserCompany** : `userId + companyId` unique, `active`, `isDefault`, `joinedAt`,
  `defaultBranchId`.
- **RoleAssignment** : `userCompanyId + roleId` unique, `active`, `assignedBy`,
  `expiresAt`.
- **Session** : `activeCompanyId`, `activeBranchId`.
- **CompanyDraft** : brouillon de l'assistant de création (userId unique).

---

## 3. Flux & API existants

### 3.1 API (routes)

| Méthode / Route | Permission | Service | Rôle |
|---|---|---|---|
| `GET /api/admin/companies` | `admin.company.view` | `listCompanies` | Liste (globale : non-supprimées ; société : active uniquement) |
| `POST /api/admin/companies` | `admin.company.create` | `createCompany` | Création (transaction société + branches + séries + membres) |
| `GET/PATCH/DELETE /api/admin/companies/[id]` | `view` / `update` / `delete` | `getCompanyDetail` / `updateCompany` / `softDeleteCompany` | Détail, mise à jour, suppression logique |
| `POST /api/admin/companies/[id]/status` | `admin.company.archive` | `setCompanyStatus` | Changer le statut (archiver/réactiver/suspendre) |
| `POST /api/admin/companies/[id]/restore` | `admin.company.restore` | `restoreCompany` | Restaurer une société supprimée (deletedAt → null) |
| `GET /api/admin/companies/[id]/members…` | `admin.company.membership.manage` | `listMembers`/`addMember`/… | Assignations utilisateurs |
| `GET /api/branches` | `parametres.view` | (scopé société active) | Liste branches de la **société active** |
| `POST/PATCH/DELETE /api/branches` | `parametres.manage` | — | CRUD branches de la **société active** (DELETE → `isActive:false`, siège protégé) |
| `POST /api/session/company` | auth | `switchCompany` | Changer la société active (valide l'adhésion) |
| `GET/PUT /api/settings` | `parametres.view/manage` | `getCompanyProfile`/`updateCompanyProfile` | Profil société **stocké dans la table `Setting`** |

### 3.2 Gardes & isolation

- **`adminGuard(perm)`** (`src/features/company-admin/api.ts`) : construit un `AdminActor`
  à partir du contexte société (permissions effectives).
- **`apiGuardWithContext(perm)`** (`src/features/company/api.ts`) : résout le contexte
  société puis vérifie la permission.
- **`runScoped(context, fn)`** : exécute dans `runWithCompanyContext` (ALS) pour que le
  `companyScopeExtension` filtre par `companyId`.
- **`companyScopeExtension`** : filtre automatiquement les modèles métier (Branch,
  Customer, Product, documents…) par `companyId` du contexte ALS ; **fail-closed** pour
  les modèles stricts ; désactivé dans `runUnscoped`.
- **`softDeleteExtension`** : ajoute `deletedAt: null` aux lectures des modèles
  `SOFT_DELETABLE_MODELS` (dont Company) et transforme `delete`/`deleteMany` en update.
- **Isolation testée côté serveur** : `switchCompany` valide `UserCompany.active` ;
  l'API branches est scopée via `runScoped` + `parametres.manage` ; l'API admin utilise
  `assertCompanyAccess` (un admin société ne touche que sa société active).

### 3.3 Vérification des permissions admin existantes

Catalogue (`permissions.ts`) :
- ✅ `admin.company.view`, `admin.company.create`, `admin.company.update`,
  `admin.company.archive`, `admin.company.delete`, `admin.company.restore`,
  `admin.company.membership.manage`.
- ❌ **Aucune permission `admin.branch.*`** : la gestion des branches passe par
  `parametres.view` / `parametres.manage` (scopées à la **société active**).

---

## 4. Causes racines identifiées (à partir du code)

### 4.1 🔴 Cause racine — « J'ai créé une société, mais la liste / le sélecteur ne la montrent pas »

**Ce n'est PAS un problème de cache ni de revalidation.** Les pages sont
`dynamic = "force-dynamic"` et la résolution du contexte est mise en cache par requête
uniquement (`runWithResolveCache`). La vraie cause est l'**adhésion** :

1. `createCompany` (`service.ts`) ne crée des `UserCompany` que pour
   `input.members`. L'assistant de création (`company-wizard.tsx`) envoie `members: []`
   par défaut → **le créateur n'est jamais membre de la société qu'il vient de créer**.
2. `listCompaniesForUser` (`store.ts`) ne renvoie que les sociétés où l'utilisateur a
   un `UserCompany` actif ET dont `company.isActive === true`. Sans `UserCompany`, la
   société n'apparaît ni dans le `CompanySwitcher` ni nulle part ailleurs côté
   utilisateur connecté.
3. La **page Administration → Sociétés** (`listCompanies`) montre bien la société
   (elle filtre uniquement `deletedAt: null`) pour un super admin — c'est pourquoi le
   problème « liste ne reflète pas » est surtout perçu sur le **sélecteur** et pour les
   utilisateurs non super-admin.

**Conséquence** : après création, le créateur (super admin) doit manuellement aller dans
l'onglet Utilisateurs de la société pour s'assigner. Ce n'est pas documenté → société
« invisible » dans le sélecteur.

### 4.2 🔴 Cause racine — « Pas de bouton Edit / Delete fonctionnel »

- **Edit** : `updateCompany` + route `PATCH /api/admin/companies/[id]` **existent et
  fonctionnent**, mais **aucune UI ne les appelle** :
  - `companies-table.tsx` n'a **pas** de bouton « Modifier » ;
  - `company-detail.tsx` est entièrement **en lecture seule**.
  → le formulaire d'édition n'existe pas.
- **Delete** : le bouton « Supprimer » n'apparaît que lorsque `canDelete && !isActive`
  et utilise `window.confirm`. La suppression logique (`softDeleteCompany`) bloque si
  la société contient des données métier (`COMPANY_HAS_DATA`). Comportement présent mais
  UX brutale (confirm natif du navigateur).
- **Restore (restauration complète)** : `restoreCompany` existe mais **aucun écran ne
  liste les sociétés soft-deleted** (la liste filtre `deletedAt: null`) → une société
  supprimée est **invisible et donc impossible à restaurer** depuis l'UI.

### 4.3 🟠 Duplication de source de vérité — Company (table) vs Setting (clé `company.*`)

- Administration → Sociétés : écrit la table **Company** (système de référence,
  utilisé par le contexte société, le sélecteur, les documents).
- Paramètres → Société (`company-form.tsx` + `config.ts`) : écrit la table **Setting**
  (clés `company.name`, `company.taxId`…).
- Les deux ne sont **jamais synchronisées** : une modification faite dans Paramètres ne
  se reflète ni dans le sélecteur ni dans le contexte ni dans les documents, et
  inversement.

### 4.4 🟠 Gestion des branches — fonctionnelle mais incohérente

- ✅ CRUD branches existe et est **bien scopé** (`runScoped` + `parametres.manage`),
  dans Paramètres → Branches (`branches-manager.tsx`).
- 🟡 L'onglet **Branches** de la fiche société (`company-detail.tsx`) est **en lecture
  seule** : pas de création/édition/désactivation depuis Administration.
- 🟡 La désactivation d'une branche n'a **pas de boîte de confirmation**.
- 🟡 Le siège (`HEADQUARTER`) est protégé côté serveur contre la désactivation, mais
  l'UI ne le signale pas clairement.
- 🟠 L'API `/api/branches` est scopée à la **société active** : il est donc impossible de
  gérer les branches d'une **autre** société que la société active via cet endpoint
  (limitation d'architecture à combler par un sous-ressource admin).

### 4.5 🟡 Divers UX

- `window.confirm` utilisé dans `companies-table.tsx` et `company-wizard.tsx` au lieu du
  composant partagé `ConfirmModal` (`src/components/feedback/modal.tsx`).
- Pas de filtre statut / pas de vue « archivées/supprimées » sur la liste.
- Empty states sans action claire (« créer une société »).
- Après création, la navigation va sur la fiche société mais il n'y a pas de bouton
  « passer à cette société » / « gérer les branches » immédiat.

---

## 5. Tests manuels effectués (conclusion d'audit)

| # | Scénario | Résultat |
|---|---|---|
| 1 | Créer une société via l'assistant | ✅ société créée (table Company) |
| 2 | La société apparaît dans Admin → Sociétés | ✅ (super admin) |
| 3 | La société apparaît dans le **sélecteur** (CompanySwitcher) | 🔴 **Non** — pas de `UserCompany` pour le créateur |
| 4 | Passer à la nouvelle société | 🔴 Impossible (pas d'adhésion) |
| 5 | Modifier une société | 🔴 **Aucune UI** (PATCH existe côté serveur) |
| 6 | Archiver / réactiver (statut) | ✅ fonctionne, mais `window.confirm` |
| 7 | Supprimer (soft-delete) | ✅ bloqué si données ; mais invisible ensuite |
| 8 | Restaurer une société soft-deleted | 🔴 **Aucun écran** ne la liste |
| 9 | Gérer les branches depuis la fiche société | 🔴 Onglet en lecture seule |
| 10 | Désactiver une branche | ✅ mais sans confirmation + société active uniquement |
| 11 | Isolation : société A ne voit pas la B | ✅ (`companyScope` + `switchCompany` valide l'adhésion) |

---

## 6. Plan de correction (respecte l'architecture existante)

> Règle d'or : **réutiliser** `ConfirmModal`, `PageHeader`, `EmptyState`, `DataTable`,
> `CompanySwitcher`, formulaires, toasts, permissions, gardes API, `companyScope`.
> Aucune refonte, aucun parallélisme, aucun changement de schéma non indispensable.

1. **Auto-adhésion du créateur** (`createCompany`) : après création, si l'acteur n'est
   pas dans `input.members`, créer un `UserCompany` actif pour l'acteur (sans
   RoleAssignment — l'acteur étant super admin, le repli `UserRole` lui conserve ses
   permissions globales). → la société apparaît immédiatement dans le sélecteur et est
   accessible.
2. **Écran « Modifier la société »** : page `admin/companies/[id]/edit` (serveur, exige
   `admin.company.update`) + formulaire client `CompanyEditForm` (réutilise `PageHeader`,
   `Input`, `Select`, `Label`, toasts) qui PATCH `/api/admin/companies/[id]`. Bouton
   « Modifier » ajouté dans la table **et** dans l'en-tête de la fiche.
3. **Vue « Archivées / Supprimées » + restauration** : `listCompanies(actor, { includeDeleted })`
   + filtre `?view=archived` sur la page liste ; la vue archive liste les sociétés
   `deletedAt != null` avec un bouton « Restaurer » (→ `/restore`). Boutons remplacés par
   `ConfirmModal`.
4. **Gestion des branches depuis Administration** : sous-ressource
   `/api/admin/companies/[id]/branches` (GET/POST/PATCH/DELETE) avec
   `assertCompanyAccess` + `assertNotArchived` + protection du siège, et page
   `admin/companies/[id]/branches` réutilisant `BranchesManager` (prop `basePath`).
5. **Confirmation pour la désactivation de branche** dans `BranchesManager`
   (`ConfirmModal`), message si siège.
6. **i18n** : nouvelles clés ajoutées dans les blocs `admin` **fr/ar/en** (typage strict).
7. **Améliorations UX table** : bouton « Branches », bouton « Modifier », filtre statut,
   empty-state avec action, badge statut.
8. **Fiche société** : boutons d'en-tête « Modifier » / « Gérer les branches » /
   « Passer à cette société » (si membre).
9. **Paramètres → Société (duplication Setting/Company)** : **documenté** comme limite
   connue dans le rapport final (pas de refonte dans ce périmètre) ; l'éditeur de
   référence devient Administration → Sociétés.

### Hors périmètre (à NE PAS toucher)

Document Engine, Workflow de vente, Phase 8.5/8.6, Comptabilité, Inventory Engine.

### Contrôles de qualité

`npx prisma validate` → `npx tsc --noEmit` → `npm run lint` → `npm run build`.
**Aucun commit.**
