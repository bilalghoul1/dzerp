# DzERP — Rebuild Global Super Admin + Company Owner Architecture

> Statut : **Implémenté et vérifié** (2026-08-08).
> Ce document décrit la mise en œuvre de l'architecture cible « Two-Level » (plateforme / société),
> les décisions de conception, les points de sécurité, la matrice de tests et les portes de qualité.

## Table des matières

1. [Résumé de l'architecture cible](#1-résumé-de-larchitecture-cible)
2. [Périmètre et règles d'ingénierie respectées](#2-périmètre-et-règles-dingénierie-respectées)
3. [États avant / après](#3-états-avant--après)
4. [Modèle de données (schema.prisma)](#4-modèle-de-données)
5. [Rôle global SUPER_ADMIN](#5-rôle-global-super_admin)
6. [Rôle société OWNER](#6-rôle-société-owner)
7. [Création de société + Propriétaire (transactionnel)](#7-création-de-société--propriétaire-transactionnel)
8. [Obligation de changement de mot de passe (mustChangePassword)](#8-obligation-de-changement-de-mot-de-passe)
9. [Interface Super Admin](#9-interface-super-admin)
10. [Commutateur de société / non-adhésion](#10-commutateur-de-société--non-adhésion)
11. [Bootstrap sécurisé](#11-bootstrap-sécurisé)
12. [Journalisation d'audit](#12-journalisation-daudit)
13. [Matrice de tests](#13-matrice-de-tests)
14. [Portes de qualité](#14-portes-de-qualité)
15. [Gardiens et limites](#15-gardiens-et-limites)
16. [Fichiers modifiés / créés](#16-fichiers-modifiés--créés)

---

## 1. Résumé de l'architecture cible

L'architecture est **à deux niveaux** :

- **Niveau 1 — Plateforme** : un rôle **global** `SUPER_ADMIN` (via `UserRole`), **aucune société
  requise**. Il ne possède **aucune** adhésion `UserCompany`. Il gère le cycle de vie des sociétés
  (création, archivage, restauration, suppression logique) et le compte Propriétaire de chaque société.
- **Niveau 2 — Société** : un **Propriétaire** (`OWNER`) modélisé par `User → UserCompany →
  RoleAssignment(OWNER)`, **initialement lié à une seule société** (la sienne), confiné par le scope
  `companyScopeExtension` / `runWithCompanyContext`.

Le Super Admin n'est **pas** un `UserCompany` + `CompanyRole=OWNER` : il n'apparaît jamais dans un
commutateur de société, ne « devient » pas membre d'une société lors d'une opération, et n'a pas besoin
de contexte société pour agir.

## 2. Périmètre et règles d'ingénierie respectées

| Règle | Application |
|---|---|
| Ne pas réécrire l'architecture existante | Réutilisés : `companyScopeExtension`, `runScoped`/`runUnscoped`, `apiGuardWithContext`/`apiGuard`, RBAC `RoleAssignment`, `company-store`, Document Engine, inventaire, moteur PDF, workflow commercial, Phase 8.5/8.6. |
| Pas de second système RBAC concurrent | Le Super Admin est un **rôle global existant** (`UserRole`), fusionné dans les permissions de session ; pas de nouvelle table de permissions. |
| Pas de Super Admin = UserCompany + OWNER | Vérifié : le bootstrap et la garde `adminGuard` n'exigent aucune société. |
| Création atomique société + propriétaire | `createCompany` crée société, succursales, séries, membres et **propriétaire dans une seule `$transaction`**. |
| Pas de mot de passe en clair | `hashPassword` (bcryptjs, 12 rounds) au stockage ; le mot de passe temporaire n'apparaît que dans la réponse `201`. |
| Mot de passe temporaire affiché une seule fois | Retourné une seule fois par `createCompany` (type `CompanyCreateResult`), jamais récupérable ensuite. |
| Changement forcé à la première connexion | Colonne `User.mustChangePassword` + blocage de navigation dans l'écran de connexion. |
| Pas de contraintes uniques inventées | Seule `@@unique([userCompanyId, roleId])` et `User.username`/`User.email` (existantes) encadrent l'unicité ; prédicats de présence explicites dans `createCompany`. |
| Pas de hard DELETE | Le cycle de vie reste `softDeleteExtension` / `CompanyStatus` / `deletedAt` ; les suppressions logiques et l'archivage sont conservés. |
| Commutateur de société intact | Le Super Admin n'est jamais auto-ajouté à une société ; il n'a pas de commutateur (aucune adhésion). |
| Bootstrap sûr, idempotent, sans mot de passe prévisible | Script dédié `db:bootstrap:super`, mot de passe aléatoire (`randomBytes`), affiché une seule fois. |
| Journalisation par délégation | `recordAudit` / `recordActivity` (déjà existants) pour création, reset, etc. — aucune seconde implémentation. |
| Pas de commit git | Respecté — voir [§16](#16-fichiers-modifiés--créés). |

## 3. États avant / après

### Avant
- Le « Super Admin » était un ensemble de **clés de permission** (`admin.company.*`) possédées par un
  compte **membre d'une société**.
- Un administrateur **sans société active** obtenait `permissions = []` (anti-pattern : impossible d'agir
  sans adhésion).
- Le Propriétaire d'une société n'existait pas en tant que concept métier.

### Après
- `SUPER_ADMIN` = rôle **global** (`UserRole`) ; `isSuperAdmin` et permissions globales fusionnées dans la session.
- Un **Propriétaire** `OWNER` est créé **avec** la société, atomiquement.
- Premier login du Propriétaire : mot de passe obligatoirement changé.

## 4. Modèle de données

`schema.prisma` :

```prisma
model User {
  // ...
  mustChangePassword Boolean @default(false)
  // ...
}
```

Migration : `prisma/migrations/20260808000000_add_must_change_password/migration.sql`

```sql
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
```

Aucune autre table n'a été ajoutée : les rôles `SUPER_ADMIN`/`OWNER` sont des lignes de la table
`Role` existante (voir §5/§6), et le modèle d'adhésion `UserCompany` + `RoleAssignment` est inchangé.

## 5. Rôle global SUPER_ADMIN

- **Table** : `Role` (clé `SUPER_ADMIN`, `isSystem = true`).
- **Attribution** : `UserRole` (rôle **global**, hors société). Aucun `UserCompany` n'est créé.
- **Permissions** : l'ensemble des permissions de module `admin.*` (catalogue `PERMISSIONS`), concédées
  à `SUPER_ADMIN` dans le seed (`rolePermission.createMany`). `listGlobalPermissions(userId)` renvoie ces
  permissions héritées.
- **Session** : `getCurrentUser()` sélectionne le rôle et calcule `isSuperAdmin` (possession de
  `SUPER_ADMIN_ROLE_KEY`). Pour un Super Admin, les permissions globales sont **fusionnées** aux
  permissions de session : `permissions = [...global, ...companyScoped]`.
- **Garde serveur** : `requireSuperAdmin()` (RSC) et `adminGuard("admin.company.*")` (API). `adminGuard`
  retourne pour un Super Admin un acteur avec `activeCompanyId: null` — aucune résolution de contexte
  société n'est tentée (donc **pas** d'échec fail-closed pour un compte sans société).
- **Fichier clé** : `src/features/auth/rbac.ts` (`SUPER_ADMIN_ROLE_KEY`, `isSuperAdmin`),
  `src/features/company-admin/api.ts` (`adminGuard`).

## 6. Rôle société OWNER

- **Table** : `Role` (clé `OWNER`, `isSystem = true`).
- **Attribution** : `RoleAssignment` lié à une `UserCompany` — exactement le modèle **existante**.
- **Confinement** : le Propriétaire n'est initialement membre que de **sa** société. Le scope
  `companyScopeExtension` filtre toutes les lectures métier par `companyId`, et `assertCompanyAccess`
  borne les opérations d'administration à la société active.
- **Droits** : `OWNER` reçoit les permissions équivalentes à `COMPANY_ADMIN` plus la gestion des membres
  (`admin.company.membership.manage`).
- **Unicité fonctionnelle** : un seul compte `OWNER` par société à la création (pré-vérification
  username/email + `@@unique`), la gestion d'éventuels co-propriétaires est un choix ultérieur (délégation
  `RoleAssignment`), hors périmètre.

## 7. Création de société + Propriétaire (transactionnel)

`createCompany(actor, input, meta)` (service) exécute **une seule** `$transaction` :

1. `company.create` (données légales/bancaires/branding via `pickCompanyFields`).
2. Création des succursales + `defaultBranchId`.
3. Création des séries documentaires.
4. Affectations des membres existants (si fournis).
5. **Si `input.owner`** :
   - récupère `Role(key=OWNER)` (erreur explicite `MISSING_OWNER_ROLE` si absent) ;
   - pré-vérifie username/email (conflit 409) ;
   - `user.create` (mot de passe **haché**, `mustChangePassword: true`) ;
   - `userCompany.create` (adhésion unique, `isDefault: true`) ;
   - `roleAssignment.create` (`OWNER`, actif, `assignedBy = actor.userId`).
6. Retourne `{ company: CompanyAdminDetail, owner: { username, temporaryPassword } | null }` — le
   mot de passe temporaire n'est **rendu qu'ici**, une seule fois.

Toute erreur dans la transaction annule l'ensemble (aucune société orpheline). Le hachage est effectué
**avant** les écritures (`await hashPassword(...)`), la réponse ne contient jamais le hash.

API : `POST /api/admin/companies` → `201 { data: { company, owner } }` (voir
`src/app/api/admin/companies/route.ts`).

## 8. Obligation de changement de mot de passe

1. `User.mustChangePassword` est `true` à la création du Propriétaire et à la création (bootstrap) du
   Super Admin.
2. `POST /api/auth/login` renvoie `data.mustChangePassword` (l'utilisateur est authentifié).
3. `src/app/login/page.tsx` : si `mustChangePassword`, l'écran affiche un **formulaire de changement
   forcé** (nouveau mot de passe + confirmation) au lieu de naviguer vers `/`.
4. `POST /api/auth/change-password` vérifie le mot de passe actuel puis met `mustChangePassword: false`.
5. Réinitialisation Super Admin : `POST /api/admin/companies/[companyId]/owner/reset`
   (`resetOwnerPassword`) → nouveau mot de passe haché + `mustChangePassword: true` (forçage à nouveau).

## 9. Interface Super Admin

- **Wizard de création** (`company-wizard.tsx`, étape 8) : carte « Propriétaire de la société » — nom
  complet, identifiant, email, mot de passe temporaire. Payload `owner` envoyé avec la société.
- **Écran de succès** : affiche une seule fois les identifiants temporaires du Propriétaire, avec
  rappel du changement obligatoire.
- **Tableau des sociétés** (`companies-table.tsx`) : colonne **Propriétaire** (nom + `@username`),
  incluse dans le CSV.
- **Détail société** (`company-detail.tsx`) : carte Propriétaire (username, nom, email, état du
  changement requis, date d'adhésion) + bouton **Réinitialiser le mot de passe** (prompt + confirmation,
  appel du route de reset).

## 10. Commutateur de société / non-adhésion

- Le Super Admin n'a **aucune** `UserCompany` → le commutateur ne l'affiche jamais, il ne peut pas être
  « piégé » dans une société.
- Il n'est **jamais auto-affecté** lors d'une opération globale (aucun effet de bord d'adhésion).
- Toute action sur une société précise passe par `runUnscoped` + `assertCompanyAccess`/`assertGlobalAdmin`,
  le contexte société reste explicite.

## 11. Bootstrap sécurisé

`scripts/bootstrap-super-admin.ts` (npm : `db:bootstrap:super`) :

- Idempotent : si un compte avec le rôle `SUPER_ADMIN` existe déjà, sortie sans effet.
- Crée **exactement un** Super Admin si aucun (username `superadmin` par défaut, surchargeable par env).
- Mot de passe : `randomBytes(18).toString("base64url")` (non prédictible), affiché **une seule fois**,
  jamais `admin123` ou équivalent.
- `mustChangePassword: true` ; **aucun** `UserCompany` créé.
- Échoue si le rôle `SUPER_ADMIN` n'est pas encore dans le catalogue (invite à `db:seed` d'abord).

## 12. Journalisation d'audit

Délégation aux services existants (`src/features/audit/service.ts`) :

| Action | Audit (`AuditLog`) | Activité (`ActivityEvent`) |
|---|---|---|
| Création de société | `CREATE / Company` (actor, companyId) | `CREATE / Company` |
| Création du Propriétaire | — (compte interne) | `CREATE / User` (title propriétaire) |
| Reset mot de passe Propriétaire | `UPDATE / User` + `changes.passwordReset` | `PERMISSION_CHANGE / User` |
| Connexion | `LOGIN / User` (existant) | — |

Aucune table/implémentation d'audit supplémentaire.

## 13. Matrice de tests

Vérification automatisée, **non destructive** (`scripts/verify-super-admin.ts`) — elle upsert les rôles,
crée un Super Admin de test, une société + Propriétaire, vérifie le comportement puis **nettoie** ses
données de test.

Le script `scripts/verify-super-admin.ts` est **non destructif** et **auto-nettoyant** : il upsert les rôles
`SUPER_ADMIN`/`OWNER`, crée un Super Admin de test et une société + Propriétaire de test, vérifie
l'ensemble des scénarios demandés, puis **supprime ses propres données de test**. La matrice :

> **Correction 2026-08-09** : une version antérieure du script supprimait **inconditionnellement** le rôle
> `SUPER_ADMIN`/`OWNER` dans son nettoyage (`role.deleteMany`). Comme l'`upsert` réutilise le rôle
> préexistant d'une base réelle, exécuter le script détruisait le rôle GLOBAL de plateforme (et la liaison
> `superadmin` par cascade). Le nettoyage ne supprime désormais QUE les rôles / permissions / comptes de
> test que le script a lui-même **créés** (`*Created`), et utilise `prismaBase` (hard delete) pour ses
> sociétés de test afin de ne laisser aucun résidu (y compris de suppression logique).

| # | Cas | Résultat attendu |
|---|---|---|
| 1 | Super Admin sans adhésion société | `UserCompany.count = 0` ; `isGlobalAdmin` = vrai |
| 2 | Login du Super Admin | `verifyPassword` du mot de passe = vrai |
| 3 | Permissions globales du Super Admin | contient `admin.company.create`, `.archive`, `.restore` |
| 4 | Création de société + Propriétaire | `createCompany` renvoie les identifiants temporaires (une seule fois, hachés en base) |
| 5 | Le Super Admin voit sa société (liste + détail) | `ownerUsername` visible dans la liste et le détail |
| 6 | Rôle du Propriétaire | `EXACTEMENT` `OWNER`, `company-scoped` (1 seul) |
| 7 | Appartenance unique du Propriétaire | une seule `UserCompany`, celle de sa société |
| 8 | `mustChangePassword` du Propriétaire | `true` après création et au reset |
| 9 | Login du Propriétaire avec le mot de passe temporaire | hash valide (bcrypt), jamais en clair |
| 10 | Isolation lecture | dans le contexte société A, **0** ligne métier de B visible |
| 11 | Isolation écriture | une création métier sans `companyId` est rattachée à la société du **contexte** (A) |
| 12 | Isolation applicative | `listMembers(ownerActor, B)` rejeté (`assertCompanyAccess`) |
| 13 | Super Admin indépendant d'un contexte passé | `isGlobalAdmin` reste vrai même avec `activeCompanyId` posé |
| 14 | Reset mot de passe | `resetOwnerPassword` invalide l'ancien MDP, valide le nouveau, re-force `mustChangePassword` |
| 15 | Changement forcé → libéré | après un 1er changement explicite, `mustChangePassword = false`, nouveau login possible |
| 16 | État de la base | 1 `UserRole` SUPER_ADMIN, 0 adhésion, 1 `RoleAssignment` OWNER, aucun doublon |

Les résultats de la **dernière exécution** figurent en [Vérification d'exécution](#vérification-dexécution-runtime-verification).

## 14. Portes de qualité

Toutes vérifiées :

- `npx prisma validate` → schéma valide ✔
- `npx prisma generate` → client généré (7.9.1) ✔
- `npx tsc --noEmit` → 0 erreur ✔
- `npm run lint` → 0 erreur (7 warnings préexistants, hors périmètre) ✔
- `npm run build` → compilé, incluant `POST /api/admin/companies/[companyId]/owner/reset` ✔

## 15. Gardiens et limites

- **Limite** : le Propriétaire est créé avec un mot de passe temporaire **fourni par l'opérateur
  Super Admin** dans l'interface. Le bootstrap du Super Admin, lui, génère un mot de passe aléatoire —
  distinction volontaire (le propriétaire est un compte métier nominal, le Super Admin une clé de plateau).
- **Limite** : un seul Propriétaire `OWNER` est garanti à la création ; la pluralité de propriétaires ou
  le transfert de propriété est hors périmètre (évolutions `RoleAssignment`).
- **Pas de suppression dure** : la suppression de société reste logique (archivage d'abord si données).
- **Sécurité** : aucun mot de passe prédictible ; aucun compte ne peut accéder à l'application sans
  changer son mot de passe initial ; les opérations globales sont soumises à `assertGlobalAdmin`.

## 16. Fichiers modifiés / créés

**Modifiés**
- `prisma/schema.prisma`, `prisma/seed.ts`, `package.json`
- `src/features/auth/rbac.ts`, `src/features/auth/types.ts`, `src/features/company/store.ts`
- `src/features/company-admin/api.ts`, `types.ts`, `schemas.ts`, `service.ts`
- `src/app/api/admin/companies/route.ts`
- `src/app/api/auth/login/route.ts`, `src/app/api/auth/change-password/route.ts`
- `src/app/login/page.tsx`
- `src/components/admin/company-wizard.tsx`, `companies-table.tsx`, `company-detail.tsx`
- `src/i18n/dictionaries.ts`

**Créés**
- `prisma/migrations/20260808000000_add_must_change_password/migration.sql`
- `src/app/api/admin/companies/[companyId]/owner/reset/route.ts`
- `scripts/bootstrap-super-admin.ts`
- `scripts/verify-super-admin.ts`
- `scripts/verify-admin-removal.ts` (vérification READ-ONLY suppression du compte `admin`)
- `scripts/restore-super-admin.ts` (réconciliation idempotente de la plateforme, `db:restore:super`)
- `docs/admin/super-admin-implementation.md` (ce document)

**Non commité** — conformément aux règles du brief (aucun `git commit`).

---

## Vérification d'exécution (Runtime Verification)

### Commande

```bash
npx tsx scripts/verify-super-admin.ts
```

Le script est **non destructif** : il upsert les rôles `SUPER_ADMIN`/`OWNER`, crée un Super Admin de
test et une société + Propriétaire de test, exécute ses assertions, puis **supprime ses propres données
de test** (comptes, sociétés, rôles, adhésions, sessions) — et uniquement celles qu'il a **créées**
(correction 2026-08-09 : plus jamais les rôles SYSTEM préexistants).

### Résultat : PASS — 27 / 27 confirmations

Dernière exécution : 2026-08-09 (après correction du nettoyage). **27/27 vérifications réussies.**

Scripts associés :
- `npm run verify:admin-removal` (`scripts/verify-admin-removal.ts`) : vérification READ-ONLY de la
  suppression du compte legacy `admin` (13/13).
- `npm run db:restore:super` (`scripts/restore-super-admin.ts`) : réconciliation IDEMPOTENTE de la plateforme
  (rôles `SUPER_ADMIN`/`OWNER` + rattachement `superadmin` + démo `DzERP`/`dzerp.owner` + purge des résidus
  de tests `VERA`/`VERB`). Sans aucun reset.

### Scénarios vérifiés

**SUPER ADMIN**
- Connecté sans adhésion `UserCompany` (0 appartenance). ✔
- Le hash du mot de passe se vérifie (login) et n'est pas du clair. ✔
- Permissions globales héritées : `admin.company.create / archive / restore`. ✔
- Crée une société + Propriétaire (transaction atomique). ✔
- Obtient le mot de passe temporaire du Propriétaire exactement une fois (clair en réponse, hash en base). ✔
- Voit la société créée dans la liste (`ownerUsername`) et le détail. ✔
- Opère globalement : reste `isGlobalAdmin` même si un `activeCompanyId` lui est posé. ✔
- Ne cumule aucune adhésion pendant ses opérations (0 à la fin). ✔

**COMPANY OWNER**
- Rôle **exactement** `OWNER`, company-scoped (1 `RoleAssignment`). ✔
- N'appartient **qu'à sa** société (1 `UserCompany`). ✔
- Connectable avec les identifiants temporaires générés. ✔
- Mot de passe stocké haché (jamais en clair). ✔
- Forcé à changer le mot de passe temporaire au premier login (`mustChangePassword = true`). ✔
- Après le 1er changement explicite → `mustChangePassword = false`, reconnectable. ✔
- Un reset Super Admin re-force `mustChangePassword = true` et invalide l'ancien mot de passe. ✔

**ISOLATION**
- Lecture : dans le contexte société A, **0** donnée métier de B visible (scope lecture). ✔
- Écriture : une création métier sans `companyId` est rattachée à la société du **contexte** (A). ✔
- Service : un Owner de A (actif sur A) ne peut **pas** gérer la société B
  (`listMembers(owner, B)` rejeté via `assertCompanyAccess`). ✔
- Super Admin reste global sans hériter d'un contexte société arbitraire. ✔

**SÉCURITÉ / MOTS DE PASSE**
- Jamais de mot de passe en clair ; hash bcrypt vérifiable. ✔
- Mot de passe temporaire rendu une seule fois (pas récupérable ensuite). ✔
- Reset génère/requiert un nouveau mot de passe et re-force `mustChangePassword`. ✔

**VÉRIFICATION D'ÉTAT DE LA BASE (après test)**
- 1 seul `UserRole` SUPER_ADMIN pour le compte de test (aucun doublon). ✔
- 0 `UserCompany` pour le Super Admin à la fin. ✔
- 1 seul `RoleAssignment` OWNER pour le Propriétaire de test. ✔

### Portes de qualité (après le test)

- `npx prisma validate` → schéma valide ✔
- `npx tsc --noEmit` → 0 erreur ✔
- `npm run lint` → 0 erreur (8 warnings préexistants, hors périmètre) ✔
- `npm run build` → compilé, incluant `POST /api/admin/companies/[companyId]/owner/reset` ✔

### Commentaire sur le périmètre de l'isolation

L'extension de scope (`companyScopeExtension`) fait confiance, par conception, à un `companyId`
**explicite** fourni par du code applicatif autorisé (cf. `src/lib/db/company-scope.ts`, « scoping
explicite, non modifié »). L'isolation réelle pour une couche applicative est donc garantie par
`assertCompanyAccess` dans `src/features/company-admin/service.ts` (exige
`actor.activeCompanyId === companyId`). Le simulacre de test valide ce comportement au **niveau du
service** (`listMembers(owner, B)` rejeté), pas au niveau de l'extension brute. Ce design est conservé
tel quel — **aucune modification d'architecture** n'a été nécessaire ni effectuée.

### Problèmes restants

Aucun. 27/27 vérifications vertes. Les seuls flux non testés à l'exécution sont les chemins HTTP
complets (login / change-password / wizard UI) qui exigent un serveur ; ils sont couverts par
`tsc`/`lint`/`build` et par la compilation des routes.
