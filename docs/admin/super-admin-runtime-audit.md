# Audit — « Aucune société accessible. » en runtime (Global Super Admin)

Date : 2026-08-08
Statut : **Étape 1 (audit) — AUCUNE modification de code appliquée dans ce document.**
Périmètre : erreur runtime `ApiError: Aucune société accessible.` levée depuis
`src/app/(app)/layout.tsx` après un login réussi d'un SUPER_ADMIN global.

> Les documents historiques liés sont `docs/debug/super-admin-runtime-errors-audit.md`
> (audit précédent) et `docs/debug/super-admin-runtime-errors-fix.md` (correctif précédent,
> qui décrit un correctif **déjà présent, non commité**, dans l'arbre de travail). Cet audit
> vérifie l'état **actuel** de l'arbre de travail, confirme la cause racine, valide ou
> invalide le correctif existant et isole les écarts résiduels.

---

## 1. Cause racine

Le layout du groupe `(app)` (`src/app/(app)/layout.tsx`) résolvait **inconditionnellement**
le contexte société pour **chaque** route authentifiée :

```ts
const context = await resolveCompanyContext(session);   // ancien code, commité (HEAD)
```

`resolveCompanyContext` (`src/features/company/resolver.ts:171`) est **correct et fail-closed**
pour les tenants : il exige une adhésion `UserCompany` active + une société résolue, sinon
`throw new ApiError(403, "Aucune société accessible.", "FORBIDDEN")` (resolver.ts:184).

Or un **SUPER_ADMIN global est une entité de plateforme, sans adhésion** par conception
(architecture documentée dans `docs/admin/super-admin-implementation.md`). Pour lui,
`listCompaniesForUser()` renvoie `[]`, `resolveActiveCompany()` renvoie `null`, donc le
résolveur **doit** lever le 403. C'est le comportement voulu pour un tenant sans société,
mais **inapplicable** à un Super Admin global qui n'a, par définition, aucune société.

**Conclusion** : ce n'est ni un bug du resolver ni du RBAC, c'est un **couplage non prévu**
entre le layout global (qui force un contexte société sur toutes les routes) et la nouvelle
entité Super Admin globale (hors société). Le point unique de la faille est l'appel
inconditionnel `resolveCompanyContext(session)` dans le layout.

---

## 2. Chaîne d'exécution affectée

```
POST /api/auth/login 200                          (login OK, session créée)
        ↓
GET /…  (n'importe quelle route du groupe (app), y compris /admin/*)
        ↓
src/app/(app)/layout.tsx
        ├─ getCurrentUser()                         → isSuperAdmin détecté (rôle global)
        └─ resolveCompanyContext(session)           → listCompaniesForUser() = []
             ↓
        resolveActiveCompany() → null
             ↓
        throw ApiError 403 « Aucune société accessible. »   (resolver.ts:184)
        ↓
ERREUR RUNTIME : le Super Admin ne peut atteindre AUCUNE page (app),
y compris les pages globales /admin/*, car le layout parent lève avant le rendu.
```

### Détection actuelle du SUPER_ADMIN

`getCurrentUser()` (`src/features/auth/rbac.ts`) lit `user.roles` (relation `UserRole`),
puis :

```ts
const isSuperAdmin = user.roles.some((r) => r.role.key === SUPER_ADMIN_ROLE_KEY);
```

Rôle global `SUPER_ADMIN` = rôle `UserRole` hors société (schéma : `User.roles → UserRole →
Role.key`). **Vérifié en base (lecture seule)** :

```json
{
  "username": "superadmin",
  "status": "ACTIVE",
  "mustChangePassword": false,
  "roles": [ { "role": { "key": "SUPER_ADMIN" } } ],
  "userCompanies": []
}
```

→ le compte de test existe, porte le rôle `SUPER_ADMIN`, **0 adhésion**. La détection
`isSuperAdmin` est donc fiable **pour cet arbre de code** (l'ancien HEAD, lui, ne lisait que
`name`/`nameAr` du rôle et n'exposait pas `isSuperAdmin`).

---

## 3. Comportement attendu (deux modes authentifiés)

| Mode | Profil | Contexte société | Résultat |
|---|---|---|---|
| **A — SUPER_ADMIN global** | `UserRole(SUPER_ADMIN)`, **0** `UserCompany` | **peut être `null`** — contexte « plateforme » | shell global, pages `/admin/*`, gestion des sociétés ; aucune donnée métier société chargée sans sélection explicite |
| **B — Company Owner / user** | `UserCompany` + `RoleAssignment` | obligatoire | résolution normale, isolation conservée, aucun changement |

Règles fermes :
- Pas de `UserCompany` factice, pas de société cachée, pas d'auto-attachement au premier
  tenant, pas de contournement d'`assertCompanyAccess`, pas de second mécanisme Super Admin.
- Le contexte « plateforme » (`company = null`) ne doit **jamais** servir à filtrer/exposer
  des données métier : les pages métier continuent d'exiger un contexte société (fail-closed).

---

## 4. Comportement actuel de l'arbre de travail (état vérifié)

Un correctif **non commité** est déjà présent dans l'arbre de travail (issu de l'étape
précédente, `docs/debug/super-admin-runtime-errors-fix.md`). Vérifications effectuées :

1. **`src/app/(app)/layout.tsx`** — bifurcation « plateforme » :
   ```ts
   const assigned = await listAssignedCompanies(session.user.id);
   if (session.isSuperAdmin && assigned.length === 0) {
     return <AppShell context={null} user={session.user} permissions={session.permissions}>{children}</AppShell>;
   }
   const context = await resolveCompanyContext(session);
   ```
   → Pour `superadmin` (0 adhésion, `isSuperAdmin=true`), le guard déclenche : **plus aucun
   403**, shell plateforme rendu. Aucun `UserCompany` fabriqué. Les pages métier restent
   fail-closed par leur propre `requireCompanyContext()`.

2. **`src/components/shell/app-shell.tsx`** — accepte `context: CompanyContext | null`.
   Profil plateforme (`isPlatform = context === null`) : badge « Plateforme » (`header.platform`,
   **clé i18n vérifiée présente** : `dictionaries.ts:97/1117/2137`), **pas** de
   `CompanySwitcher` / `BranchSelector`, **pas** de `CompanyProvider` autour des enfants.
   Aucun composant enfant du shell n'appelle `useCompany()` (grep vérifié) → aucun crash
   « must be used within a CompanyProvider ».

3. **`src/features/auth/rbac.ts` + `types.ts`** — `isSuperAdmin` ajouté à la session ;
   permissions = `resolveMembership` + **permissions globales** (`listGlobalPermissions`)
   fusionnées. `requireSuperAdmin()` existe comme porte des pages admin (non utilisée
   massivement ; les pages admin utilisent `requirePermission("admin.company.*")`).

4. **Pages admin globales** — `src/app/(app)/admin/companies/page.tsx` et
   `[companyId]/page.tsx` utilisent `getAdminActor()` (`src/features/company-admin/api.ts`)
   qui, pour un SA, renvoie `{ activeCompanyId: null, permissions: globales }`. Le service
   `listCompanies()` passe par `runUnscoped()` → le SA voit **toutes** les sociétés ;
   `assertCompanyAccess` n'est pas contourné (le SA est `isGlobalAdmin` → accès légitime).

5. **`src/features/company-admin/service.ts`** — `isGlobalAdmin(actor)` testé sur les clés
   `admin.company.create|archive|delete|restore` ; toutes les opérations globales passent
   par `runUnscoped`. `createCompany` crée Owner via `UserCompany` + `RoleAssignment(OWNER)`
   (sémantique `UserCompany` inchangée). `resetOwnerPassword` force `mustChangePassword`.

6. **Login** — `resolveLoginContext()` renvoie `{ activeCompanyId: null, activeBranchId: null }`
   pour un SA sans société ; la route login ne pose pas de cookies société. `mustChangePassword`
   inchangé pour le Company Owner.

7. **Guard API métier** — `apiGuardWithContext` (`src/features/company/api.ts`) résout
   `resolveCompanyContext` → pour un SA sans société, retourne **403 JSON** (fail-closed) :
   le SA n'accède **pas** aux données métier sans contexte société. ✓ (contrainte de sécurité)

8. **Qualité statique** : `npx tsc --noEmit` → **EXIT 0** (l'arbre compile).

### Résultat net

Avec l'arbre de travail actuel, le crash « Aucune société accessible. » décrit dans l'énoncé
**ne se reproduit plus** pour le profil SUPER_ADMIN global (le stack `layout.tsx:43 →
resolver.ts:184` correspond à l'ancien code commité, avant la bifurcation). Le correctif
principal est déjà en place.

### 4.1 Reproduction runtime réelle (serveur `next dev` en cours, HTTP curl)

| Connexion | `GET /` | `GET /admin/companies` | Lecture |
|---|---|---|---|
| `superadmin` (rôle `SUPER_ADMIN`, 0 adhésion) | **307 → `/login`** | **200** | Le mode plateforme fonctionne : l'admin globale rend (liste des sociétés). Seul l'atterrissage `/` rebondit (écart 5.1). |
| `admin` / `admin123` (rôle global `ADMIN` hérité, **0 adhésion**) | **500** ✗ | — | **C'est le crash reproduit par l'utilisateur** : la garde du layout ne couvre que `isSuperAdmin` ; `admin` (non-Super Admin, sans société) atteint `resolveCompanyContext` → 403 non capturé → 500. *(Ce compte legacy a depuis été supprimé de la plateforme.)* |

Base (lecture seule) : `users=4` — `admin`(ADMIN), `directeur.oran`(MANAGER), `lecteur`(READER),
`superadmin`(SUPER_ADMIN), **tous avec 0 `UserCompany`**.

⇒ Le correctif SUPER_ADMIN est validé. Mais le **crash 500** persiste pour **tout utilisateur
authentifié non-Super Admin sans société accessible** (comptes hérités `ADMIN`/`MANAGER`/`READER`
du seed, non attachés à une société). C'est le symptôme réellement observé par l'utilisateur :
le layout ne doit pas laisser `resolveCompanyContext` lever une erreur non capturée.

---

## 5. Écarts résiduels détectés (à traiter en Phase 2)

### 5.1 — Atterrissage post-login du SUPER_ADMIN (fonctionnel, dans le périmètre)

Le login (`src/app/login/page.tsx`) fait `router.push("/")` après connexion. Or la page
d'accueil `src/app/(app)/page.tsx` fait :

```ts
const context = await getOrResolveCompanyContext();
if (!context) redirect("/login");   // ligne 53-54
```

Pour un SA sans société, `context === null` → **redirect vers `/login`** : le SA connecté est
renvoyé vers l'écran de connexion au lieu d'atteindre l'administration globale (reproduit :
`GET /` → 307 `/login`). Cela contredit la cible « Redirect reaches global administration » du
cahier des charges. `/admin/companies` fonctionne (200), mais ce n'est pas l'atterrissage par
défaut.

**Correctif minimal proposé** — dans `src/app/(app)/page.tsx`, différencier le profil avant
le redirect :

```ts
const context = await getOrResolveCompanyContext();
if (!context) {
  // SUPER_ADMIN global (plateforme, aucune société) → administration globale.
  const session = await getCurrentUser();
  if (session?.isSuperAdmin) redirect("/admin/companies");
  redirect("/login");
}
```

Aucune nouvelle abstraction ; le comportement fail-closed des tenants est conservé.

### 5.2 — Crash 500 pour un utilisateur authentifié sans société (symptôme réel observé)

**Symptôme reproduit** : login `admin` / `admin123` (rôle global `ADMIN` hérité, 0 adhésion) →
`GET /` → **500** `ApiError: Aucune société accessible.` non capturé depuis
`src/app/(app)/layout.tsx:43`.

**Cause** : la garde du layout ne couvre que `session.isSuperAdmin`. Un utilisateur
authentifié non-Super Admin **sans `UserCompany` valide** (comptes hérités du seed :
`admin`, `directeur.oran`, `lecteur`, rôles globaux `ADMIN`/`MANAGER`/`READER`) tombe dans
`resolveCompanyContext(session)` qui lève un `ApiError(403)` non capturé → erreur 500 au lieu
d'un comportement fail-closed gracieux.

Ce n'est **pas** une régression de sécurité (l'accès reste refusé) mais un **crash UX** : le
layout racine du groupe `(app)` ne doit jamais laisser le 403 devenir une 500.

**Correctif minimal proposé** — dans `src/app/(app)/layout.tsx`, gérer le cas « aucune
société accessible » pour les non-Super Admin avant la résolution (cohérent avec la page
d'accueil, qui redirige déjà vers `/login` en l'absence de contexte) :

```ts
const assigned = await listAssignedCompanies(session.user.id);

// Profil « plateforme » : SUPER_ADMIN global sans société → shell global (aucune adhésion fabriquée).
if (session.isSuperAdmin && assigned.length === 0) {
  return <AppShell context={null} user={session.user} permissions={session.permissions}>{children}</AppShell>;
}

// Utilisateur authentifié sans aucune société accessible (non-Super Admin) :
// fail-closed gracieux — redirection, jamais d'erreur 500.
if (assigned.length === 0) {
  redirect("/login");
}

const context = await resolveCompanyContext(session);
```

Aucune adhésion factice, aucune modification de l'isolation, aucun `try/catch` masquant : la
résolution reste fail-closed pour qui a une société.

### 5.2 — Navigation latérale du SA (cosmétique, hors périmètre immédiat)

`filterNav` masque tous les items métier pour un SA (seules ses permissions `admin.*` sont
portées) : la sidebar n'affiche que « Administration ». Le bouton `QuickCreate` du shell
affiche alors un menu vide (aucune permission métier). Sans conséquence fonctionnelle, à
examiner en raffinement UX (ex. masquer `QuickCreate` en profil plateforme).

### 5.3 — `getAdminActor()` appelé sur des pages admin sans garde préalable

`src/app/(app)/admin/companies/page.tsx` n'appelle pas `requireSuperAdmin()`/`requirePermission`
avant `getAdminActor()` ; le layout `(app)/admin/layout.tsx` le fait (`requirePermission("admin.company.view")`),
donc la page est déjà protégée. Aucun écart de sécurité — simplement noté.

---

## 6. Second problème indépendant — BootstrapScript

**Hors périmètre de la correction du contexte société.** Symptôme :
« Encountered a script tag while rendering React component » depuis
`src/features/theme/bootstrap-script.tsx`.

Cause : un composant React rendait un élément `<script>` ; côté client React n'exécute jamais
les scripts déclarés ainsi → warning console + risque de flash thème.

État actuel (arbre de travail) : `bootstrap-script.tsx` utilise désormais `next/script`
(`strategy="beforeInteractive"`, `id="theme-bootstrap"`, `dangerouslySetInnerHTML`), placé
dans le `<body>` du layout racine (`src/app/layout.tsx:42`). C'est la méthode App Router
documentée : injection du script inline dans `<head>` côté serveur, exécution avant
hydration, sans élément `<script>` recréé par React → le warning disparaît et l'anti-FOUC
est conservé. Aucune autre modification nécessaire ; à confirmer visuellement en navigateur.

> Décision : ne **pas** mélanger ce correctif avec celui du contexte société. S'il devait
> être retouché, ce sera un petit changement séparé et documenté.

---

## 7. Fichiers affectés (état actuel de l'arbre de travail)

| Fichier | Rôle | État |
|---|---|---|
| `src/app/(app)/layout.tsx` | Point de la faille → bifurcation « plateforme » | correctif présent (non commité) |
| `src/features/company/resolver.ts` | Résolveur fail-closed (inchangé, correct) | inchangé |
| `src/features/auth/rbac.ts` | `isSuperAdmin` + permissions globales + `requireSuperAdmin` | correctif présent |
| `src/features/auth/types.ts` | `SessionContext.isSuperAdmin`, `SessionUser.mustChangePassword`, `roles[].role.key` | correctif présent |
| `src/components/shell/app-shell.tsx` | Shell tolérant `context=null` (badge Plateforme) | correctif présent |
| `src/features/company-admin/api.ts` | `adminGuard`/`getAdminActor` profil SA (`activeCompanyId: null`) | correctif présent |
| `src/features/company-admin/service.ts` | `isGlobalAdmin`, `runUnscoped`, création Owner, reset MDP | correctif présent |
| `src/app/(app)/admin/companies/page.tsx` / `[companyId]/page.tsx` | Acteur admin correct pour le SA | correctif présent |
| `src/app/(app)/page.tsx` | Atterrissage `/` → bounce `/login` pour le SA | **écart 5.1 à corriger** |
| `src/app/(app)/layout.tsx` | 500 non capturé pour non-SA sans société (cas `admin`) | **écart 5.2 à corriger** |
| `src/features/theme/bootstrap-script.tsx` | `next/script beforeInteractive` | correctif présent (2e problème) |
| `src/app/layout.tsx` | `<BootstrapScript/>` déplacé dans `<body>` | correctif présent |
| `src/i18n/dictionaries.ts` | clé `header.platform` | correctif présent |

---

## 8. Correctif minimal proposé (Phase 2, après validation)

1. **Conserver** la bifurcation plateforme du layout (déjà présente) — aucun `UserCompany`
   factice, aucune société par défaut, aucun `try/catch` masquant dans le resolver.
2. **Écart 5.1** — dans `src/app/(app)/page.tsx`, rediriger le SUPER_ADMIN global sans
   contexte vers `/admin/companies` au lieu de `/login` (atterrissage post-login vers
   l'administration globale).
3. **Écart 5.2** — dans `src/app/(app)/layout.tsx`, rediriger vers `/login` un utilisateur
   authentifié **non-Super Admin sans société accessible** (comptes hérités sans `UserCompany`),
   au lieu de laisser `resolveCompanyContext` lever une 500 non capturée. La garde SUPER_ADMIN
   reste en premier ; le chemin société reste inchangé pour les tenants.
4. **Ne rien changer** au resolver, au scoping Prisma (`companyScope`), à
   `assertCompanyAccess`, ni aux pages métier.
5. Ne pas retoucher le BootstrapScript (déjà corrigé, hors périmètre).

> Note produit (hors code) : les comptes hérités du seed (`admin` ADMIN, `directeur.oran`
> MANAGER, `lecteur` READER) n'ont **aucune** `UserCompany`. Sous le nouveau modèle, ils ne
> peuvent pas accéder aux pages métier. À décider : les attacher à une société, ou les passer
> en `SUPER_ADMIN` pour le profil plateforme. Le correctif 5.2 ne change que leur échec
> (500 → redirection), pas leur périmètre.

---

## 9. Considérations de sécurité

- Le mode « plateforme » est dérivé **uniquement** du rôle global `SUPER_ADMIN` (relation
  `UserRole`, fiable), jamais d'un flag arbitraire.
- Le SA sans société n'obtient **pas** de contexte société : toute requête métier
  (`apiGuardWithContext`, `requireCompanyContext`, extension `companyScope`) échoue
  fail-closed → aucune fuite de données cross-tenant par inadvertance.
- L'accès du SA aux données **d'une** société exige une action explicite (ex. page admin
  d'une société via `getAdminActor` + `assertCompanyAccess`/`runUnscoped`) — sélection
  contextuelle, pas une adhésion.
- L'isolation entre sociétés (A ne lit pas B) est inchangée ; `isGlobalAdmin` ne s'applique
  qu'au module d'administration globale.
- `resetOwnerPassword` reste réservé au SA (`assertGlobalAdmin`), force `mustChangePassword`.

---

## 10. Risques de régression

1. **Shell plateforme** : si un composant client futur appelle `useCompany()` sous le profil
   plateforme (pas de `CompanyProvider`), il lèvera. À garder en tête pour les nouveaux
   composants admin.
2. **Permissions fusionnées** : un SA qui possède **aussi** des adhésions actives passe par
   le chemin société normal (multi-société) — comportement inchangé, mais les permissions
   globales restent fusionnées dans sa session (déjà le cas en HEAD).
3. **Atterrissage `/`** : la correction 5.1 ne doit pas modifier le comportement des tenants
   (eux conservent `redirect("/login")` si aucune société).
4. **`getCurrentUser`** est appelé plusieurs fois par requête (layout, pages, guards) ; le
   coût est tolérable (requêtes `findUnique`/`findMany` mémoïsées par `runWithResolveCache`).

---

## 11. Conclusion de l'audit

- **Cause racine confirmée** : le layout `(app)` exigeait un contexte société pour toutes les
  routes, impossible pour un SUPER_ADMIN global sans adhésion → 403 au runtime.
- **Correctif principal validé au runtime** : login `superadmin` → `GET /admin/companies`
  **200**, plus aucun « Aucune société accessible. ». (Bifurcation plateforme + shell
  tolérant + `isSuperAdmin` + acteur admin global, déjà présents dans l'arbre de travail,
  non commités.)
- **Symptôme réel observé = écart 5.2** : le crash 500 reproduit par l'utilisateur vient du
  login `admin` (rôle global `ADMIN` hérité, **0 adhésion**, non-Super Admin) → le layout
  laisse `resolveCompanyContext` lever un 403 non capturé. À corriger par une redirection
  fail-closed gracieuse.
- **Écart 5.1** : l'atterrissage `/` du SUPER_ADMIN rebondit vers `/login` ; à rediriger vers
  `/admin/companies` pour « Redirect reaches global administration ».
- **Second problème** (BootstrapScript) déjà corrigé séparément via `next/script`.

→ En attente de validation avant implémentation de la Phase 2.
