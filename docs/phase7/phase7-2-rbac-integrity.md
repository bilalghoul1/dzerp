# Phase 7.2 — Intégrité RBAC & Adhésions (hardening)

Date : 2026-08-11
Périmètre : durcissement de l'intégrité RBAC / adhésions société. Aucune modification destructive de la base, aucune modification du Document Engine / PDF / Devis. Aucun commit / push.

---

## 1. Contexte et objectif

Un incident antérieur (Phase 7.1) a montré que l'utilisateur `loversmilsad` (DIF) pouvait avoir une adhésion `UserCompany` ACTIVE **sans aucun `RoleAssignment`** : permissions vides, sidebar vide et `/parametres` en 404. Cette phase rend l'intégrité **structurellement garantie** :

- toute adhésion ACTIVE porte au moins une attribution de rôle ;
- la création est atomique ;
- la résolution échoue en sécurité (fail-closed) : jamais de sidebar vide, de tableau de bord trompeur ou de HTTP 500 ;
- l'isolation société et le rôle Super Admin plateforme restent intacts.

## 2. Audit Phase 0 (lecture seule, avant toute modification)

Script dédié `scripts/_phase0-audit.ts` (READ-ONLY) — **15/15 contrôles PASS** :

| # | Contrôle | Résultat |
| --- | --- | --- |
| 1 | `UserCompany` sans `RoleAssignment` | OK — 0 |
| 2 | `RoleAssignment` orphelin | OK — 0 (FK) |
| 3 | `RoleAssignment` → rôle inexistant | OK — 0 (FK) |
| 4 | `RoleAssignment` → user absent | OK — 0 (FK) |
| 5 | Adhésion ACTIVE sans rôle | OK — 0 |
| 6 | Adhésion INACTIVE avec rôle actif | OK — 0 |
| 7 | Multi-rôles actifs sur une même adhésion | OK — 0 |
| 8 | Utilisateur sans aucune adhésion | `superadmin` uniquement (attendu : rôle global) |
| 9 | Plusieurs adhésions par défaut | OK — 0 |
| 10 | Utilisateur sans adhésion par défaut | OK — 0 |
| 11 | Utilisateur ACTIVE sans adhésion | `superadmin` uniquement (attendu) |
| 12 | Rôle de société portant `admin.*` | OWNER / COMPANY_ADMIN (acceptable, confiné société) |
| 13 | Succursale par défaut hors société | OK — 0 |
| 14 | Branche defaultBranch hors société | OK — 0 |
| 15 | ADMIN / SUPER_ADMIN assigné à une société | OK — 0 |

Notes : `superadmin` sans adhésion = état VALIDE (rôle global plateforme). Les `admin.company.*` portés par OWNER/COMPANY_ADMIN ne donnent jamais l'administration plateforme (gardes `requireSuperAdmin` / `isGlobalAdmin`) et ne sont **pas** ajoutés à MANAGER/READER.

## 3. Invariants définis (cible)

1. Toute adhésion **ACTIVE** sur une société **ACTIVE** porte ≥ 1 attribution de rôle active non expirée.
2. Aucune adhésion ACTIVE sans rôle n'est **créable** (service) ni **résolvable** avec des permissions (runtime).
3. Aucun rôle global (`ADMIN`, `SUPER_ADMIN`) n'est assignable à une société.
4. L'isolation société (extension `companyScope`, `assertCompanyAccess`) est préservée.
5. Super Admin = rôle global uniquement ; un membre de société ne reçoit jamais les permissions globales.

## 4. Cause racine

Audit complet des sites de création d'`UserCompany` : **3 sites runtime, tous dans `src/features/company-admin/service.ts`** (`createCompany` bloc membres ligne ~627, bloc propriétaire ~707, `addMember` ~1116), tous déjà atomiques (`prisma.$transaction`). La faille : le **rôle était optionnel au niveau du service** (une adhésion ACTIVE pouvait être créée sans `RoleAssignment`). `resolveMembership` compensait en re-fallback sur les rôles globaux `UserRole` — masquant l'état cassé (tableau de bord trompeur au lieu d'un échec sûr).

## 5. Atomicité `createCompany`

`createCompany` est déjà transactionnel. Durci :

- Validation **avant** écriture : `roleId` **obligatoire** pour chaque membre, sinon `ApiError 400 VALIDATION`.
- Création du `RoleAssignment` **inconditionnelle** et atomique avec l'adhésion dans la transaction.
- Le compte Propriétaire crée toujours `User + UserCompany + RoleAssignment(OWNER)` atomiquement.

Fichier : `src/features/company-admin/service.ts`.

## 6. Atomicité `addMember`

- Signature durcie : `roleId` désormais **requis** (`{ userId; roleId; defaultBranchCode? }`).
- Validation avant écriture : rôle manquant → `400 VALIDATION` ; `assertAssignableRole` avant toute écriture.
- `RoleAssignment` créé **inconditionnellement** dans la même transaction que `UserCompany`.

## 7. Validation des rôles (aucun rôle global en société)

`assertAssignableRole` (service.ts) refuse déjà `ADMIN`/`SUPER_ADMIN` (`GLOBAL_ROLE_FORBIDDEN`) et interdit à un non-Super Admin d'octroyer plus qu'il ne possède. `listAssignableRoles` n'expose que les rôles de société (`notIn: ["ADMIN", "SUPER_ADMIN"]`). Rien à changer — confirmé par les tests.

## 8. `updateMember` — garde fail-closed

- Impossible de retirer le dernier rôle (la logique `input.roleId ?? rôle actif ?? null` conserve le rôle).
- **Nouvelle garde** : si l'adhésion reste/devient ACTIVE sans aucun rôle → `400 VALIDATION`. Désactiver (`active: false`) une adhésion cassée reste possible (chemin de sortie propre).

## 9. RBAC fail-closed — suppression du repli `UserRole`

`resolveMembership` (`src/features/company/store.ts`) :

- Repli global `UserRole` **supprimé** (plus aucun `source: "UserRole"`, plus d'audit `FALLBACK`).
- Adhésion ACTIVE sans rôle → `source: "None"`, `permissions: []` (échec sûr).
- `listGlobalPermissions` (privilège SUPER_ADMIN) reste inchangé : le Super Admin garde ses permissions plateforme.

## 10. Résolution préférant les adhésions valides

`src/features/company/resolver.ts` — nouvel helper `pickAccessibleCompany` : parcourt les sociétés assignées (préférée cookie/session → défaut → première) et choisit la première dont l'adhésion porte un rôle (`source: "RoleAssignment"`). Une adhésion sans rôle n'est retenue qu'en dernier recours. Utilisé par `resolveCompanyContext` **et** `resolveLoginContext`.

## 11. Aucune fausse contrainte Prisma

Pas de contrainte simulée en base (les modèles ne sont pas touchés). L'invariant « adhésion ACTIVE ⇒ ≥ 1 rôle » est garanti par **trois** mécanismes complémentaires :

1. **Invariant transactionnel** (service : création atomique, rôle obligatoire) ;
2. **Garde runtime** (fail-closed à la résolution et à la mise à jour) ;
3. **Script de vérification** rejouable (contrôle continu).

## 12. État d'accès dégradé (UX)

- Nouveau composant `src/components/shell/membership-access-screen.tsx` : écran pleine page, message clair, **aucune donnée métier**, aucune sidebar, déconnexion.
- `(app)/layout.tsx` : si `context.permissionSource === "None"`, l'écran d'accès à réinitialiser remplace le shell (jamais de 500, jamais de sidebar vide).
- i18n fr/ar/en : `auth.noCompanyRole`, `auth.noCompanyRoleHint`.

## 13. Contexte de connexion (login)

`resolveLoginContext` ne restaure/joue jamais une société dont l'adhésion est sans rôle s'il existe une adhésion valide ; sinon la connexion aboutit sur l'état « accès à réinitialiser » (pas de Company Mode à permissions vides). Tests dédiés.

## 14. Isolation société — vérifiée

Test HTTP : `directeur.oran` (membre MAIN uniquement) tente de passer sur DIF → **403**. `lecteur` (membre MAIN + DIF) passe MAIN → DIF → `/parametres` 200. Le changement de société passe par `switchCompany` qui valide l'adhésion active avant toute écriture.

## 15. Super Admin plateforme — vérifié

`/admin` → 200 ; `/` → redirection `/admin` (plateforme sans société). Le porteur global SUPER_ADMIN n'a pas besoin d'adhésion ; les `admin.*` de société ne débloquent jamais l'administration plateforme.

## 16. Script de vérification (Phase 7)

`scripts/verify-company-membership-integrity.ts` — **READ-ONLY**, `npm run verify:membership-integrity`. Tableau par société (membres ACTIVE + rôle effectif), anomalies BROKEN/WARN, résumé, code de sortie (0 = aucune adhésion ACTIVE cassée).

## 17. Script de réparation (Phase 8)

`scripts/repair-company-membership-integrity.ts` — `npm run repair:membership-integrity`.

- **DRY RUN par défaut** ; `--apply` pour appliquer. Filtres `--user`, `--company`, rôle `--role`.
- Détermination du rôle **sans deviner** : `--role` explicite, consensus (même rôle sur ≥ 2 autres adhésions) ou preuve unique (1 seule autre adhésion, hors OWNER/COMPANY_ADMIN — risque d'escalade). Sinon → **SKIP** (réparation manuelle requise).

## 18. Tests (service + HTTP) — Phase 14/16

`scripts/verify-phase72-rbac-integrity.ts` (auto-nettoyant, 21/21 ✅) :

- **Service** : `createCompany` membre sans rôle → 400 VALIDATION ; `addMember` sans rôle → 400 ; `addMember` rôle ADMIN → 403 GLOBAL_ROLE_FORBIDDEN ; adhésion sans rôle → `resolveMembership` source `None` / 0 permission ; `updateMember` refuse de laisser une adhésion active sans rôle ; désactivation autorisée ; `resolveLoginContext` privilégie la société valide.
- **HTTP (serveur dev :3000)** : Super Admin `/admin` 200 + `/` → /admin ; Company Admin dashboard + `/parametres` 200 ; Reader `/parametres` 404 ; isolation DIF 403 ; switch MAIN→DIF 200 puis `/parametres` 200 ; UX fail-closed : `/` 200 avec message FR, **aucune donnée métier**, société affichée.

## 19. Régression + audit final (Phase 15/17)

- `npx prisma validate` ✅ · `npx prisma generate` ✅ · `npx tsc --noEmit` ✅ (0 erreur) · `npm run lint` ✅ (0 erreur, 6 warnings préexistants non liés) · `npm run build` ✅.
- `scripts/verify-phase53.ts` (scénario fail-closed mis à jour) : 21/21 ✅.
- `scripts/_ui-check.ts` : sidebar `loversmilsad` complète, société/branche correctes, bootstrap thème intact.
- **Audit final `verify-company-membership-integrity` : 0 adhésion ACTIVE cassée** (1 WARN attendu : `dzerp.owner` actif sur la société démo archivée DZERP).
- Serveur dev unique sur :3000, sain. Données temporaires de test intégralement supprimées.

## 20. Fichiers modifiés / dette / confirmation

### Fichiers modifiés

| Fichier | Modification |
| --- | --- |
| `src/features/company/store.ts` | Repli `UserRole` supprimé ; `source: "None"` fail-closed ; `recordAudit`/`logPermissionFallback` retirés. |
| `src/features/company-admin/service.ts` | `roleId` obligatoire (`createCompany` membres, `addMember`) ; `RoleAssignment` inconditionnel ; garde fail-closed `updateMember`. |
| `src/features/company/resolver.ts` | `pickAccessibleCompany` : adhésion valide privilégiée dans `resolveCompanyContext` et `resolveLoginContext`. |
| `src/app/(app)/layout.tsx` | Écran « accès à réinitialiser » quand `permissionSource === "None"`. |
| `src/components/shell/membership-access-screen.tsx` | Nouveau composant (message clair, déconnexion, aucune donnée). |
| `src/i18n/dictionaries.ts` | Clés `auth.noCompanyRole*` (fr/ar/en). |
| `scripts/verify-company-membership-integrity.ts` | Nouveau — vérification READ-ONLY. |
| `scripts/repair-company-membership-integrity.ts` | Nouveau — réparation DRY RUN / `--apply`. |
| `scripts/verify-phase72-rbac-integrity.ts` | Nouveau — tests auto-nettoyants. |
| `scripts/verify-phase53.ts` | Scénario 3 mis à jour (échec sûr au lieu du repli). |
| `package.json` | Scripts `verify:membership-integrity`, `repair:membership-integrity`. |

### Contraintes respectées

- Schéma Prisma : **non modifié**. Document Engine / PDF / Devis : **aucune modification**.
- Aucune écriture destructive ; réparation par défaut en DRY RUN.
- Aucun commit / push effectué.

### Dette restante (hors périmètre)

- Page de gestion des utilisateurs plateforme toujours inexistante (réparation d'accès via le script + `--role` explicite).
- WARN `ACTIVE_ON_INACTIVE_COMPANY` (`dzerp.owner` / DZERP archivée) : état historique du seed démo, sans risque (la société inactive n'est jamais résolue).

### Confirmation

L'intégrité RBAC / adhésions est garantie par la conception (atomicité + fail-closed), vérifiable par script, réparable explicitement, et **l'audit final confirme 0 adhésion ACTIVE cassée**.
