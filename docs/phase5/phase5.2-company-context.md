# Phase 5.2 — Contexte société (Company Context)

**Statut :** implémenté — en attente d'approbation avant Phase 5.3.
**Portée :** fondation multi-sociétés (couche contexte, résolution, persistence de session, navigation, infra non scopée). Aucune modification des modules métier, aucune migration `companyId`, aucun CRUD société.

---

## 1. Objectif

Établir la couche de contexte société qui sera consommée par les Phases 5.3+ :

- **Société active / succursale active** par requête (cookie → session → défaut).
- **Persistance** de la société/succursale active au niveau session utilisateur.
- **Sélecteur de société** dans la navigation (single → badge, multi → menu).
- **APIs de résolution** (`getCurrentCompany`, `getCurrentBranch`, helpers de permissions).
- **Infrastructure non scopée** (`runUnscoped`) pour les futurs jobs/imports/exports.
- **Réconciliation automatique** à la connexion (restaure la dernière société/succursale valide).

---

## 2. Changements de schéma (appliqués)

### `prisma/schema.prisma` — modèle `Session`

| Champ | Type | Notes |
| --- | --- | --- |
| `activeCompanyId` | `String?` | Société active de la session. **Sans FK** — la table `Company` arrive en 5.3. |
| `activeBranchId` | `String?` | Succursale active de la session (dans la société active). |
| `@@index([activeCompanyId])` | | |
| `@@index([activeBranchId])` | | |

**Migration :** `20260803125717_add_session_company_context` (créée avec `migrate dev --create-only`, appliquée avec `migrate deploy` — pas de shadow DB sur Neon). Client Prisma régénéré.

> **Note Phase 5.3 :** une fois la table `Company` créée, ajouter les FK `activeCompanyId → Company.id`, `activeBranchId → Branch.id` et une contrainte de cohérence société/succursale.

---

## 3. Nouveaux fichiers

### `src/features/company/` — nouveau module

| Fichier | Rôle |
| --- | --- |
| `types.ts` | `CompanyRef`, `BranchRef`, `CompanyContext` (le contrat de contexte complet). |
| `legacy.ts` | Source monoposte (Phase 5.2) : `DEFAULT_COMPANY_ID = "company-default"`, `getAssignedCompanies()` (1 société implicite dérivée de `settings.company.*`), `getAssignedBranches()` (toutes succursales actives). Ce sera remplacé par la table `Company` + `UserCompany` en 5.3 sans changer les appels. |
| `context.ts` | `AsyncLocalStorage` : `runWithCompanyContext(context, fn)`, `getCompanyContext()`, `isUnscopedContext()`, `runUnscoped(fn)`. `runUnscoped` **préserve** le contexte société englobant (le flag `unscoped` est ajouté, le contexte n'est pas nullé). |
| `unscoped.ts` | API publique : `runUnscoped`, `withUnscopedContext`, ré-export `isUnscopedContext`. |
| `resolver.ts` | Résolution : `listAssignedCompanies()`, `listAssignedBranches()`, `resolveActiveCompany` (cookie → session → défaut), `resolveActiveBranch`, `resolveCompanyContext(session)` (point unique), `getCompanyContextOrResolve()` (ALS → requête), `getCurrentCompany()`, `getCurrentBranch()`, `resolveLoginContext(userId)` (contexte de nouvelle session), `switchCompany(userId, companyId)`. |
| `helpers.ts` | Helpers pour la Phase 5.3 : `getCurrentPermissions()`, `getCurrentCompanyRole()`, `hasPermission()`, `hasAnyPermission()`, `hasAllPermissions()`. En 5.2 ils délèguent aux permissions globales (`UserRole`) — API inchangée en 5.3 quand `CompanyRole` arrivera. |
| `company-provider.tsx` | `CompanyProvider`, hooks `useCompany()`, `useCompanyOptional()`. |

### Navigation / API / Auth

| Fichier | Changement |
| --- | --- |
| `src/components/shell/company-switcher.tsx` | **Nouveau** `CompanySwitcher({ company, companies })` : 1 société → badge nom seule ; plusieurs → dropdown (icône `domain`, `expand_more`, `check` sur la société active, état `pending`, POST `/api/session/company` puis `router.refresh()`). Caché sur petit écran (`hidden md:block`). |
| `src/components/shell/app-shell.tsx` | Réécrit : props `{ context, children }` au lieu de `user/permissions/companyName/branches/activeBranch`. Wrapper `CompanyProvider` + `CompanySwitcher`. |
| `src/app/(app)/layout.tsx` | `getCurrentUser()` → `resolveCompanyContext(session)` → `runWithCompanyContext(context, <AppShell context={context}>)`. La société active est donc disponible en ALS pour toute la requête. |
| `src/app/api/session/company/route.ts` | **Nouveau** POST `{ companyId }` : `apiGuard()`, `switchCompany`, audit `SETTING_CHANGE`, `okResponse`. |
| `src/app/api/auth/login/route.ts` | `resolveLoginContext(user.id)` → stocke `activeCompanyId`/`activeBranchId` à la création de session → pose les cookies `COMPANY_COOKIE`/`BRANCH_COOKIE`. |
| `src/features/auth/session.ts` | `SessionMeta` (metadonnées réutilisables), `createSession(userId, meta, contextOptions)`, `getSessionActiveContext()`, `getLastSessionContext(userId)`, `updateSessionContext(input)`. Ré-export `SESSION_COOKIE`. |
| `src/lib/constants.ts` | `COMPANY_COOKIE = "dzerp.company"` (aux côtés de `BRANCH_COOKIE`). |

---

## 4. Logique de résolution

### Société active — priorité

1. **Cookie de requête** `dzerp.company` (si la société est assignée à l'utilisateur).
2. **Session** `activeCompanyId` (si assignée).
3. **Défaut** : société `isDefault` → première société → sentinelle `DEFAULT_COMPANY_ID` (monoposte 5.2).

Chaque valeur (cookie/session) est **validée contre la liste des sociétés assignées** avant utilisation — jamais de confiance aveugle.

### Succursale active — priorité

1. **Cookie** `dzerp.branch` (si appartient à la société active).
2. **Session** `activeBranchId` (si dans la société active).
3. **`null`** (toutes succursales).

### Contexte complet (`CompanyContext`)

```
{
  user:        { id, name, email, roles },
  company:     CompanyRef,            // société active résolue
  branch:      BranchRef | null,      // succursale active (null = toutes)
  companies:   CompanyRef[],          // sociétés accessibles
  branches:    BranchRef[],           // succursales de la société active
  permissions: PermissionKey[],       // permissions globales (5.2)
  roles:       string[],
}
```

### Connexion (`resolveLoginContext`)

Restaure la **dernière** société/succursale de l'utilisateur si elles sont toujours valides, sinon société par défaut → première société → `null`. `User.branchId` n'est **pas** utilisé en 5.2 : aucune succursale auto-sélectionnée hors validation.

### `switchCompany`

Valide l'appartenance → persiste session (`updateSessionContext`) → pose cookies → succursale conservée si elle appartient à la nouvelle société, sinon succursale par défaut (siège `HQ` ou première). Aucune déconnexion requise.

### Infrastructure non scopée

`runUnscoped(fn)` exécute `fn` hors contraintes `companyId` (futur) **tout en préservant** le contexte société de la requête englobante. `withUnscopedContext(fn)` est une promesse-aware wrapper.

---

## 5. Flux contexte (séquence)

```
Requête serveur
  └─ layout.tsx: getCurrentUser() ──► session (cookie → DB)
  └─ resolveCompanyContext(session)
        ├─ listAssignedCompanies()          (5.2: legacy settings)
        ├─ getSessionActiveContext()        (session DB → société/succursale)
        ├─ resolveActiveCompany()           cookie → session → défaut
        ├─ listAssignedBranches()           (toutes succursales actives)
        └─ resolveActiveBranch()            cookie → session → null
  └─ runWithCompanyContext(context, …)      ALS exposé à toute la requête
        └─ <AppShell context> ──► CompanyProvider ──► CompanySwitcher
        └─ composants serveur: getCurrentCompany() / getCurrentBranch()
              (lit l'ALS sans re-requête; sinon re-résolution)
```

---

## 6. Vérifications effectuées

- `npx tsc --noEmit` — **0 erreur**.
- `npm run lint` — **0 erreur / 0 warning**.
- `npm run build` — compile et génère les 22 routes ; `/api/session/company` est bien enregistré ; `(app)` pages en dynamique (`force-dynamic`), `/login` et `/_not-found` statiques.
- Aucune fuite de code serveur (`AsyncLocalStorage`, `cookies`) vers le client : `company-provider.tsx` et `company-switcher.tsx` n'importent que des types.

---

## 7. Reste pour Phase 5.3 (hors périmètre 5.2)

- Modèles `Company`, `UserCompany`, `CompanyRole`, FK `Session.activeCompanyId/BranchId`.
- Migration des données (settings société → table `Company`).
- Résolution `CompanyRole` dans `resolveCompanyContext` (l'API `helpers.ts` est déjà prête).
- Migration `companyId` des modules métier (ventes, achats, stock, finance, RH) en utilisant `runUnscoped` pour les traitements globaux.
- CRUD sociétés (paramétrage) + onboarding multi-sociétés.
