# Rapport final — Suppression du compte legacy `admin` & consolidation Super Admin

Date d'exécution : **2026-08-09**
Base : branche `main`, **aucun commit / aucun push** (conformément au brief).

---

## 1. Objectif

- Supprimer définitivement le compte legacy `admin` / `admin123` (id `23e03ffc-dd66-4389-9512-1cb48e7888dc`).
- Garantir que `superadmin` est l'**unique** administrateur de plateforme (rôle global `SUPER_ADMIN`), hors de toute société.
- Durcir les gardes (layout `/admin`, rôles assignables, `AdminActor.isSuperAdmin`), purger le seed de tout compte `admin`,
  dédoublonner les CTA « Nouvelle société », gate les actions rapides par permission, ajouter le pré-remplissage `?customerId=`.
- Valider l'ensemble (Prisma, tsc, lint, build) et fournir ce rapport. Aucun reset de base, aucune migration.

## 2. État initial (post-suppression `admin`, mesuré en début de session)

- `admin` (username) : **absent** ; `admin` (id `23e03ffc-…`): UserRole/UserCompany/Session = 0.
- `superadmin` : seul porteur `SUPER_ADMIN`, `ACTIVE`, 0 adhésion société.
- Business data préservée : Company=3, customers=5, suppliers=3, products=5, warehouses=2.
- Historique préservé : 43 références acteur `admin` mises à NULL dans AuditLog/ActivityEvent (aucune suppression).

## 3. Suppression du compte `admin` — vérification (avant / après)

| Élément | Avant suppression | Après suppression | Vérifié |
|---|---|---|---|
| User `admin` (username) | 1 | 0 | `verify:admin-removal` ✓ |
| UserRole `userId=admin` | 1 | 0 | ✓ |
| UserCompany `userId=admin` | 2 | 0 | ✓ |
| Session `userId=admin` | 36 | 0 | ✓ |
| RoleAssignment `assignedBy=admin` | 2 | 0 | ✓ |
| AuditLog acteur = `admin` | 41 | 0 (mis à NULL, lignes conservées) | ✓ |
| ActivityEvent acteur = `admin` | 2 | 0 (mis à NULL, lignes conservées) | ✓ |
| Rôle global `ADMIN` assigné à une société | 1 (l'ancienne adhésion) | 0 | ✓ |
| Porteurs du rôle global `SUPER_ADMIN` | 1 (`superadmin`, ACTIVE) | 1 | ✓ |

## 4. État final de la base (compteurs réels, `scripts/verify-admin-removal.ts`)

```
User=5  UserRole=3  RoleAssignment=4  UserCompany=5  Session=4
Company=3  Branch=6  Customer=5  Supplier=3  Client=0
Product=5  ProductCategory=6  Brand=4  Manufacturer=2  Unit=3  VatCategory=3
Warehouse=2  WarehouseLocation=0  InventoryMovement=7  DocumentSeries=28
AuditLog=47  ActivityEvent=5  Setting=13  CompanyDraft=0
```

Comptes actifs : `superadmin` (SUPER_ADMIN, hors société), `dzerp.owner` (OWNER @ DzERP),
`directeur.oran` (MANAGER @ MAIN), `lecteur` (READER @ MAIN + COMPANY_ADMIN @ DIF), `Allaoua_difallah` (adhésion @ DIF).
Sociétés actives : `MAIN` (DzERP Algérie), `DIF` (Ascram), `DZERP` (démo).
Aucune société de test restante (`VERA`/`VERB` purgées, y compris leurs lignes soft-deleted).

> Note `DocumentSeries` : la valeur historique 56 incluait 28 séries rattachées aux sociétés de test
> (soft-deleted). Après purge, le compte réel des séries des sociétés actives est 28.

## 5. Incident détecté et corrigé pendant la session

**Bug** : le script `scripts/verify-super-admin.ts` supprimait **inconditionnellement** le rôle
`SUPER_ADMIN`/`OWNER` dans son nettoyage (`role.deleteMany`). Comme `upsert` réutilise le rôle
préexistant d'une base réelle, une exécution détruisait le rôle GLOBAL de plateforme (et, par
cascade, la liaison `superadmin` → `SUPER_ADMIN`) → l'administration de plateforme tombait en panne
et `createCompany` échouait (`MISSING_OWNER_ROLE`).

**Correction** :
- `verify-super-admin.ts` : le nettoyage ne supprime QUE les rôles / permissions / comptes que le
  script a lui-même **créés** (`saRoleCreated`, `ownerRoleCreated`, `saUserCreated`) ; suppressions
  via `prismaBase` (hard delete, aucune résidu de suppression logique).
- **Nouveau** `scripts/restore-super-admin.ts` (`npm run db:restore:super`) : réconciliation
  IDEMPOTENTE et sans reset — recrée `SUPER_ADMIN` + permissions `admin.*`, recrée `OWNER` +
  permissions, rattache `superadmin` au rôle, recrée la démo `DzERP`/`dzerp.owner`, purge les
  résidus de tests `VERA`/`VERB`.
- DB restaurée puis vérifiée : `superadmin` de nouveau seul porteur `SUPER_ADMIN` (ACTIVE).

## 6. Gardes / RBAC — fichiers modifiés

- `src/features/company-admin/service.ts` : `isGlobalAdmin` ne teste plus que `actor.isSuperAdmin` ;
  `assertAssignableRole` refuse les rôles globaux `ADMIN`/`SUPER_ADMIN` ; `createCompany` valide
  chaque `members[].roleId` AVANT la transaction ; `listAssignableRoles` exclut `ADMIN`/`SUPER_ADMIN`.
- `src/features/company-admin/api.ts` + `types.ts` : `AdminActor.isSuperAdmin` requis et toujours
  renseigné par `adminGuard`/`getAdminActor` (vrai uniquement pour `session.isSuperAdmin`).
- `src/features/auth/rbac.ts` : `isSuperAdmin` dérivé du rôle global ; `requireSuperAdmin()` en garde.
- `src/app/(app)/admin/layout.tsx` : garde `requireSuperAdmin()` (remplace l'ancien `requirePermission`).
- `src/app/(app)/admin/companies/page.tsx` : `listCompanies({ … isSuperAdmin })`.

## 7. Seed — `prisma/seed.ts`

- Bloc `admin`/`admin123` supprimé ; démo uniquement `directeur.oran` / `lecteur` / `dzerp.owner`
  (mot de passe `DzERP-Demo-2026`), sans rôle global.
- Société démo `DZERP` + `dzerp.owner` (OWNER par `RoleAssignment`, session → DzERP/Main Branch).
- Résumé final oriente vers `db:bootstrap:super` pour le Super Admin.
- Rappel : le seed reste **destructif** (purge toutes les données) — il n'a PAS été exécuté.

## 8. Shell / UI

- `app-shell.tsx` : prop `isSuperAdmin` ; sidebar desktop `showQuickCreate={false}` (un seul CTA
  global « Nouveau » dans l'en-tête), drawer mobile inchangé.
- `sidebar.tsx` : entrées `/admin*` visibles uniquement si `isSuperAdmin`.
- `command-palette.tsx` : pages `/admin*` filtrées par `isSuperAdmin` ; `QUICK_ACTIONS` portent une
  `permission` et sont filtrées par les permissions de l'acteur.
- `src/app/(app)/admin/page.tsx` : CTA « Nouvelle société » dédoublonné (une seule carte, un seul lien).
- `src/app/(app)/page.tsx` : « Nouveau devis » du tableau de bord rendu seulement avec
  `ventes.devis.create`.

## 9. Pré-remplissage `?customerId=` (documents)

- `documents/[type]/nouveau/page.tsx` : lit `searchParams.customerId` → `initialCustomerId`.
- `document-editor-page.tsx` : valide l'id client (create mode), le transmet à la coquille.
- `document-editor-shell.tsx` + `document-editor-context.tsx` : seed du `header.partyId` au montage.
- `document-created-banner.tsx` : l'étape suivante (commande/livraison/facture) ajoute
  `?customerId=${detail.partyId}` et n'est rendue que si la permission cible est détenue.
- `crm/customers/[id]/page.tsx` : actions rapides devis/facture/livraison gated + href `?customerId=id`.

## 10. Recherche — `src/features/search/server.ts` + `src/app/api/search/route.ts`

Actions rapides (devis, client, commande, rapports, paramètres) porteuses de `permission` ;
`globalSearch` reçoit `permissions` et filtre. La route API transmet `guard.context.permissions`.

## 11. Portes de qualité (exécutées le 2026-08-09)

| Porte | Résultat |
|---|---|
| `npx prisma validate` | ✓ schéma valide |
| `npx prisma generate` | ✓ client 7.9.1 généré |
| `npx tsc --noEmit` | ✓ 0 erreur |
| `npm run lint` | ✓ 0 erreur (9 warnings préexistants, hors périmètre) |
| `npm run build` | ✓ compilé (26 routes) |

## 12. Scripts de vérification (tous exécutés après correction)

| Script | Résultat |
|---|---|
| `npm run verify:admin-removal` (`scripts/verify-admin-removal.ts`, READ-ONLY) | **13/13** |
| `npx tsx scripts/verify-super-admin.ts` | **27/27** |
| `npm run verify:scope` | **8/8** |
| `npm run verify:phase53` | **20/0** |
| `npx prisma migrate status` | sans objet (aucune migration ajoutée) |

Relançabilité : `verify-super-admin` laisse la base dans un état identique (rôles SYSTEM préservés,
données de test hard-deleted). `verify:admin-removal` est purement en lecture.

## 13. Fichiers

**Créés (cette mission)**
- `scripts/verify-admin-removal.ts` (+ script npm `verify:admin-removal`)
- `scripts/restore-super-admin.ts` (+ script npm `db:restore:super`)
- `scripts/inspect-user.ts` (inspecteur générique ; `scripts/inspect-admin.ts` supprimé)

**Modifiés (cette session : gardes, UI, seed, scripts)**
- `prisma/seed.ts`, `package.json`
- `src/features/company-admin/service.ts`, `api.ts`, `types.ts`, `schemas.ts`
- `src/features/auth/rbac.ts`, `src/features/auth/types.ts`
- `src/app/(app)/admin/layout.tsx`, `admin/page.tsx`, `admin/companies/page.tsx`
- `src/components/shell/app-shell.tsx`, `sidebar.tsx`, `command-palette.tsx`, `nav-config.ts`, `quick-create.tsx`
- `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx`
- `src/app/(app)/crm/customers/[id]/page.tsx`
- `src/app/(app)/documents/[type]/nouveau/page.tsx`, `src/components/documents/pages/document-editor-page.tsx`,
  `document-editor-shell.tsx`, `document-editor-context.tsx`, `document-created-banner.tsx`
- `src/features/search/server.ts`, `src/app/api/search/route.ts`
- Docs : `phase5.4`, `phase5.5`, `super-admin-implementation.md`, `super-admin-reset-audit.md`,
  `super-admin-runtime-audit.md`

**Inchangés (nœud du système, volontairement hors périmètre)** : `src/lib/db/company-scope.ts`,
`src/lib/db/soft-delete.ts`, `src/features/company/context.ts`, `src/features/auth/password.ts`,
les modèles métier / routes API documents, crm, stock, achats, ventes (aucune migration).

> Note : de nombreuses modifications listées par `git status` proviennent des missions ANTÉRIEURES
> (UX shell, phase 5.5) — elles sont conservées telles quelles, aucune n'a été annulée.

## 14. État Git (`git status` au 2026-08-09)

- Branche `main`, à jour avec `origin/main`.
- Nombreuses modifications **non stagées** (missions antérieures + cette session) et fichiers non
  suivis (`docs/admin/`, `docs/debug/`, `docs/recovery/`, `scripts/*`, migrations phase 5.5…).
- Aucun fichier de travail temporaire laissé (`scripts/_tmp-*` supprimés).

## 15. Conclusion

- Compte `admin` supprimé définitivement ; login `admin`/`admin123` **impossible** (aucune ligne
  User/UserRole/UserCompany/Session/RoleAssignment ne subsiste).
- `superadmin` est le seul administrateur de plateforme (rôle global `SUPER_ADMIN`, ACTIVE, hors société).
- Les gardes applicatives empêchent tout rôle global d'être assigné à une société.
- Données métier intactes (Company=3, customers=5, suppliers=3, products=5, AuditLog=47, ActivityEvent=5).
- Toutes les portes sont vertes ; scripts de vérification **13/13, 27/27, 8/8, 20/0**.
- **AUCUN COMMIT, AUCUN PUSH** — conformément au brief.
