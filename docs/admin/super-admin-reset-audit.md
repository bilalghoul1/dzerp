# Audit — Reset Contrôlé + Reconstruction Global Super Admin / Company Owner

> **Date** : 2026-08-09 — **Statut** : ÉTAPE 0 (AUDIT) — aucune modification de code ni de base.
> **Règle** : READ-ONLY. Aucune écriture effectuée pendant cet audit.
> **Cible** : SUPER_ADMIN global (rôle `UserRole`, sans `UserCompany`, `activeCompanyId: null`),
> OWNER société unique via `RoleAssignment`, création société+owner atomique, `mustChangePassword`,
> reset propriétaire sécurisé.
> **Livrable** : ce rapport (19 sections, séparant **CURRENT STATE / TARGET STATE / MIGRATION PLAN**)
> puis **STOP en attente d'approbation explicite**.

---

## PARTIE I — CURRENT STATE (état actuel, vérifié READ-ONLY)

---

### 1. Architecture actuelle

- **Auth/session** : cookie `SESSION_COOKIE` signé HMAC-SHA256 → `verifySessionCookie` → session **validée en DB**
  (`revokedAt`, `expiresAt`, `userId`) → utilisateur + permissions recalculées depuis la DB (jamais depuis les cookies).
  `getSecret()` THROW si `SESSION_SECRET` absent ou `"dzerp-insecure-secret"` (`src/features/auth/session.ts`).
- **Rôles globaux** : `UserRole` (`@@id([userId, roleId])`) porte les rôles **hors société**, dont `SUPER_ADMIN`
  (`SUPER_ADMIN_ROLE_KEY = "SUPER_ADMIN"`, `src/features/auth/rbac.ts:15`).
- **Rôles société** : `RoleAssignment` (`@@unique([userCompanyId, roleId])`, `active`, `assignedBy`) porte les rôles
  **scoped** (dont `OWNER`), rattachés à une adhésion `UserCompany`.
- **Multi-société** : extension Prisma `company-scope.ts` filtre/renseigne `companyId` automatiquement
  (`COMPANY_SCOPED_MODELS` = 22 modèles métier, `COMPANY_OPTIONAL_MODELS` = AuditLog/ActivityEvent), sous
  `AsyncLocalStorage` (`context.ts`) via `runWithCompanyContext` / `runUnscoped`.
- **Admin plateforme** : `adminGuard(permission)` → pour un SUPER_ADMIN, acteur `{userId, permissions globales,
  activeCompanyId: null}` ; pour un admin de société, `resolveCompanyContext` + `assertCompanyAccess`
  (limité à sa société active). Routes métier → `apiGuardWithContext` **fail-closed** (403 « Aucune société
  accessible. » pour un SA sans société — comportement voulu).
- **Shell UI** : `src/app/(app)/layout.tsx` → si `isSuperAdmin && assigned.length === 0` : `AppShell context={null}`
  (profil « Plateforme », pas de CompanySwitcher/BranchSelector/CompanyProvider). Sinon contexte société.
- **Premier login / changement forcé** : `User.mustChangePassword` → la page login affiche le formulaire de
  changement tant que non changé ; la route `change-password` vérifie l'ancien MDP, révoque les autres sessions,
  passe `mustChangePassword=false`.

### 2. État réel de la base de données (inventaire READ-ONLY)

- **Host** : Neon `ep-solitary-flower-zaut5l1x-pooler.c-2.eu-west-2.aws.neon.tech`, DB `neondb`.
- **Drift** : `prisma migrate diff --from-config-datasource --to-schema ...` → « This is an empty migration. »
  → **zéro drift DB ↔ schéma**. `migrate status` → « Database schema is up to date! » (18 migrations appliquées).

| Entité | Nombre | Détail |
|---|---|---|
| `User` | 4 | `admin`, `directeur.oran`, `lecteur`, `superadmin` |
| `Company` | 2 | `MAIN` « DzERP Algérie » **ACTIVE/isDefault** ; `DZERP` « DzERP » **ARCHIVED** |
| `Branch` | 5 | HQ MAIN « Siège Social - Alger », HQ DZERP « Main Branch » + 3 |
| `UserCompany` | 4 | `admin`→MAIN+DZERP, `directeur.oran`→MAIN, `lecteur`→MAIN |
| `Role` | 6 | ADMIN, MANAGER, READER, COMPANY_ADMIN, SUPER_ADMIN, OWNER |
| `RoleAssignment` | 4 | OWNER sur `admin`(DZERP) + rôles seed sur MAIN |
| `UserRole` | 4 | dont SUPER_ADMIN→`superadmin` (hors société, conforme) |
| `Permission` | 86 | catalogue complet `module.resource.action` |
| `RolePermission` | 214 | liaisons |
| `Session` | 6 | une par user, contexte société actif ; `admin` dernier login 2026-08-08 |
| `CompanyDraft` | 0 | — |
| `Settings` | 13 | — |
| Métier | — | invoices/quotations/salesOrders/deliveryNotes/creditNotes/PR/PO/goodsReceipts/supplierInvoices = **0** ; customers 5, suppliers 3, products 5, categories 6, brands 4, manufacturers 2, warehouses 2, inventoryMovements 7, documentSeries 14, documentApprovals 0, fileAssets 0, auditLogs 10, activityEvents 2, counters 4 |

- **SUPER_ADMIN en base** : `superadmin` — ACTIVE, `mustChangePassword=false`, **0 `UserCompany`** ✅ conforme au design
  (mais MDP connu en dev → à faire tourner avant prod, voir §11/E).
- **OWNER en base** : `admin` (membre MAIN + DZERP) ; la société démo `DZERP` est **ARCHIVED**.

### 3. Implémentation Super Admin existante (code réel, arbre de travail)

| Fichier | Rôle | Class. |
|---|---|---|
| `src/features/auth/rbac.ts` | `SUPER_ADMIN_ROLE_KEY`, `getCurrentUser` (session DB validée, `isSuperAdmin` via `user.roles`), `requireSuperAdmin`, fusion permissions globales | **A** |
| `src/features/auth/session.ts` | cookie HMAC, `createSession`, `getSessionActiveContext`, `updateSessionContext`, `verifySessionCookie`, `getSecret()` strict | **A** |
| `src/features/auth/api-guard.ts` | `apiGuard(permission)` → 401/403 JSON | **A** |
| `src/features/auth/password.ts` | `hashPassword`/`verifyPassword` bcryptjs **12 rounds** | **A** |
| `src/features/auth/permissions.ts` | catalogue 86 permissions (`admin.company.*` inclus) | **A** |
| `src/features/company/store.ts` | `listCompaniesForUser`, `listGlobalPermissions`, `selectActiveCompanyId`, `resolveMembership` | **A** |
| `src/features/company/resolver.ts` | cookies `COMPANY_COOKIE`/`BRANCH_COOKIE` → contexte société | **A** |
| `src/features/company/api.ts` | `apiGuardWithContext` (fail-closed) | **A** |
| `src/features/company/context.ts` / `unscoped.ts` | AsyncLocalStorage, `runWithCompanyContext`, `runUnscoped` | **A** |
| `src/lib/db/company-scope.ts` | extension scoping `companyId` (22 modèles strict) | **A** |
| `src/lib/db/soft-delete.ts` | extension soft-delete (Client/Customer/Supplier/Product/Warehouse/Company) | **A** |
| `src/features/company-admin/api.ts` | `adminGuard`, `getAdminActor`, `requestMeta` (SA → `activeCompanyId: null`) | **A** |
| `src/features/company-admin/service.ts` | `createCompany` (atomique), `resetOwnerPassword`, `isGlobalAdmin`, `assertCompanyAccess`, lifecycle société | **A** |
| `src/features/company-admin/schemas.ts` / `defaults.ts` / `types.ts` | validation, `DEFAULT_SERIES`, `DEFAULT_HEADQUARTER_BRANCH`, types acteur | **A** |
| `src/app/(app)/layout.tsx` | bifurcation « plateforme » (context=null pour SA) | **A** |
| `src/components/shell/app-shell.tsx` | shell tolérant `context=null`, badge « Plateforme » | **A** |
| `src/app/login/page.tsx` | formulaire de changement forcé au 1er login | **A** |
| `src/components/admin/*` | wizard (étape Propriétaire), companies-table (colonne owner), company-detail (reset MDP) | **A** |
| Scripts `bootstrap-super-admin.ts`, `verify-super-admin.ts` | idempotents, non destructifs | **A** |

### 4. Implémentation Company Owner existante

- **OWNER = rôle société** : `OWNER_ROLE_KEY = "OWNER"` (`service.ts:29`), attribué par `RoleAssignment` sur une
  `UserCompany` unique (`isDefault: true`), `@@unique([userId, companyId])`.
- **Création atomique** : `createCompany` (`service.ts:465`) → **un seul `$transaction`** : Company + Branches +
  DocumentSeries + User(owner, `mustChangePassword:true`, hash bcrypt) + UserCompany + RoleAssignment(OWNER).
  Le mot de passe temporaire est retourné **une seule fois** dans `CompanyCreateResult.owner.temporaryPassword`,
  jamais relisible en base.
- **Reset sécurisé** : `resetOwnerPassword` (`service.ts:1235`) — réservé SA (`assertGlobalAdmin`), force
  `mustChangePassword=true`, écrit un nouveau hash (l'ancien devient invalide), **ne révèle jamais l'ancien MDP**,
  journalise (audit + activité).
- **Garde anti-escalade** : `assertAssignableRole` — un acteur ne peut attribuer qu'un rôle dont les permissions
  sont un **sous-ensemble** des siennes (un non-SA ne peut jamais octroyer ADMIN global).
- **Périmètre** : `assertCompanyAccess` — admin de société limité à `activeCompanyId` ; SA (permissions
  `admin.company.{create,archive,delete,restore}`) gère toutes les sociétés via `runUnscoped`.
- **Suppression** : `softDeleteCompany` refuse si données métier présentes, protège la société `isDefault`
  (jamais de hard DELETE).

### 5. Modèles Prisma liés (schéma `prisma/schema.prisma`, 59 modèles au total)

| Modèle | Rôle | Contraintes clés | Class. |
|---|---|---|---|
| `User` | comptes (SA + Owner + membres) | `username`/`email` uniques, `passwordHash`, `status`, **`mustChangePassword`** | **A** |
| `Role` / `Permission` / `RolePermission` | catalogue rôles/permissions | `key` unique, `isSystem` | **A** |
| `UserRole` | **rôle GLOBAL (SUPER_ADMIN)** | `@@id([userId, roleId])` | **A** |
| `UserCompany` | adhésion société | `@@unique([userId, companyId])`, `isDefault`, `active`, `defaultBranchId` | **A** |
| `RoleAssignment` | rôle société (OWNER…) | `@@unique([userCompanyId, roleId])`, `active`, `assignedBy`, `expiresAt` | **A** |
| `Company` | sociétés | `code` unique, `status`, `isActive`, `isDefault`, `defaultBranchId`, `deletedAt/deletedById` | **A** |
| `Branch` | succursales | `companyId`, `code` | **A** |
| `Session` | sessions + contexte | `activeCompanyId`, `activeBranchId`, `revokedAt` | **A** |
| `CompanyDraft` | brouillons assistant | `userId` unique | **A** |
| `AuditLog` / `ActivityEvent` | journalisation | `companyId` **nullable** (événements globaux) | **A** |
| `Counter` / `DocumentSeries` | numérotation documents | scoped `companyId` | **A/D** |

**Rien à supprimer.** `UserRole` reste le porteur global du SA ; `RoleAssignment` reste le porteur société (OWNER).
Les deux coexistent sans conflit (complémentarité global vs société).

### 6. Routes / API existantes

| Méthode | Route | Fonction | Class. |
|---|---|---|---|
| POST | `/api/auth/login` | login + rate limit 10/min IP+username + dummy hash anti-timing + `mustChangePassword` | **A** |
| POST | `/api/auth/logout` | révocation session | **A** |
| POST | `/api/auth/change-password` | change forcé → `mustChangePassword=false`, révocation autres sessions | **A** |
| GET | `/api/auth/sessions` | liste sessions | **A** |
| GET | `/api/current-user` | session + `isSuperAdmin` + permissions fusionnées | **A** |
| GET/POST | `/api/admin/companies` | `listCompanies` / `createCompany` (SA atomique) | **A** |
| GET/PATCH | `/api/admin/companies/[companyId]` | détail / update | **A** |
| POST | `/api/admin/companies/[companyId]/status` | `setCompanyStatus` | **A** |
| POST | `/api/admin/companies/[companyId]/restore` | `restoreCompany` | **A** |
| DELETE | `/api/admin/companies/[companyId]` | `softDeleteCompany` | **A** |
| GET | `/api/admin/companies/[companyId]/statistics` | stats société | **A** |
| **POST** | **`/api/admin/companies/[companyId]/owner/reset`** | **`resetOwnerPassword`** | **A (untracked)** |
| GET/POST | `/api/admin/companies/[companyId]/members` + `[userCompanyId]` | gestion membres | **A** |
| GET | `/api/admin/companies/[companyId]/audit` / `activity` | journaux | **A** |

### 7. Services existants

- `src/features/company-admin/service.ts` (1540 l.) : `listCompanies`, `getCompanyDetail`, `createCompany`,
  `updateCompany`, `setCompanyStatus`, `archiveCompany`, `restoreCompany`, `softDeleteCompany`, `listMembers`,
  `addMember`, `updateMember`, `removeMember`, `resetOwnerPassword`, `getStatistics`, `listCompanyAudit`,
  `listCompanyActivity`, `saveDraft`/`getDraft`/`clearDraft`, `listCompanyBranches`, `listCompanySeries`,
  `listAssignableUsers`, `listAssignableRoles`.
- Gards : `isGlobalAdmin`, `assertGlobalAdmin`, `assertCompanyAccess`, `assertNotArchived`, `assertAssignableRole`.
- **Tous les accès passent par `runUnscoped`** (les modèles métier ne doivent pas être filtrés par le contexte de l'acteur).

### 8. UI existante

| Fichier | Rôle | Class. |
|---|---|---|
| `src/app/(app)/admin/page.tsx` | redirect → `/admin/companies` | **A** |
| `src/app/(app)/admin/layout.tsx` | `requirePermission("admin.company.view")` + `AdminTabs` | **A** |
| `src/app/(app)/admin/companies/page.tsx` | `getAdminActor` → `listCompanies` → `CompaniesTable` (200 pour SA) | **A** |
| `src/app/(app)/admin/companies/[companyId]/page.tsx` | détail société | **A** |
| `src/app/(app)/admin/companies/nouveau/page.tsx` | wizard de création (étape Propriétaire) | **A** |
| `src/components/admin/company-wizard.tsx` | carte Propriétaire (création owner) | **A** |
| `src/components/admin/companies-table.tsx` | colonne owner (nom + @username), CSV | **A** |
| `src/components/admin/company-detail.tsx` | carte Propriétaire + « Réinitialiser le mot de passe » | **A** |
| `src/components/admin/admin-tabs.tsx` | onglets admin | **A** |
| `src/app/(app)/page.tsx` | **GAP 5.1** : `/` → `redirect("/login")` pour SA sans contexte | **E** |
| `src/i18n/dictionaries.ts` | clés `header.platform`, owner/reset | **A** |

### 9. Migrations

| Migration | Contenu lié | Statut |
|---|---|---|
| `20260802153748_foundation` | User, Role, UserRole, Permission, RolePermission, Company, Session | appliquée |
| `20260803125717_add_session_company_context` | Session.activeCompanyId/activeBranchId | appliquée |
| `20260803132604_phase53_company_membership` | UserCompany, RoleAssignment | appliquée |
| `20260804090000_phase55_company_management` | administration sociétés (permissions, lifecycle) | appliquée |
| `20260808000000_add_must_change_password` | `User.mustChangePassword` | ⚠️ **appliquée en base mais UNTRACKED (non commitée)** |

- **18 migrations appliquées**, zéro drift. ⚠️ Priorité n°1 : commiter schema + migration + seed ensemble.

---

## PARTIE II — CLASSIFICATION A / B / C / D / E

> Légende : **A** = code réel existant à conserver · **B** = base de données réelle (source de vérité) à conserver ·
> **C** = héritage (artefacts/docs/états issus des phases antérieures) · **D** = à conserver impérativement pour ne
> **pas casser DzERP** · **E** = à rebâtir / à créer.

| Élément | Class. | Justification |
|---|---|---|
| Auth/session/RBAC/guards/password (A) | **A** | Implémentation SA fonctionnelle, vérifiée |
| Company context/scoping/soft-delete (A) | **D/A** | Isolation multi-société = fondation DzERP ; **ne pas réécrire** |
| `company-admin` api/service/schemas/defaults | **A** | SA + Owner atomique, reset sécurisé |
| Modèles `User`/`Role`/`UserRole`/`UserCompany`/`RoleAssignment`/`Session`/`Company` | **A** | Conformes à la cible |
| Société `MAIN` + données métier (customers/suppliers/products/warehouses/movements/series/settings/audit) | **B** | Données réelles à ne **jamais** toucher |
| Société `DZERP` (ARCHIVED) + adhésions `admin` | **B** | À conserver ; décision archive/restaure en E |
| Comptes `directeur.oran`, `lecteur` | **B** | Membres MAIN réels |
| Compte `superadmin` (`mustChangePassword=false`, MDP connu en dev) | **C** | État démo → à faire tourner avant prod (E) |
| Compte `admin` (OWNER DZERP + ADMIN MAIN, `admin123`) | ~~C~~ **RÉSOLU** | Supprimé définitivement de la plateforme (sessions, rôles, adhésions purgés ; acteur `AuditLog`/`ActivityEvent` mis à `NULL` — historique conservé) |
| `scripts/ensure-demo-super-admin.ts` (MDP en clair, `mustChangePassword=false`) | **C** | Dev-only, à supprimer/verrouiller avant prod |
| `prisma/seed.ts` (deleteMany massif en tête) | **C** | **Destructeur — ne JAMAIS exécuter sans approbation (RULE 1)** |
| Docs legacy (`super-admin-implementation`, `pre-audit`, `runtime-audit`, `debug/*`, `MASTER_PROJECT_AUDIT`, `SOURCE_OF_TRUTH`) | **C** | Référence historique, à archiver/fusionner |
| Business Engine (Documents, PDF, Sales, CRM, Products, Inventory, Accounting, i18n/RTL, TVA, numbering) | **D** | RULE 10 — intouchable |
| `Counter` / `DocumentSeries` / numérotation | **D** | Intégrité facturation |
| GAP 5.1 : landing `/` SA → `/login` | **E** | À corriger → `/admin/companies` |
| GAP 5.2 : non-SA sans société → 500 | **E** | À corriger (redirect gracieux) |
| Dashboard admin global `/admin` | **E** | À créer (léger) |
| Liste des Owners + état `mustChangePassword` | **E** | À exposer côté SA |
| Migration `20260808000000` (untracked) | **E** | À committer (opération git, pas de SQL) |

---

## PARTIE III — ANALYSE

### 10. Ce qui doit être CONSERVÉ (obligatoire)

1. **Tout l'arbre de travail SA** (classes A ci-dessus) : rbac, session, guards, password, permissions,
   company store/resolver/context/unscoped, company-scope, soft-delete, company-admin (api/service/schemas/defaults/types),
   layout « plateforme », AppShell, login (change forcé), wizard/table/detail, reset route, i18n.
2. **Migration `20260808000000`** (déjà appliquée → ne pas la retirer, la **committer**).
3. **Le modèle global** : `SUPER_ADMIN` via `UserRole` (hors société), `isSuperAdmin`, `adminGuard`,
   `requireSuperAdmin`, `getAdminActor` avec `activeCompanyId: null`.
4. **La création transactionnelle** société + Owner et `resetOwnerPassword` (forçage `mustChangePassword`,
   jamais d'affichage de l'ancien MDP).
5. **L'isolation multi-société** : `companyScopeExtension`, `runWithCompanyContext`/`runUnscoped`,
   `assertCompanyAccess`, `apiGuardWithContext` — **ne pas réécrire**.
6. **Scripts** `bootstrap-super-admin.ts` / `verify-super-admin.ts` (idempotents, non destructifs).
7. **Le cycle de vie société** : `setCompanyStatus`/`archiveCompany`/`restoreCompany`/`softDeleteCompany`
   (pas de hard DELETE ; refus si données métier).
8. **Données réelles B** : société MAIN + toutes données métier + comptes membres.
9. **Business Engine** (RULE 10) — **intouchable**.

### 11. Ce qui peut être SUPPRIMÉ / RETRAITÉ (limité)

| Élément | Décision | Class. |
|---|---|---|
| `ensure-demo-super-admin.ts` | Dev-only (MDP en clair). À verrouiller/supprimer avant prod. **Pas de suppression de code de prod.** | **C** |
| État du compte `superadmin` (MDP connu en dev) | Rotation MDP + `mustChangePassword=true` avant prod | **C/E** |
| Compte seed `admin` (`admin123`) | **RÉSOLU** — compte supprimé définitivement ; le seed ne le recrée plus | **C** |
| Société `DZERP` (ARCHIVED) | Décision : restaurer (`restoreCompany`) ou laisser archivée | **B/E** |
| `prisma/seed.ts` destructeur | **Interdit d'exécuter** ; à réécrire en upsert non destructif si nécessaire | **C** |
| GAP 5.1 / GAP 5.2 | Corriger le code (E), ne pas supprimer de fichiers | **E** |

**Aucun fichier de l'implémentation SA ne doit être supprimé.** Le « reset contrôlé » = **consolidation +
finitions**, **PAS** une suppression.

### 12. Ce qui doit être REBÂTI (niveau SA uniquement)

1. **Landing post-login SUPER_ADMIN** : `/` → `/admin/companies` (jamais `/login`) — GAP 5.1.
2. **Dashboard admin global `/admin`** : compteurs (sociétés, actives, archivées, owners, membres) + liens rapides.
3. **Vue liste des Owners** + état `mustChangePassword` (déjà disponible via `findCompanyOwner`).
4. **GAP 5.2** : redirect gracieux pour non-SA sans société (fail-closed, jamais de 500).
5. **Seed non destructif** (upsert) si une réinitialisation du catalogue est un jour nécessaire — jamais de deleteMany.
6. (Hors périmètre SA) permissions `documents.*` des rôles seedés — signalé, non traité ici.

### 13. Vérifications de sécurité (ÉTAPE 5 — les 10 points)

| # | Vérification | Résultat | Preuve |
|---|---|---|---|
| 1 | Isolation OWNER A ↛ B (lecture) | ✅ OK | `company-scope.ts` filtre `companyId` ; test : client de B invisible sous contexte A |
| 2 | Isolation OWNER A ↛ B (écriture/création) | ✅ OK | création sans `companyId` → renseignée avec la société du contexte |
| 3 | Isolation OWNER A ↛ B (services) | ✅ OK | `assertCompanyAccess` : `listMembers(ownerActor, B)` → 403 |
| 4 | SA gère A et B **sans** `UserCompany` | ✅ OK | `isGlobalAdmin` + `runUnscoped` ; SA conserve 0 adhésion après opérations |
| 5 | `activeCompanyId: null` ne casse pas les opérations globales SA | ✅ OK | `adminGuard`/`getAdminActor` → `activeCompanyId:null` ; `/admin/companies` 200 |
| 6 | Les sessions ne contournent pas l'isolation | ✅ OK | `getCurrentUser` valide la session en DB (revokedAt/expiresAt/userId) ; permissions recalculées depuis la DB |
| 7 | Reset MDP ne révèle jamais l'ancien | ✅ OK | `resetOwnerPassword` écrit un nouveau hash + `mustChangePassword=true` ; ancien invalide ; réponse sans MDP |
| 8 | MDP toujours bcrypt (12 rounds) | ✅ OK | `src/features/auth/password.ts` ; login avec dummy hash anti-timing |
| 9 | Création Company+OWNER atomique | ✅ OK | `createCompany` = un seul `$transaction` |
| 10 | Anti-escalade de privilèges | ✅ OK | `assertAssignableRole` : sous-ensemble de permissions ; rate limit login 10/min |

### 14. Risques base de données

| Risque | Niveau | Mesure |
|---|---|---|
| Migration `20260808000000` untracked → dérive si clone sans elle | **ÉLEVÉ** | Commiter schema + migration + seed immédiatement (1er pas du plan) |
| `migrate reset` / `db push --force-reset` / `DROP` / `TRUNCATE` / `CASCADE` | **ÉLEVÉ** | **INTERDIT** (RULE 1). Base = source de vérité partagée |
| `prisma/seed.ts` (deleteMany en tête) | **ÉLEVÉ** | Ne jamais exécuter sans approbation explicite |
| Réécriture de l'isolation (scoping/context) | **ÉLEVÉ** | Ne pas toucher `company-scope.ts`, `context.ts`, `resolver.ts` |
| Doc/PDF/Business Engine | **ÉLEVÉ** | Hors périmètre (RULE 10) ; toute dépendance détectée → signalée dans ce rapport |
| Session partagée entre 2 machines | **MOYEN** | Ne pas tourner les deux machines en même temps sans synchronisation ; vérifier `SESSION_SECRET` commun |
| Comptes prévisibles (`admin123`, MDP demo SA) | **RÉSOLU** — `admin`/`admin123` supprimé ; rotation MDP du compte demo SA reste à faire avant prod | **MOYEN** |
| `apiGuardWithContext` fail-closed pour SA sur routes métier | **FAIBLE** | Comportement voulu (SA n'accède pas aux routes métier) |

---

## PARTIE IV — TARGET STATE (architecture cible)

### 15. Architecture cible

- **SUPER_ADMIN = rôle global** (`UserRole`, `SUPER_ADMIN`) : **hors société** (`UserCompany` absent,
  `activeCompanyId: null`). Crée/modifie/archive/restore/désactive les sociétés, crée les Owners,
  **reset MDP Owner**. Permissions globales `admin.*` fusionnées (`listGlobalPermissions`).
  Accès : `requireSuperAdmin` (pages), `adminGuard` (API), acteur `{userId, permissions, activeCompanyId:null}`.
- **OWNER = rôle société** (`RoleAssignment(OWNER)` sur `UserCompany` unique, `isDefault:true`) : gère
  **uniquement les users/branches/données de SA société** (scoping `companyId` + `assertCompanyAccess`).
- **Création société + Owner atomique** (`createCompany`, un `$transaction`) ; temp password retourné une fois,
  `mustChangePassword:true`, hash bcrypt 12.
- **Cycle de vie** : ACTIVE/ARCHIVED (lecture seule), soft-delete refusé si données métier, restauration.
- **Premier login forcé** : `mustChangePassword` → formulaire login → `change-password` (vérifie l'ancien,
  révoque les autres sessions, passe à `false`).
- **Reset MDP Owner** : réservé SA, force `mustChangePassword`, jamais d'exposition de l'ancien MDP.
- **UI** : `/` SA → `/admin/companies` ; `/admin` = dashboard global ; shell « Plateforme » (`context=null`).
- **Règles conservées** : RULE 2-13, RULE 10 (Business Engine intact), pas de suppression de données.

---

## PARTIE V — MIGRATION PLAN (plan d'exécution proposé — NON exécuté)

> Toute étape de ce plan n'est qu'une **proposition** tant que vous n'avez pas donné l'approbation explicite.

### 16. Plan d'implémentation (après approbation)

1. **Committer l'état actuel** : schema + migration `20260808000000` + seed + scripts + code SA + ce rapport
   (opération `git` uniquement, **aucun SQL**). Stabilise la référence pour l'autre machine.
2. **Corriger GAP 5.1** : dans `src/app/(app)/page.tsx`, si `isSuperAdmin && !context` → `redirect("/admin/companies")`.
3. **Corriger GAP 5.2** : dans `src/app/(app)/layout.tsx`, gérer le cas utilisateur authentifié sans société
   non-SA → redirect `/login` (fail-closed, jamais de 500).
4. **Dashboard admin `/admin`** : page légère avec compteurs (sociétés/actives/archivées/owners/membres) + liens.
5. **Vue Owners** (optionnel) : liste des owners + état `mustChangePassword`.
6. **Prod prep** (hors périmètre SA, à valider) : rotation MDP `superadmin` + `admin`, `mustChangePassword=true`,
   décision sur `DZERP`, verrouillage `ensure-demo-super-admin.ts`.

### 17. Plan de migration de données

- **Aucune opération destructive**. La base est déjà conforme (zéro drift, SA existant, 0 métier hors MAIN).
- Opérations **additives/ponctuelles uniquement** (toutes approuvées une par une) :
  1. commiter l'état (référence partagée) ;
  2. correctifs GAP 5.1 / 5.2 + dashboard (code seul) ;
  3. rotation MDP `superadmin`/`admin` (via `resetOwnerPassword` ou script idempotent) ;
  4. décision `DZERP` (restore ou laisser archivée).
- Aucune table métier n'est modifiée. `Counter`/`DocumentSeries`/numérotation inchangés.

### 18. Plan de vérification

1. `npx prisma validate` et `npx prisma generate` → zéro erreur.
2. `npx prisma migrate status` → « up to date » (18 migrations).
3. `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` → « empty migration ».
4. `npx tsc --noEmit` puis lint puis `npm run build`.
5. `npx tsx scripts/verify-super-admin.ts` → **27/27 PASS** (matrice non destructive, nettoie ses propres données).
6. Tests HTTP ciblés : login `superadmin` → mustChangePassword forcé → change → `/` → `/admin/companies` (200) ;
   Owner A → 0 donnée B ; SA → crée société+owner, reset MDP ; admin société → 403 hors périmètre.

### 19. Stratégie de rollback

- **Code** : `git` — le plan est un ensemble de petits commits (1 par étape) ; rollback = revert du commit concerné.
  Aucune migration destructive → aucun rollback SQL nécessaire.
- **Base** : toutes les écritures proposées sont réversibles (ajout de champ déjà fait ; rotation de MDP réversible
  via `resetOwnerPassword` ; restore/archive réversible via `restoreCompany`/`setCompanyStatus`).
- **Sauvegarde préalable recommandée** : `pg_dump` du schéma `neondb` avant toute opération d'écriture (optionnel,
  à valider avec vous).
- **Point de non-retour** : uniquement si une opération destructive était un jour demandée → **STOP** (RULE 1).

---

## Verdict

Le « reset contrôlé » est en réalité une **consolidation + finitions** : la reconstruction Global Super Admin /
Company Owner est **déjà implémentée et vérifiée** dans l'arbre de travail (27/27 PASS, zéro drift, sécurité
conforme aux 10 points). Il ne reste que des correctifs ciblés (GAP 5.1 / GAP 5.2), un dashboard admin global
et des décisions de prod (rotation MDP, sort de DZERP). **Aucune opération destructive n'est requise ni permise.**

---

## STOP — En attente d'approbation explicite

Aucun fichier de code ni aucune donnée n'ont été modifiés pendant cet audit. Veuillez approuver explicitement
avant toute écriture. Prochaines actions proposées (Phase 1) :

1. Commiter l'arbre de travail (schema + migration `20260808000000` + seed + scripts + code SA).
2. Corriger GAP 5.1 (landing SA) et GAP 5.2 (non-SA sans société).
3. Ajouter le dashboard `/admin` + décision `superadmin`/`DZERP`.
4. Vérifier : validate / generate / migrate status / tsc / lint / build / verify-super-admin.
5. **Aucun `git commit` ni push sauf instruction explicite.**
