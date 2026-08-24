# DzERP — MASTER PROJECT AUDIT (Récupération / Consolidation)

> **Nature :** AUDIT READ-ONLY. Aucune modification de code, schéma, migration,
> base de données ou Git n'a été effectuée.
> **Date :** 2026-08-09 · **Machine :** Computer A (cette machine)
> **Mode :** RECOVERY + AUDIT + CONSOLIDATION + CLEANUP (phase d'audit uniquement)

---

## 1. Current Project State

| Élément | Valeur |
|---|---|
| Framework | Next.js **16.2.12** (App Router) |
| React | 19.2.4 |
| Prisma | **7.9.1** (CLI + Client + `@prisma/adapter-pg`) |
| Base de données | PostgreSQL 18.4 — Neon (eu-west-2), base `neondb` |
| Node (testé) | v24.18.0 |
| npm (testé) | 12.0.2 |
| Générateur Prisma | `prisma-client` → `src/generated/prisma` (**gitignoré**, régénéré par machine) |
| `prisma validate` | ✅ Schéma valide |
| `tsc --noEmit` (working tree) | ✅ 0 erreur |
| Schéma | **59 models, 21 enums** |
| Migrations | 18 dans `prisma/migrations`, 18 appliquées en base → **synchronisé** |

Le projet est **fonctionnel sur le plan technique** (compilation OK, schéma valide,
base joignable) mais se trouve dans un état **intermédiaire non publié** : une grosse
vague de travail « Super Admin + changement de mot de passe obligatoire » est
**modifiée mais non commitée** sur cette machine.

---

## 2. Git State

### Commits (branche `main`)
```
2516aca (HEAD, main, origin/main)  gh
b0ce48f                             hermes
629c57b                             create page achat
2b4759b                             ty
f299b24                             ل
f2abfbd                             2me modification
893d4b2                             first commit
```
- **Branche courante :** `main`
- **Dernier commit :** `2516aca` ("gh")
- **Remote :** `origin = https://github.com/bilalghoul1/dzerp.git`

### Branches distantes (problème des deux machines)
| Branche | Contenu | Relation avec `main` |
|---|---|---|
| `origin/main` | `2516aca` | = HEAD local |
| `origin/PC22` | `0f41781` "PC2" (2026-08-04) | Diverge depuis `629c57b` ; **1 commit absent de main** |
| `origin/company-branch` | `52ec3de` "company" (2026-08-07 23:45) | **Au-dessus de `main` (HEAD 2516aca)** ; **jamais fusionnée** |

### Travail non publié — Computer A (cette machine)
- **24 fichiers modifiés non commités** (voir §3) : `package.json`, `prisma/schema.prisma`,
  `prisma/seed.ts`, `layout.tsx`, `login/page.tsx`, `rbac.ts`, `auth/types.ts`,
  `company-admin/*`, `admin/companies/*`, `app-shell.tsx`, `i18n/dictionaries.ts`, etc.
- **Non suivis (untracked) :**
  - `prisma/migrations/20260808000000_add_must_change_password/` (**migration appliquée en base mais pas commitée**)
  - `scripts/bootstrap-super-admin.ts`, `scripts/ensure-demo-super-admin.ts`, `scripts/verify-super-admin.ts`
  - `src/app/api/admin/companies/[companyId]/owner/` (+ `reset/`)
  - `docs/admin/`, `docs/debug/`

> ⚠️ **Computer B** ne possède pas ces changements. Il ne peut donc ni générer le
> client Prisma avec `mustChangePassword`, ni exécuter le layout « plateforme »
> corrigé (cf. §4). **L'état Git ne permet pas de reconstituer Computer B autrement
> que par `origin/company-branch`** — c'est un instantané poussé, pas son working tree.

---

## 3. Uncommitted / Divergences locales (Computer A)

Le diff non commité correspond à une seule vague cohérente : **Phase 8.6 — Super Admin
global + Propriétaire + `mustChangePassword`**, avec :

- `prisma/schema.prisma` : `User.mustChangePassword Boolean @default(false)` (+1 ligne)
- `package.json` : script `db:bootstrap:super`
- `prisma/seed.ts` : +224 lignes (bootstrap société démo `DzERP`, OWNER, sessions)
- `rbac.ts` : `SUPER_ADMIN_ROLE_KEY`, `requireSuperAdmin`, `isSuperAdmin` dans la session
- `layout.tsx` : **correctif du crash** — shell « plateforme » quand SUPER_ADMIN sans société
- `app-shell.tsx` : support `context={null}` (badge plateforme, pas de CompanyProvider)
- `login/page.tsx` + `api/auth/login` + `api/auth/change-password` : flux `mustChangePassword`
- `company-admin/*` : service étendu (createCompany, owner, resetOwnerPassword, members, statistics)
- `admin/companies/*` : pages tableau / détail / wizard
- i18n : nouvelles clés (fr/ar/en)

**Aucune de ces modifications n'a été commitée.**

---

## 4. Database State (base Neon partagée)

> Connexion établie en **lecture seule** via l'URL **directe** (non-pooled).

| Domaine | État constaté |
|---|---|
| Serveur | Neon PostgreSQL **18.4**, base `neondb`, région `eu-west-2` |
| `_prisma_migrations` | **18 migrations appliquées** (les 18 du dossier) |
| Utilisateurs | `superadmin`, `admin`, `directeur.oran`, `lecteur` (tous ACTIVE) |
| Rôles globaux (UserRole) | superadmin→`SUPER_ADMIN`, admin→`ADMIN`, directeur.oran→`MANAGER`, lecteur→`READER` |
| Permissions | **86** dans le catalogue |
| Sociétés | `MAIN` (ACTIVE, **isDefault**), `DZERP` (**ARCHIVED**, isActive=false) |
| Succursales | MAIN : HQ/OR/CE/SU · DZERP : HQ |
| Adhésions (UserCompany) | admin→DZERP(default)+MAIN · directeur.oran→MAIN · lecteur→MAIN · **superadmin→aucune** |
| RoleAssignment | admin→OWNER(DZERP)+ADMIN(MAIN) · directeur.oran→MANAGER · lecteur→READER |
| Sessions actives | uniquement `admin` (la session de superadmin n'a pas été créée / a été révoquée) |
| `mustChangePassword` | `false` pour tous les comptes (y compris `superadmin`) |

**Point clé :** le compte `superadmin` existe, porte le rôle global `SUPER_ADMIN`,
et **n'a aucune adhésion UserCompany** (par conception). C'est le socle du crash (§9).

---

## 5. Prisma State

- **Version :** `prisma@7.9.1`, `@prisma/client@7.9.1`, `@prisma/adapter-pg@7.9.1`
- **Générateur :** `provider = "prisma-client"`, `output = "../src/generated/prisma"` (gitignoré)
- **Datasource :** `postgresql` — URL résolue par `prisma.config.ts` :
  `DATABASE_URL_DIRECT ?? DATABASE_URL` (cf. §4 ci-dessus : seul `DATABASE_URL` existe).
- **Client runtime :** `src/lib/prisma.ts` instancie `PrismaPg({ connectionString: DATABASE_URL })`
  puis applique deux extensions :
  1. `companyScope` (`src/lib/db/company-scope.ts`) — isolation multi-société automatique
  2. `softDelete` (`src/lib/db/soft-delete.ts`) — suppression douce
- **Schéma working tree = schéma commité + `User.mustChangePassword`.**

> ⚠️ **Problème CLI confirmé :** `prisma migrate status` échoue en `P1001` sur l'URL
> **pooled** (`…-pooler…`) présente dans `.env`, mais fonctionne parfaitement avec
> l'URL **directe** (dérivée, `sslmode=require`). Le client runtime (pg) fonctionne
> avec la pooled URL. → Il manque `DATABASE_URL_DIRECT` dans `.env`.

---

## 6. Migration State

- **18 migrations** dans `prisma/migrations/` ; **18 appliquées** dans `_prisma_migrations`.
- `prisma migrate status` (URL directe) : **« Database schema is up to date! »**
- ⚠️ La migration `20260808000000_add_must_change_password` est **appliquée en base**
  mais **pas commitée**. Git ne contient donc que 17 migrations.
  - Computer B : ses 17 migrations commitées + base à 18 → état « migration appliquée
    absente du dossier » (signalé par le CLI).
- Décalage cosmétique d'ordre : `20260805120000` (restore) est appliquée après
  `20260805110000` (files) et avant `20260805114505` (fix mouvement unique) alors que
  son nom est postérieur — sans impact fonctionnel.
- Les migrations `20260808000000_…` sont contenues dans le dossier, donc `migrate dev`
  ne régénérera pas de divergence une fois commitée.

---

## 7. Authentication State

| Brique | État |
|---|---|
| Session | Cookie HMAC-SHA256 (`data.mac`) signé ; payload `{sid, uid, exp}` ; vérification en DB (révoquée/expirée/uid) |
| Stockage | Table `Session` (token, ip, userAgent, expiresAt, revokedAt, activeCompanyId, activeBranchId) |
| Login | `POST /api/auth/login` — bcrypt, rate-limit IP+username, dummy hash anti-timing, retourne `mustChangePassword` |
| Change password | `POST /api/auth/change-password` — vérifie l'ancien, révoque les autres sessions, force `mustChangePassword=false` |
| Garde API | `apiGuard(permission?)` (`src/features/auth/api-guard.ts`) — 401/403 JSON |
| Garde Super Admin | `requireSuperAdmin()` (RSC), `adminGuard` (API), `getAdminActor()` (RSC) |
| Rôles | `UserRole` (global) → **fallback** · `RoleAssignment` (par société) → **primaire** |
| Permissions | Catalogue **hardcodé** `PERMISSIONS` dans `src/features/auth/permissions.ts` (source de vérité) ; tables `Permission`/`RolePermission` en lecture seule |
| Multi-tenant | Cookie `COMPANY_COOKIE` + `BRANCH_COOKIE` ; session `activeCompanyId/activeBranchId` ; contexte résolu et validé (`resolveCompanyContext`) |

**Verdict : architecture auth cohérente et sécurisée (HMAC, bcrypt, rate-limit,
fallback journalisé). Aucun secret exposé.**

---

## 8. Super Admin State

- **Existe et est implémenté :** rôle global `SUPER_ADMIN` via `UserRole`, indépendant de toute société.
- **Portes d'entrée :** `requireSuperAdmin()` (RSC), `adminGuard()` / `getAdminActor()` (API+RSC),
  `runUnscoped()` (contournement du scoping Prisma), service `company-admin` (`isGlobalAdmin`,
  `assertGlobalAdmin`, `assertCompanyAccess`, `assertNotArchived`, `assertAssignableRole`).
- **Permissions globales :** `admin.company.*` fusionnées dans la session du Super Admin.
- **Pages :** `/admin/companies`, `/admin/companies/[companyId]`, `/admin/companies/nouveau`.
- **Profil « plateforme » :** le working tree gère `context=null` dans `AppShell`
  (badge plateforme, pas de CompanyProvider).

### ⛔ CONFLIT identifié : Super Admin global vs Company Resolver
`resolveCompanyContext()` (`src/features/company/resolver.ts:171-210`) exige
**obligatoirement** une société assignée (throw `403 "Aucune société accessible."`).
Or le Super Admin global **n'a volontairement aucune UserCompany**.
Le commit `main` (et donc Computer B) appelle `resolveCompanyContext` dans le layout
pour **tous** les utilisateurs → **crash pour tout Super Admin sans société**.
Le correctif (layout conditionnel + session `isSuperAdmin`) existe **uniquement dans le
working tree local, non commité**. C'est un **conflit architecturel résolu localement
mais pas publié**, pas un bug du resolver lui-même.

---

## 9. Known Runtime Errors

| # | Erreur | Cause racine | État |
|---|---|---|---|
| 1 | **`Aucune société accessible.` (403)** au rendu de `src/app/(app)/layout.tsx` | Layout commité appelle `resolveCompanyContext` pour tout utilisateur ; Super Admin sans UserCompany → throw `resolver.ts:184`. Correctif présent dans le working tree local (`layout.tsx` : shell plateforme si `isSuperAdmin && assigned.length===0`). | ✅ corrigé localement, ⚠️ **non commité** |
| 2 | `prisma migrate status` → `P1001` (URL pooled) | `DATABASE_URL` pointe vers `…-pooler…` (Neon pooled) ; CLI Prisma ne s'y connecte pas. `DATABASE_URL_DIRECT` absent de `.env`. | ⚠️ config |
| 3 | Rôles seedés non-ADMIN → 403 sur tous les écrans documents | `seed.ts` octroie `ventes.*`/`achats.*` mais **aucune permission `documents.*`** aux rôles MANAGER/READER/COMPANY_ADMIN ; les pages/API exigent `documents.read/create` | ⚠️ ouvert (D1 audit pre-beta) |
| 4 | Liens morts / PROFORMA | Type « Facture Proforma » **inexistant** dans l'engine ; restes i18n (`proforma`), permissions `ventes.proforma.*`, lien `/ventes/proforma/nouveau` → 404 | ⚠️ legacy |
| 5 | Nom de fichier PDF double préfixe | `config.numberPrefix` (FAC/BS/FS) ≠ préfixes seedés des séries (FA/BCM/FF) → `FAC-FA2026-0001.pdf` | ⚠️ cosmétique |

---

## 10. Super Admin / Company Owner — architecture cible vs réel

**Architecture visée (documentée) :**
```
GLOBAL SUPER_ADMIN (UserRole, hors société)
   ↓  crée
Companies + Company OWNER (RoleAssignment, temp password, mustChangePassword=true)
   ↓
OWNER confiné à sa société (assertCompanyAccess), gère membres/succursales/numérotation
```
**Vérification code :** ✅ présente.
- `createCompany(actor, …)` crée société + succursale par défaut + compte propriétaire
  (`service.ts`, rôle OWNER, mot de passe temporaire rendu une fois, `mustChangePassword=true`).
- `resetOwnerPassword` → force `mustChangePassword=true`.
- `verify-super-admin.ts` : 21 assertions couvrant ce flux (SA sans société, isolation
  croisée A/B, OWNER unique, reset MDP).
- **Comptes de la base conformes :** `superadmin` sans société ; OWNER attribué à `admin`/DZERP.

**Aucun second système Super Admin.** Pas de nouveau design requis.

---

## 11. Multi-Tenant State

- **Source :** `UserCompany` (adhésions actives, une défaut max) + `RoleAssignment`
  (rôles par société, `active` + `expiresAt`).
- **Résolution :** `resolveMembership()` → permissions de la société active.
- **Isolation :** extension Prisma `companyScope` :
  - Modèles **stricts** (21) : lecture filtrée `companyId`, écriture renseignée, **fail-closed sans contexte**.
  - Modèles **optionnels** : AuditLog, ActivityEvent (hors contexte autorisés).
  - `runUnscoped()` : contournement pour l'administration globale.
- **Fallback :** adhésion sans RoleAssignment → repli sur `UserRole` (journalisé, audit FALLBACK).
- **Contexte :** ALS (`runWithCompanyContext`) pour API ; `React.cache` pour RSC ;
  validation cookie/session à chaque résolution.

**Verdict : architecture multi-tenant solide, défense en profondeur (extension Prisma +
couche service).**

---

## 12. Company / Branch State

- `Company` : 59 champs (identité légale algérienne, banque, impression, marque) — **tous lus/écrits**.
- `CompanyDraft` : brouillon du wizard 9 étapes (utilisé : save/get/clear, API draft).
- `Branch` : par société, `@@unique([companyId, code])`, HQ par défaut (`defaultBranchId`).
- Pages : `/parametres/branches` (BranchesManager), sélecteurs société/succursale dans le shell.
- ⚠️ **Dual-write détecté :** le profil société est stocké à la fois dans les **colonnes
  `Company`** (chemin Admin → `company-admin/service.ts`, lu par **print** dans
  `company-branding.ts`) **et** dans les clés `Setting company.*` (chemin Paramètres →
  `features/settings/config.ts`). Une modification faite d'un côté est **invisible** de
  l'autre. → **source de divergence réelle.**

---

## 13. CRM State

- **Modèle actif :** `Customer` (companyId, code par société, soft-delete, balance, creditLimit).
  CRUD complet : `features/customers/config.ts`, `api/customers`, page `/crm/customers`.
- **Modèle mort :** `Client` (zéro usage dans `src/` — seule ref : liste soft-delete).
- Fournisseurs : `Supplier` (CRUD complet, `ProductSupplier` inactif).
- Recherche globale : customers/suppliers indexés (`features/search/server.ts`).

---

## 14. Product State

- CRUD : `features/products/config.ts` (Product, ProductCategory arborescente, Brand,
  Manufacturer, Unit, VatCategory, ProductAttribute/Value).
- `Product` : 2 uniques (`companyId+code`, `companyId+sku`), soft-delete, variantes
  (`parentId`), unités multiples, TVA.
- ⚠️ **`ProductSupplier` : inactif** (zéro usage dans `src/`).

---

## 15. Inventory State

- `Warehouse` : CRUD complet (par société, branche, manager), séries `WH…`.
- `WarehouseLocation` : **inactif** (zéro usage dans `src/`, uniquement seedé).
- `InventoryMovement` : types (PURCHASE/SALE/TRANSFER/ADJUSTMENT/OPENING_BALANCE…),
  numérotation CAS via `DocumentSeries`, stock par `productId+warehouseId`.
- Page `/stock/entrepots`, `/stock/mouvements`.

---

## 16. Document Engine State

- **9 types** (5 ventes + 4 achats) : QUOTATION, SALES_ORDER, DELIVERY_NOTE, INVOICE,
  CREDIT_NOTE, PURCHASE_REQUEST, PURCHASE_ORDER, GOODS_RECEIPT, SUPPLIER_INVOICE.
- **Type « Facture Proforma » : n'existe pas** dans l'engine (seulement artefacts).
- **Conversion (flux métier) — vérifié serveur :** `ALLOWED_CONVERSIONS` +
  `assertAllowedConversion` dans `config.ts` et `conversion.ts` :
  `QUOTATION → [SALES_ORDER, INVOICE]`, `SALES_ORDER → [DELIVERY_NOTE, INVOICE]`,
  `DELIVERY_NOTE → [INVOICE]`, `INVOICE → [CREDIT_NOTE]` (+ 4 achats).
- **Numérotation active :** `DocumentSeries` (par société, CAS `updateMany` + précondition,
  `nextDocumentNumber`) ; **`Counter` est mort** (seedé mais zéro usage).
- **Statuts :** 12 enum, 9 utilisés dans les transitions ; DRAFT par défaut ;
  `PENDING`, `VALIDATED`, `ARCHIVED` non atteignables par transition.
- **Relations :** `DocumentRelation` (CONVERSION/REFERENCE/CREDIT/AMENDMENT) — écrites
  en transaction lors des conversions.
- **`DocumentApproval` : inactif** (l'approbation se fait par champ `status`, pas par ce modèle).

---

## 17. PDF / Print State

- **Fonctionnel** (statut phase8 : TERMINÉ, 51 vérifications + 15 E2E HTTP).
- Bibliothèques : `pdf-lib`, `@pdf-lib/fontkit`, `naqqash` (arabe), `pdfjs-dist` (preview client).
- Pipeline unique preview/download/print : `printDocument()` (`src/features/print/service.ts`).
- Formats A4/A5/THERMAL, RTL, polices Inter + Amiri embarquées.
- ⚠️ Noms de fichiers : double préfixe pour INVOICE/PURCHASE_ORDER/SUPPLIER_INVOICE (cf. §9-5).
- ⚠️ Branding lu **uniquement** depuis la table `Company` (pas depuis `Setting`) → alimente le dual-write (§12).

---

## 18. UI / UX State

- RTL + i18n fr/ar/en, thème clair/sombre, coquille responsive.
- Shell « plateforme » pour SUPER_ADMIN sans société (working tree).
- Navigation par permissions (`nav-config.ts`), command palette, quick-create, notifications.
- Wizard de création de société (9 étapes, CompanyDraft).
- `src/app/(app)/[...module]` : dossier **vide** (aucun catch-all actif).

---

## 19. Duplicate Architecture

| Sujet | SYSTÈME ACTUEL | SYSTÈME LEGACY / DUPLIQUÉ | Verdict |
|---|---|---|---|
| Rôles par société | `RoleAssignment` (Phase 5.3) | `UserRole` (global) — fallback journalisé | Duplication **temporaire assumée** |
| Numérotation | `DocumentSeries` (par société, CAS) | `Counter` (global, seedé) | **`Counter` mort** |
| Tiers | `Customer` / `Supplier` (par société) | `Client` (global) | **`Client` mort** |
| Profil société | Colonnes `Company` | Clés `Setting company.*` | **Dual-write** ⚠️ |
| Permissions documents | `documents.*` (génériques) | `permissionPrefix` par type (`ventes.devis.*`…) | **decoratif**, non enforce |
| Journalisation | `AuditLog` + `ActivityEvent` | — (deux canaux parallèles) | Duplication fonctionnelle assumée |
| Approbation | `status` (champ) | `DocumentApproval` (table) | **`DocumentApproval` mort** |
| Proforma | — (inexistant) | permissions/i18n/lien `ventes.proforma.*` | **artefacts morts** |
| Git | `main` | `origin/PC22`, `origin/company-branch` | **work non fusionné** |
| SUPER_ADMIN | rôle global UserRole | admin société (COMPANY_ADMIN/OWNER) | Complémentaire, pas dupliqué |

---

## 20. Legacy Code (à ne PAS supprimer sans décision)

- `Counter` (modèle + seed) — remplacé par `DocumentSeries`.
- `Client` (modèle) + colonnes `clientId` sur 9 documents (toujours null).
- `ProductSupplier` (modèle + seed).
- `WarehouseLocation` (modèle + seed).
- `DocumentApproval` (modèle + seed).
- Fallback `UserRole` (`getLegacyGlobalPermissions` + `logPermissionFallback`).
- Permissions/i18n `proforma`.
- `permissionPrefix` décoratif dans les configs documents.
- Branches Git `PC22` / `company-branch` (work non fusionné à arbitrer).

---

## 21. Unused Database Fields

Classés **UNUSED** avec preuve (aucune suppression proposée) :

| Modèle | Champ(s) | Usage |
|---|---|---|
| `Client` | **tous** | zéro usage dans `src/` |
| `Counter` | **tous** | seed uniquement |
| `ProductSupplier` | **tous** | seed uniquement |
| `WarehouseLocation` | **tous** | seed uniquement |
| `DocumentApproval` | **tous** | liste de scoping uniquement |
| `DocumentRelation` | `conversionRate` | stocké, jamais appliqué aux montants |
| `Setting` | `isPublic` / `getPublicSettings()` | aucun appelant dans `src/` |
| `Company` | `secondaryColor`, `emailFooter` | écrits, non consommés par l'impression |
| Documents (9 types) | `clientId` | toujours null (le moteur écrit `customerId`) |

> Ne sont **PAS** classés « unused » : tous les champs légaux/impression de `Company`
> (lus/écrits par `company-admin` + print), ni `ActivityEvent`/`AuditLog` (actifs en parallèle).

---

## 22. Dangerous Fields / Éléments sensibles

| Élément | Risque | Mesure existante |
|---|---|---|
| `companyScope` (extension Prisma) | Filtrer/sur-écrire `companyId` pour tout modèle métier | fail-closed + `runUnscoped` explicite |
| `Company.status=ARCHIVED`, `isActive=false` | Lecture seule ; `DZERP` est ARCHIVÉE | `assertNotArchived`, filtres `isActive` |
| `User.mustChangePassword` | Comportement login (bloque la nav tant que non changé) | migration **non commitée** ⚠️ |
| `Session.activeCompanyId/BranchId` | Valeurs stockées non fiables | validées avant usage (`selectActiveCompanyId`) |
| `DocumentSeries.nextValue` | Course de numérotation | CAS `updateMany` avec précondition |
| `resetOwnerPassword` | Force `mustChangePassword` | uniquement admin/owner autorisé |
| `.env` | Secrets | gitignoré ; URL affiche l'hôte mais secrets masqués dans ce rapport |

---

## 23. Missing Features

1. **Facture Proforma** — absent (artefacts seulement).
2. Permissions `documents.*` non octroyées aux rôles seedés non-ADMIN (D1).
3. Interface de **gestion des rôles/permissions** (tables en lecture seule).
4. Rollover d'année des séries (`series.year` fixe).
5. Application de `conversionRate` aux montants (D4).
6. Appelants de `getPublicSettings()` (chemin `isPublic` mort).
7. Merge/arbitrage des branches `PC22` et `company-branch`.

---

## 24. Broken Features

| # | Feature | Symptôme | Preuve |
|---|---|---|---|
| 1 | Super Admin sur code commité | Crash 403 au layout | `resolver.ts:184`, layout commité ; corrigé working tree non commité |
| 2 | Rôles non-ADMIN (documents) | 403 sur `documents.read/create` | seed vs pages/API |
| 3 | CLI Prisma (migrate) | P1001 URL pooled | `prisma.config.ts`, `.env` |
| 4 | Profil société | Divergence print vs Paramètres | `company-branding.ts` vs `settings/config.ts` |
| 5 | Liens Proforma | 404 `/ventes/proforma/nouveau` | `dictionaries.ts`, permissions |

---

## 25. Recommended Cleanup Plan (à valider — NON EXÉCUTÉ)

> Ordre proposé, chaque étape séparée par un commit et une vérification. Rien n'a été fait.

1. **Stabiliser Git (2 machines)**
   - Choisir `main` comme unique source. Décider du sort de `PC22` (0f41781) et
     `company-branch` (52ec3de) : soit les fusionner (après réconciliation), soit les archiver.
   - Commit A : état local actuel (working tree) — migration `mustChangePassword` comprise.
   - Computer B : `pull`, `prisma generate`, vérifier `migrate status` (URL directe).
2. **Corriger la config BDD**
   - Ajouter `DATABASE_URL_DIRECT` (URL directe Neon) dans `.env` des deux machines.
   - Vérifier `npx prisma migrate status` sur les deux machines → identique.
3. **Confirmer le fix Super Admin**
   - Tester le login `superadmin` (password du script `ensure-demo-super-admin`) → shell plateforme.
   - Décider si `mustChangePassword=true` doit être forcé pour `superadmin` (actuellement false).
4. **Corriger les permissions documents** (D1) : octroyer `documents.*` aux rôles seedés,
   ou retirer l'exigence pour les écrans de liste.
5. **Arbitrer les duplications** (avec décision explicite, sans suppression brute) :
   `Counter`, `Client`, `ProductSupplier`, `WarehouseLocation`, `DocumentApproval`,
   artefacts Proforma, `permissionPrefix`.
6. **Résoudre le dual-write profil société** : choisir une seule source (Company columns
   recommandée, puisque print la lit déjà) et migrer les clés `Setting company.*` ou les
   réconcilier.
7. **Corrections mineures** : préfixes PDF, `conversionRate`, rollover année, liens Proforma.
8. **Re-audit final** : `prisma validate`, `migrate status`, `tsc --noEmit`, `npm run lint`,
   smoke test login (admin + superadmin) sur les deux machines.

> ⛔ Toute suppression de modèle/champ/colonne doit être précédée d'une décision écrite
> (UNKNOWN → ne pas toucher). Ne jamais `db push --force-reset` ni `migrate reset`.
