# Phase 5.5 — Gestion des sociétés & administration (Company Management & Administration)

**Statut :** implémenté — en attente d'approbation.
**Portée :** CRUD complet des sociétés (création par assistant multi-étapes, détail, modification, archivage, restauration, suppression logique), adhésions/utilisateurs par société, statistiques, journalisation (audit + activité), permissions `admin.company.*`, contraintes de sécurité (rôle global, société par défaut, ARCHIVED read-only, garde-fou de suppression). Le rôle `COMPANY_ADMIN` gère uniquement sa société assignée (aucune opération globale).

---

## 1. Objectif

La société est le **centre juridique** de l'application : toutes les données métier y sont rattachées (`companyId`, Phase 5.4). Phase 5.5 fournit l'administration de ce socle :

- **Super Admin (global)** : crée / archive / restaure / supprime les sociétés, gère les adhésions et les utilisateurs assignables, consulte les statistiques et les journaux.
- **Company Admin (par affectation)** : consulte et met à jour **sa** société active uniquement, gère ses succursales / numérotation / utilisateurs (permission `admin.company.update` + `admin.company.membership.manage`), sans accès aux autres sociétés ni aux opérations d'archivage/suppression.
- **Spécification arabe** : tous les champs légaux/entreprise sont **optionnels** — une valeur manquante ne doit jamais faire planter l'application ni apparaître dans un document imprimé (les champs vides s'affichent « — »).

---

## 2. Permissions

Catalog `src/features/auth/permissions.ts` — module `admin.company` (6 clés, appliquées en DB) :

| Clé | Usage |
| --- | --- |
| `admin.company.view` | Lire la liste / le détail d'une société |
| `admin.company.create` | Créer une société (assistant) |
| `admin.company.update` | Modifier une société (Company Admin sur sa société) |
| `admin.company.archive` | Archiver / restaurer |
| `admin.company.delete` | Suppression logique |
| `admin.company.membership.manage` | Gérer les adhésions / utilisateurs |

**Garde `isGlobalAdmin(actor)`** (`service.ts:44`) : true si l'acteur possède l'une des clés `create|archive|delete`. C'est elle qui autorise les opérations globales (listAll, archive, restore, softDelete, members…) ; `admin.company.update` seul (Company Admin) n'autorise que l'édition de sa propre société active (`actor.activeCompanyId === companyId`).

---

## 3. Schéma & données

Migration `20260804090000_phase55_company_management` (appliquée, « Database schema is up to date! ») :

- **`Company`** : champs légaux/entreprise/banque/branding/impression — `commercialName`, `legalForm`, `activity`, `secondaryActivity`, `type`, `capital`, `establishedAt`, `expiryDate`, `taxId`(préexistant), `rc`, `nis`, `ai`, `vatNumber`, `address`/`country`/`wilaya`/`commune`/`postalCode`, `phone`/`mobile`/`email`/`website`, `bank`/`bankAgency`/`bankAccount`/`rib`/`iban`/`swift`/`paymentTerms`, `logoKey`/`stampKey`/`signatureKey`/`primaryColor`/`secondaryColor`, `invoiceFooter`/`emailFooter`/`printHeader`/`printFormat`/`printMargins`/`qrEnabled` — **tous optionnels** (spec arabe).
- **`Company.status`** : enum `CompanyStatus` (`ACTIVE`/`INACTIVE`/`SUSPENDED`/`ARCHIVED`), défaut `ACTIVE` + index ; `deletedAt`/`deletedById` pour la suppression logique + index.
- **`Company.defaultBranchId`** : succursale par défaut (unique, FK `ON DELETE SET NULL`) ; **`UserCompany.defaultBranchId`** pareil.
- **`CompanyDraft`** : brouillon de l'assistant (1 par utilisateur, unique `userId`, `step`, `data` JSONB).
- **Backfill** : `INACTIVE` pour les sociétés `isActive=false`, `defaultBranchId` = succursale HEADQUARTER sinon première.

`Branch`, `DocumentSeries`, `RoleAssignment` existaient déjà (Phases 5.2/5.3). Le service utilise `AuditLog` / `ActivityEvent` (Phases 5.2/5.4) avec **`companyId` renseigné explicitement** pour que les onglets « Journal d'audit » / « Activité » du détail affichent les entrées de la société consultée.

### Écart seed (documenté)

`prisma/seed.ts` (destructif : vide toutes les tables, rôle clé `ADMIN`) contient bien les 6 permissions `admin.company.*` (upsert des `RolePermission`), mais sur la base de travail, **le seed n'a pas été relancé** (il détruirait les données de test). Un script **non destructif et reproductible** a été créé et exécuté :

- `scripts/add-admin-company-permissions.ts` : upsert des 6 permissions + grant à `ADMIN` ; si `COMPANY_ADMIN` existe, grant `view/update/membership.manage` (non présent ici → skip affiché).
- `scripts/inspect-user.ts` : inspecteur générique d'un utilisateur (`<username>` en argument) — remplace l'ancien `inspect-admin.ts` hardcodé sur `admin`, compte supprimé depuis.

---

## 4. Service métier — `src/features/company-admin/service.ts`

Toutes les opérations sont enveloppées dans **`runUnscoped`** (administration globale) ; les vérifications d'accès sont faites **explicitement dans le service** (`assertCompanyAccess`, `service.ts:55`), pas par l'extension.

Fonctions principales :

| Fonction | Rôle |
| --- | --- |
| `isGlobalAdmin(actor)` | Garde globale (create/archive/delete). |
| `listCompanies` | Liste paginée/filtrée (statuts, recherche code/nom). |
| `getCompanyDetail` | Détail complet + succursale par défaut, `notFound` si absente. |
| `createCompany` | Transaction : société + succursales + séries + adhésions + rôle par défaut. |
| `updateCompany` | PATCH champs présents uniquement (voir correction ci-dessous). |
| `setCompanyStatus` | `ACTIVE` / `SUSPENDED` (refuse ARCHIVED via statut direct). |
| `archiveCompany` / `restoreCompany` | Archivage / restauration avec règles ci-dessous. |
| `softDeleteCompany` | Suppression logique avec garde-fou de données. |
| `listMembers` / `addMember` / `updateMember` / `removeMember` | Adhésions + `RoleAssignment` (désactivation des anciens). |
| `getStatistics` | Compteurs (succursales, utilisateurs, actifs, clients, fournisseurs, produits, entrepôts, dernière connexion). |
| `listCompanyAudit` / `listCompanyActivity` | Journaux filtrés par `companyId`. |
| `saveDraft` / `getDraft` / `clearDraft` | Brouillon de l'assistant par utilisateur. |
| `listAssignableUsers` / `listAssignableRoles` | Lookups pour l'assistant et les membres. |
| `listCompanyBranches` / `listCompanySeries` | Succursales / séries d'une société (onglets détail). |

### Règles de sécurité (spécification)

- **Création / archivage / suppression / restauration :** Super Admin uniquement (`isGlobalAdmin`).
- **Modification :** Super Admin (n'importe quelle société) **ou** Company Admin sur **sa seule** `activeCompanyId`.
- **ARCHIVED = lecture seule** : toute écriture (PATCH, statut, membres) sur une société archivée → `COMPANY_ARCHIVED`.
- **Société par défaut :** ne peut pas être archivée ni supprimée → `CANNOT_ARCHIVE_DEFAULT` / `CANNOT_DELETE_DEFAULT`.
- **Suppression logique refusée** si l'un des modèles de la liste `BUSINESS_MODELS` (branch, documentSeries, customer, supplier, product, warehouse, inventoryMovement, quotation, salesOrder, deliveryNote, invoice, creditNote, purchaseRequest, purchaseOrder, goodsReceipt, supplierInvoice, fileAsset) possède des lignes → `COMPANY_HAS_DATA`.

### Corrections apportées pendant l'implémentation

- **Bug PATCH (`pickUpdateFields`)** : la sélection dérivait de `pickCompanyFields` qui appliquait `?? null` sur **tous** les champs — un PATCH d'un seul champ effaçait les autres. Réécrit pour n'inclure que les clés réellement présentes dans le body.
- **`defaultBranchCode`** : résolution déplacée dans `updateCompany` (lookup explicite de succursale → `data.defaultBranchId`).
- **Journalisation `companyId`** : `recordAudit` / `recordActivity` (`src/features/audit/service.ts` / `src/features/activity/service.ts`) acceptent désormais un `companyId` optionnel ; l'extension de scope saute les lignes qui portent déjà un `companyId` explicite. Tous les appels du service admin passent `companyId` → les onglets audit/activité du détail sont alimentés.

---

## 5. API routes — `src/app/api/admin/companies/**`

Garde commune `adminGuard` (`src/features/company-admin/api.ts`) : `apiGuardWithContext(permission)` → retourne un `AdminActor { userId, permissions, activeCompanyId }`. Les handlers passent ensuite par le service (`runUnscoped`).

| Route | Méthodes | Permission |
| --- | --- | --- |
| `/api/admin/companies` | GET (liste) / POST (création) | `view` / `create` |
| `/api/admin/companies/lookups` | GET | `view` |
| `/api/admin/companies/draft` | GET / POST / DELETE | `create` |
| `/api/admin/companies/[companyId]` | GET (détail) / PATCH (mise à jour) | `view` / `update` |
| `/api/admin/companies/[companyId]/status` | POST | `update` (garde interne `archive` pour ARCHIVED) |
| `/api/admin/companies/[companyId]/archive` | — | (`setCompanyStatus`) |
| `/api/admin/companies/[companyId]/restore` | POST | `archive` |
| `/api/admin/companies/[companyId]` (DELETE) | DELETE | `delete` |
| `/api/admin/companies/[companyId]/members` | GET / POST | `view` / `membership.manage` |
| `/api/admin/companies/[companyId]/members/[userCompanyId]` | PATCH / DELETE | `membership.manage` |
| `/api/admin/companies/[companyId]/statistics` | GET | `view` |
| `/api/admin/companies/[companyId]/audit` | GET | `view` |
| `/api/admin/companies/[companyId]/activity` | GET | `view` |

---

## 6. UI

### Assistant de création — `src/components/admin/company-wizard.tsx` (page `/admin/companies/nouveau`)

Assistant multi-étapes avec brouillon (`/draft`) :
1. **Identité** : code, nom commercial, nom arabe, légaux (tous optionnels), devise, langue.
2. **Succursales** : ajout dynamique (code, nom, nomAr, type HEADQUARTER/AGENCY, ville, tél, email, gérant, par défaut).
3. **Numérotation** : séries documentaires (type, préfixe, longueur, annuel).
4. **Utilisateurs / adhésions** : sélection utilisateur + rôle, ajout par membre.

Corrections pendant l'implémentation :
- **`MemberPicker`** : recevait la prop `roles` mais ne la lisait pas (rendait les `SelectItem` d'une autre source) → ne rendait aucun rôle. Corrigé : `roles.map(...) → SelectItem`, reset `userId`/`roleId` après ajout, prop `roles={roles}` passée par la page.
- Badge de synthèse simplifié (ternaire mort supprimé ; exige `form.code` et `form.name` non vides).
- Champ obligatoire `label` ajouté sur le toggle QR (`admin.qrEnabled`).
- Clés i18n ajoutées (`fr/ar/en`) : `admin.memberExists`, `admin.noBranches`, `admin.noSeries`, `admin.noActivity`, `admin.noAudit`, `admin.joinedAt`.

### Page détail — `/admin/companies/[companyId]`

- **Server component** `src/app/(app)/admin/companies/[companyId]/page.tsx` : `requirePermission("admin.company.view")`, résolution du contexte par **`getOrResolveCompanyContext()`** (voir correction ci-dessous), `notFound()` si société absente. Charge : détail, membres, succursales, séries, statistiques, audit, activité (en parallèle).
- **Client component** `src/components/admin/company-detail.tsx` : onglets **Général / Légal / Adresse / Banque / Image de marque / Impression / Numérotation / Succursales / Utilisateurs / Journal d'audit / Activité / Statistiques**, badge de statut, bandeau « Lecture seule » si ARCHIVED, grille `InfoRow` (champs vides → « — »), `EmptyState` pour listes vides, `StatCard` pour les statistiques.

### Piège résolu — contexte société dans les pages RSC

Le rendu RSC **n'exécute pas dans le contexte ALS posé par le layout** (documenté en Phase 5.4) : `getCompanyContext()` retourne `null` dans la page → `actor.permissions = []`, `activeCompanyId = null` → `assertCompanyAccess` échouait (500). Les routes API fonctionnaient (elles résolvent via `apiGuardWithContext`). Correction : la page utilise **`await getOrResolveCompanyContext()`** (résolution de secours par requête, mémorisée via `React.cache`).

---

## 7. Sécurité — revue

| Risque | Contre-mesure |
| --- | --- |
| Opération globale par un non-admin | `isGlobalAdmin` (create/archive/delete) vérifié dans le service, hors de l'extension. |
| Company Admin modifie une autre société | `assertCompanyAccess` : `activeCompanyId === companyId` requis. |
| Écriture sur société archivée | `COMPANY_ARCHIVED` sur toute écriture. |
| Archive/supprime la société par défaut | `CANNOT_ARCHIVE_DEFAULT` / `CANNOT_DELETE_DEFAULT`. |
| Suppression avec données métier | `COMPANY_HAS_DATA` si un modèle `BUSINESS_MODELS` a des lignes. |
| PATCH efface des champs non fournis | `pickUpdateFields` n'inclut que les clés présentes. |
| Permissions absentes en DB | Script non destructif `scripts/add-admin-company-permissions.ts` (reproductible). |
| Journalisation hors contexte | `AuditLog`/`ActivityEvent` optionnels ; `companyId` renseigné explicitement. |

---

## 8. Vérifications effectuées

- `npx tsc --noEmit` — **0 erreur**.
- `npm run lint` — **0 erreur** (1 warning connu préexistant TanStack `react-hooks/incompatible-library` dans `companies-table.tsx`, conforme au pattern existant).
- `npm run build` — **OK**, 11 routes `/api/admin/companies/**` + pages `/admin/companies`, `/admin/companies/nouveau`, `/admin/companies/[companyId]` générées.
- `npx prisma migrate status` — **database schema is up to date** (13 migrations, dont `20260804090000_phase55_company_management`).
- `npx prisma validate` — **0 erreur**.
- **Runtime réel (dev server, session du compte legacy `admin`/`admin123` — compte supprimé depuis, historiquement)** :
  - Login `POST /api/auth/login` → 200.
  - `GET /api/admin/companies` → 200 (après grant de permissions + `prisma generate` + redémarrage du serveur ; initialement 403 sans permissions, 500 avec client généré obsolète).
  - `POST /api/admin/companies` → 201 (**TESTCO**, branches SIEGE + AG2, séries DEV/FA, 1 membre).
  - Draft API : GET/POST/DELETE → 200 (étape 3 sauvegardée, renvoyée, effacée).
  - Membres : POST (ajout), PATCH (switch de rôle — ancien `RoleAssignment` inactif, nouveau actif), DELETE → OK.
  - PATCH société : préserve les champs non fournis (correction `pickUpdateFields`).
  - Statut `ARCHIVED` → OK ; archivage de `MAIN` (par défaut) → `CANNOT_ARCHIVE_DEFAULT`.
  - PATCH société archivée → `COMPANY_ARCHIVED`.
  - DELETE avec données → `COMPANY_HAS_DATA` ; DELETE de `MAIN` → `CANNOT_DELETE_DEFAULT`.
  - Statut changement → entrée `UPDATE` dans audit + `STATUS_CHANGE` dans activité (après fix `companyId`).
  - Pages : `/admin/companies` 200, `/admin/companies/nouveau` 200, **`/admin/companies/[TESTCO]` 200** (après correction du contexte RSC) avec les 12 onglets rendus, données affichées (Général, Légal…, Succursales, Utilisateurs, Audit, Activité, Statistiques).
- **Piège évité** : `Invoke-WebRequest` (PowerShell) corrompt l'en-tête `Cookie` et les bodies JSON inline (mangled → `INVALID_BODY`/`VALIDATION`) ; vérification HTTP effectuée avec `curl.exe` et fichiers body.

---

## 9. Artefacts de test

- `scripts/add-admin-company-permissions.ts` — **conservé** (reproductibilité du grant sur bases existantes ; le seed est destructif).
- `scripts/inspect-user.ts` — inspecteur utilisateur générique (l'ancien `inspect-admin.ts`, hardcodé sur `admin`, a été converti puis retiré).
- Test artifact `TESTCO` (id `1b1dfd8e-47de-4d06-9a92-1024c91d9fc2`, actuellement **ARCHIVÉ** par les tests de statut) : à restaurer/retirer avant livraison selon préférence.
- Log dev : `%TEMP%\opencode\dzerp-dev.log`.

---

## 10. Reste / recommandations

- Nettoyer l'artefact `TESTCO` (restaurer ou supprimer) avant la livraison.
- Suivre l'audit `FALLBACK` (`UserRole`) avant suppression définitive.
- Phase suivante : workflows Ventes / Achats (documents, séries, approbations).
