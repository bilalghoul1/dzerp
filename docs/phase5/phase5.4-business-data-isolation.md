# Phase 5.4 — Isolation des données par société & fondations documents (Business Data Isolation)

**Statut :** implémenté — en attente d'approbation avant Phase 5.5.
**Portée :** ajout de `companyId` sur les modèles métier, isolation automatique par société via une extension Prisma centralisée (`companyScope`), numérotation documentaire par société, seed démo complet scoped, wrapper d'API `apiGuardWithContext` / `runScoped`. Aucun workflow Ventes/Achats, aucune refonte UI.

---

## 1. Objectif

Garantir qu'aucune requête Prisma sur les données métier ne puisse fuiter entre sociétés :

- **Filtrage automatique** : `companyId` = société active injecté sur toutes les lectures/écritures des 21 modèles métier (fail-closed hors contexte société).
- **Scoping explicite autorisé** : un `where`/`data` contenant déjà `companyId` passe tel quel (ex. `listBranchesForCompany(companyId)`).
- **Numérotation par société** : `DocumentSeries` unique par `(companyId, docType)`.
- **Deux mécanismes de résolution du contexte** : ALS pour les API routes, résolution par requête (`React.cache`) pour les rendus RSC.

---

## 2. Changements de schéma (appliqués)

Migration `20260803140000_phase54_business_data_isolation` (écrite à la main — pattern Phase 5.3, appliquée avec `migrate deploy`, pas de shadow DB sur Neon).

- **23 modèles** dotés de `companyId` (FK → `Company`, `onDelete: Cascade` sauf `AuditLog`/`ActivityEvent` en `SetNull`) : `Branch`, `DocumentSeries`, `DocumentApproval`, `Customer`, `Supplier`, `Product`, `ProductCategory`, `Brand`, `Manufacturer`, `Warehouse`, `InventoryMovement`, `Quotation`, `SalesOrder`, `DeliveryNote`, `Invoice`, `CreditNote`, `PurchaseRequest`, `PurchaseOrder`, `GoodsReceipt`, `GoodsReceiptLine`, `SupplierInvoice`, `AuditLog`, `ActivityEvent`.
- **Contraintes d'unicité par société** (remplacent les contraintes globales) : `@@unique([companyId, code|key|docType|number|sku])` — `Branch` `@@unique([companyId, code])`, `DocumentSeries` `@@unique([companyId, key])` **et** `@@unique([companyId, docType])`.
- **Backfill** : toutes les lignes existantes rattachées à la société `MAIN` (bloc `DO $$ … $$`), puis `SET NOT NULL`.
- Modèle `Client` (hérité) volontairement non scoped ; 9 modèles documents conservent `clientId` nullable (legacy).
- `GoodsReceipt` / `GoodsReceiptLine` gagnent les FK `companyId`.

**État vérifié :** `migrate status` → « Database schema is up to date! », backfill confirmé.

---

## 3. Extension `companyScope` (noyau de l'isolation)

`src/lib/db/company-scope.ts` — `Prisma.defineExtension` branché dans `src/lib/prisma.ts` :

```
prisma = baseClient.$extends(companyScopeExtension).$extends(softDeleteExtension)
```

- **21 modèles stricts** (`COMPANY_SCOPED_MODELS`) : fail-closed — hors contexte société, toute requête lève `companyScope: accès au modèle métier "X" sans contexte société`.
- **2 modèles optionnels** (`COMPANY_OPTIONAL_MODELS` : `AuditLog`, `ActivityEvent`) : en contexte filtrés/renseignés ; hors contexte, accès autorisé (`companyId` null) pour la journalisation.
- Couvre `findMany/findFirst/findUnique/findFirstOrThrow/findUniqueOrThrow/count/aggregate/groupBy/create/createMany/createManyAndReturn/update/updateMany/updateManyAndReturn/delete/deleteMany/upsert` (même typage `AllModelsQueryArgs` que `soft-delete.ts` ; `deleteManyAndReturn` absent du client généré).
- `where`/`data` avec `companyId` explicite → **pass-through** (scoping explicite).
- `runUnscoped()` → désactive le filtrage (administration globale).

### Découverte critique corrigée (ALS vs rendu RSC)

En Next.js 16, **le contexte `AsyncLocalStorage` posé par le layout ne survit pas au rendu asynchrone des pages RSC** : `runWithCompanyContext(context, () => <AppShell>{children}</AppShell>)` couvre la création du JSX mais pas l'exécution des requêtes des pages. Symptôme : `companyScope: accès … Customer sans contexte` sur le tableau de bord malgré un layout correct.

**Correction** (`src/features/company/context.ts`) : résolution de secours par requête, **mémorisée via `React.cache`** (scoped à la requête, aucun partage entre requêtes/utilisateurs) :

```
getOrResolveCompanyContext()
  ├─ getCompanyContext()            → contexte ALS (API routes via runScoped)
  ├─ fallbackResolver injectable    → tests
  └─ cache(() => getCompanyContextOrResolve()) → pages RSC (une résolution/requête)
```

Le résolveur de secours vit **dans le même module** que l'extension (pas de registration croisée layout → extension : les bundles Next.js dupliquent les modules, une registration externe aurait été invisible — problème observé et écarté).

---

## 4. API routes — wrapper de contexte

`src/features/company/api.ts` :

- `apiGuardWithContext(permission?)` → `apiGuard` → `runWithResolveCache(() => resolveCompanyContext(session))` (`ApiError` → 403).
- `runScoped(context, fn)` → exécute le handler dans le contexte ALS.

Routes migrées : `branches`, `series`, `search`, `notifications`, `upload`, `customers`, `suppliers`, `products`, `warehouses`, `inventory` (qui conserve `apiGuard("inventory.adjust")` interne ; import `apiGuard` corrigé depuis `@/features/auth/api-guard`).

Routes vérifiées sans besoin de wrapper : `auth/*`, `current-user`, `settings` (modèles globaux) ; `lookups` (référentiels globaux) ; `session/company` (`switchCompany` → `listBranchesForCompany` avec `companyId` explicite) ; `files/[...key]` (stockage uniquement).

Créations : tous les sites `create` passent `companyId` explicite depuis `requireCompanyContext().company.id` (typage Prisma) — l'extension le renseigne à l'exécution pour les appels non typés.

---

## 5. Numérotation par société

`DocumentSeries` unique par `(companyId, docType)` ; le seed upsert via `companyId_key`. Le compteur `nextValue` (BigInt) est filtré par `companyId`. Vérifié à l'exécution : premier produit créé via l'API après seed → `PRD-000006` (compteur `PRODUCT` avancé à 6 dans le seed).

---

## 6. Seed (prisma/seed.ts)

Client **brut** (`PrismaClient` + `@prisma/adapter-pg`), l'extension est contournée — chaque upsert/create porte un `companyId` explicite.

- Ordre corrigé : nettoyage `RolePermission` avant `Company`, `Company` avant `Branch`, `Branch` avant `Company` (FK).
- Upserts : `Branch` (`companyId_code`), `DocumentSeries` (`companyId_key`), `Customer`/`Supplier` (`companyId_code`), `ProductCategory` (parentId incluse), `Brand`/`Manufacturer` (`companyId_code`), `Product` (`companyId_sku`), `Warehouse` (`companyId_code`), mouvements + transferts (`companyId`).
- Compteurs `DocumentSeries` avancés par société (`CUSTOMER`→6, `SUPPLIER`→4, `PRODUCT`→6, `WAREHOUSE`→3, `INVENTORY_MOVEMENT` → ouverture +1).
- Démo : 3 utilisateurs, 3 rôles, 71 permissions, 4 succursales, 5 clients, 3 fournisseurs, 5 produits, 6 catégories, 4 marques, 2 fabricants, 3 unités, 3 catégories TVA, 2 entrepôts, 7 mouvements de stock, 58 wilayas, 87 communes. Connexion : `directeur.oran / DzERP-Demo-2026` (le compte legacy `admin / admin123` a été supprimé).

---

## 7. Sécurité — revue

| Risque | Contre-mesure |
| --- | --- |
| Lecture d'une autre société | `where.companyId` injecté automatiquement (findMany/findFirst/count/aggregate/groupBy…). |
| Écriture cross-société | `companyId` injecté sur create/update/upsert ; `update/delete` scoped par `where`. |
| Oubli de contexte (bug) | Fail-closed : modèles stricts hors contexte → erreur explicite. |
| Partage de cache entre utilisateurs | `React.cache` par requête pour les pages ; ALS par requête pour les routes ; jamais de cache global. |
| Falsification `companyId` | Les valeurs de requête sont remplacées par la société résolue (le `companyId` soumis par le client est ignoré). |
| Traitements globaux | `runUnscoped()` explicite (scripts admin/backfill) uniquement. |
| Journalisation hors contexte | `AuditLog`/`ActivityEvent` optionnels — jamais bloquants. |

---

## 8. Vérifications effectuées

- `npx tsc --noEmit` — **0 erreur**.
- `npm run lint` — **0 erreur / 0 warning**.
- `npm run build` — compile, 22 routes générées.
- `npx prisma migrate status` — **database schema is up to date**.
- `npm run db:seed` — seed complet OK (branches 4, customers 5, suppliers 3, products 5, warehouses 2, inventoryMovements 7).
- `npm run verify:phase53` — **20 ✓ / 0 ✗**.
- `npm run verify:scope` (nouveau script `scripts/verify-company-scope.ts`) — **8/8** : contexte ALS in-scope, fail-closed hors contexte, `companyId` explicite (pass-through), modèle optionnel, `runUnscoped`, injection `companyId` en écriture, résolveur de secours RSC.
- **Runtime réel (dev server)** — pages protégées avec session `admin` : `/`, `/crm`, `/crm/customers`, `/crm/suppliers`, `/stock`, `/stock/entrepots`, `/stock/mouvements`, `/parametres`, `/parametres/branches`, `/parametres/numbering`, `/parametres/referentiels`, `/parametres/units`, `/parametres/taxes`, `/parametres/currencies` → **200**, **0 erreur `companyScope`** dans les logs, données rendues (tableau de bord : Sonatrach SA, Cevital, succursales ; clients ; succursales).
- **Mutation spot-check** : `POST /api/products` (201) → produit créé avec `companyId` = MAIN, retrouvé puis supprimé via requête scoped.
- **Piège évité** : `Invoke-WebRequest` (PowerShell) corrompt l'en-tête `Cookie` (fausses 401/307) ; vérification HTTP réalisée avec `curl.exe`.

---

## 9. Reste pour Phase 5.5 (hors périmètre 5.4)

- Workflows Ventes / Achats (documents, séries, approbations, workflows de validation).
- CRUD sociétés / adhésions / attributions (paramétrage + onboarding).
- Suppression définitive de `UserRole` (surveillance de l'audit `FALLBACK`).
- Nettoyage du modèle hérité `Client` au profit de `Customer`.
