# Phase 5.3 — Adhésions multi-sociétés & autorisation (Company Membership & RBAC)

**Statut :** implémenté — en attente d'approbation avant Phase 5.4.
**Portée :** modèles `Company` / `UserCompany` / `RoleAssignment`, résolution d'autorisation par société (`RoleAssignment → Role → Permission`), repli temporaire `UserRole` journalisé, évaluation des permissions société-aware dans `rbac.ts`, `api-guard.ts`, `helpers.ts` et les modules métier. Aucune modification des modules métier, aucune migration `companyId` (Phase 5.4), aucun CRUD société.

---

## 1. Objectif

Remplacer l'autorisation globale monoposte par une autorisation **par société** :

- **Multi-sociétés** : un utilisateur est membre de plusieurs sociétés (`UserCompany`), chacune avec ses propres attributions de rôles (`RoleAssignment`).
- **Évaluation des permissions** : `User → CompanyContext → UserCompany → RoleAssignment → Role → RolePermission → Permission`. Les permissions d'une requête sont celles de la **société active** uniquement.
- **Compatibilité** : `UserRole` (rôles globaux) reste temporairement comme repli — chaque repli est **journalisé** (audit `FALLBACK` + `console.warn`) pour mesurer la dépendance restante avant suppression.
- **Sécurité** : jamais de confiance dans les valeurs stockées (cookie/session), rejet des adhésions/sociétés/attributions inactives ou expirées.

---

## 2. Changements de schéma (appliqués)

### Modèles `Company`, `UserCompany`, `RoleAssignment`

| Modèle | Champs clés | Contraintes |
| --- | --- | --- |
| `Company` | `code` (unique), `name`, `nameAr`, `currency` (défaut `"DZD"`), `isDefault`, `isActive` | audit timestamps |
| `UserCompany` | `userId`, `companyId`, `active`, `isDefault`, `joinedAt` | **unique `[userId, companyId]`**, FK `Cascade` |
| `RoleAssignment` | `userCompanyId`, `roleId`, `active`, `assignedBy`, `assignedAt`, `expiresAt` | **unique `[userCompanyId, roleId]`**, FK `Cascade` |

### FKs sur la table `Session`

- `Session.activeCompanyId → Company.id` (`onDelete: SetNull`)
- `Session.activeBranchId → Branch.id` (`onDelete: SetNull`)

### `AuditAction`

- Ajout de la valeur `FALLBACK` (journalisation des replis `UserRole`).

### Relations

- `User.userCompanies` / `User.sessions`, `Role.assignments`, `Company.userCompanies`, `UserCompany.roleAssignments`.

**Migration :** `20260803132604_phase53_company_membership` (créée avec `migrate dev --create-only`, **éditée manuellement**, appliquée avec `migrate deploy` — pas de shadow DB sur Neon). Client Prisma régénéré.

### Backfill (bloc `DO $$ … $$` dans la migration)

- Création de la société par défaut unique `MAIN` / « DzERP Algérie » (`isDefault: true`, `isActive: true`, `currency: "DZD"`).
- Création d'une `UserCompany` active (`isDefault: true`) pour chaque utilisateur existant ayant des rôles globaux.
- Attribution de chaque rôle global (`UserRole`) sous forme de `RoleAssignment` actif (expiration nulle).
- Remise à `null` des `Session.activeCompanyId` sentinelles résiduelles.

**État vérifié après application :** 1 société, 3 `UserCompany`, 3 `RoleAssignment`, `Session.activeCompanyId` tous à `null`, 0 session sentinelle restante.

---

## 3. Nouveaux / réécrits fichiers

### `src/features/company/store.ts` — service d'autorisation (nouveau)

| Fonction | Rôle |
| --- | --- |
| `listCompaniesForUser(userId)` | Sociétés accessibles : adhésions actives sur sociétés actives (`isDefault` d'abord, puis `joinedAt`). |
| `listBranchesForCompany(companyId)` | Succursales actives (Phase 5.3 : toutes — le lien société/succursale arrive en 5.4). |
| `getCompanyById(id)` | Détail d'une société. |
| `selectActiveCompanyId(companies, cookieId, sessionId)` | Validation stricte : cookie/session acceptés **seulement** s'ils appartiennent aux sociétés assignées, sinon société `isDefault` → première → `null`. |
| `resolveMembership(userId, companyId)` | Résolution complète de l'autorisation (voir §4). |
| `getLegacyGlobalPermissions` / `logPermissionFallback` | Repli `UserRole` (privés, journalisés). |

Mémoïsation **par requête** (`memo(key, compute)` via `runWithResolveCache`) — jamais de cache partagé entre utilisateurs ni entre requêtes.

### `src/features/company/context.ts`

- Ajout de `runWithResolveCache(fn)` / `getResolveCache()` : cache de résolution `AsyncLocalStorage` limité à la requête courante.

### `src/features/company/types.ts`

- `CompanyRoleRef` : `{ key, name, nameAr, isSystem }`.
- Nouveaux : `RoleAssignmentRef`, `MembershipRef`, `PermissionSource = "RoleAssignment" | "UserRole" | "None"`.
- `CompanyContext` étendu : `membership`, `roleAssignments`, `permissionSource`.

### `src/features/company/resolver.ts`

| Fonction | Changement |
| --- | --- |
| `listAssignedCompanies(userId)` | Délègue à `listCompaniesForUser` (fini le sentinelle `DEFAULT_COMPANY_ID`). |
| `listAssignedBranches(companyId)` | Délègue à `listBranchesForCompany`. |
| `switchCompany(userId, companyId)` | Valide l'adhésion active via `listCompaniesForUser`, persiste session + cookies, ajuste la succursale. |
| `resolveCompanyContext(session)` | Chaîne complète : sociétés → société active (`selectActiveCompanyId`) → `resolveMembership` → branches → succursale → contexte enrichi (`permissions`, `roles`, `membership`, `roleAssignments`, `permissionSource`). Lève `403` si aucune adhésion valide. |
| `getCompanyContextOrResolve()` / `getCurrentCompany()` / `getCurrentBranch()` / `resolveLoginContext(userId)` | Inchangés (API), logs internes basculés sur le store. |

Import `legacy.ts` **supprimé** ; le module `legacy.ts` a été **retiré du dépôt**.

### `src/features/company/helpers.ts`

Tous les helpers lisent le contexte résolu (`getCompanyContextOrResolve`) :

- `getCurrentPermissions()`, `getCurrentCompanyRole()`, `getCurrentMembership()`, `getCurrentRoleAssignments()`
- `hasPermission()`, `hasAnyPermission()`, `hasAllPermissions()`
- `requirePermission()` → `ApiError(403, "Accès refusé.", "FORBIDDEN")`

### `src/features/auth/rbac.ts`

- `getCurrentUser()` : sociétés via `listCompaniesForUser` → `selectActiveCompanyId(cookie, session.activeCompanyId)` → `resolveMembership` → `permissions = resolution?.permissions ?? []`.
- `SessionContext.permissions` reflète donc l'autorisation **société**, plus les rôles globaux bruts.
- `requireUser`, `requirePermission`, `hasPermission(permissions, key)` : signatures inchangées.

### `src/features/auth/api-guard.ts`

Aucune modification requise : il appelle `getCurrentUser()` (maintenant société-aware) et teste `session.permissions.includes(permission)` — comportement automatiquement correct.

### `src/app/(app)/layout.tsx`

- `resolveCompanyContext(session)` et le rendu enfants enveloppés dans `runWithResolveCache(...)` + `runWithCompanyContext(...)`.

### `prisma/seed.ts`

- Nettoyage de `RoleAssignment`, `UserCompany`, `Company` (respect des FK).
- Création de la société `MAIN` (`isDefault: true`) + `UserCompany` + `RoleAssignment` pour chaque utilisateur seedé (mêmes rôles que les `UserRole` historiques).

### `scripts/verify-phase53.ts` + script npm `verify:phase53`

20 vérifications automatisées (8 scénarios), données jetables, exécutées avec `tsx`.

---

## 4. Logique de résolution (`resolveMembership`)

```
resolveMembership(userId, companyId)
  ├─ UserCompany (userId, companyId) ?
  │    ├─ absente / active=false / société inactive ──► null (REJET)
  │    └─ présente et active
  │         ├─ aucun RoleAssignment ──► REPLI UserRole (journalisé : audit FALLBACK + console.warn)
  │         └─ ≥1 RoleAssignment
  │              ├─ filtre actifs et non expirés
  │              ├─ aucun actif ──► 0 permission, source=RoleAssignment (PAS de repli)
  │              └─ actifs ──► union des permissions des rôles (dédupliquée)
  └─ résultat : { membership, company, roleAssignments, permissions, source }
```

Règles de sécurité appliquées :

- **Adhésion inactive** (membre suspendu) → rejet.
- **Société inactive** → rejet (même si l'adhésion est active).
- **Attribution inactive ou expirée** → ses permissions sont ignorées.
- **Adhésion avec attributions mais aucune active** → `0` permission, **pas de repli** (une désactivation délibérée ne doit pas basculer sur les rôles globaux).
- **Aucune attribution du tout** → repli `UserRole` (compat), **journalisé** avec `reason: "LEGACY_USER_ROLE_FALLBACK"`, `companyId`, `source: "UserRole"`, `permissionCount`. `entityId` = userId, `entity` = `"Authorization"`.

---

## 5. Flux d'autorisation (séquence)

```
Requête serveur
  └─ layout.tsx: getCurrentUser()
  │     ├─ cookies + session DB (validation stricte)
  │     ├─ listCompaniesForUser(userId)          (adhésions actives)
  │     ├─ selectActiveCompanyId(cookie, session) (validation vs assignées)
  │     └─ resolveMembership(userId, companyId)   (RoleAssignment / repli UserRole)
  │           └─ permissions: PermissionKey[]
  └─ resolveCompanyContext(session)               (même cache par requête)
        ├─ sociétés → société active → membership → rôles → permissions
        └─ branches → succursale active
  └─ runWithResolveCache(...) → runWithCompanyContext(context, <AppShell/>)
        └─ helpers: getCurrentPermissions() / hasPermission() / requirePermission()
             (lisent l'ALS; sinon re-résolution)
API routes
  └─ apiGuard(permission?) → getCurrentUser() → session.permissions société-aware
```

---

## 6. Sécurité — revue

| Risque | Contre-mesure |
| --- | --- |
| Cookie/session société falsifié | `selectActiveCompanyId` valide contre les sociétés assignées ; toute valeur inconnue est ignorée. |
| Membre suspendu | `UserCompany.active = false` → `resolveMembership` retourne `null` → 403. |
| Société désactivée | `Company.isActive = false` → rejet (et exclusion de `listCompaniesForUser`). |
| Attribution expirée / désactivée | `RoleAssignment.active` + `expiresAt` filtrés avant agrégation. |
| Passage silencieux à l'ancien modèle | Tout repli `UserRole` est journalisé (audit `FALLBACK`) + `console.warn`. |
| Cache croisé entre utilisateurs | Cache de résolution par requête uniquement (`AsyncLocalStorage`), jamais global. |
| Permissions obsolètes dans une requête | Résolution unique par requête, `permissions` recalculées à chaque requête (aucun cache persistant). |

---

## 7. Vérifications effectuées

- `npx tsc --noEmit` — **0 erreur**.
- `npm run lint` — **0 erreur / 0 warning**.
- `npm run build` — compile, 22 routes générées, pages `(app)` dynamiques.
- `npx prisma migrate status` — **database schema is up to date** (11 migrations).
- `npm run db:seed` — seed complet OK (1 société, 3 `UserCompany`, 3 `RoleAssignment`).
- `npm run verify:phase53` — **20 ✓ / 0 ✗** (8 scénarios : liste adhésions, résolution RoleAssignment, repli UserRole journalisé, refus sans attribution active, rejet adhésion/société inactive, validation cookie/session, déduplication, validation d'appartenance).

---

## 8. Reste pour Phase 5.4 (hors périmètre 5.3)

- Migration `companyId` sur les modules métier (ventes, achats, stock, finance, RH) avec `runUnscoped` pour les traitements globaux.
- Lien société/succursale (`Branch.companyId`) — actuellement toutes succursales actives.
- CRUD sociétés / adhésions / attributions de rôles (paramétrage + onboarding).
- Suppression définitive de `UserRole` après vérification que l'audit `FALLBACK` ne remonte plus.
