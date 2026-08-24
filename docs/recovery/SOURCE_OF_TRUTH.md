# DzERP — SOURCE OF TRUTH (Référentiel unique)

> Ce document est le **référentiel unique et vérifié** du projet DzERP.
> Il rassemble la config, la stack, la BDD, les commandes, le Git, et les décisions
> « source de vérité ». À maintenir à jour ; toute divergence doit être remontée ici.
> **Établi le 2026-08-09 (audit read-only).**

---

## 1. Identité du projet

- **Nom :** dzerp
- **Version :** 0.1.0
- **Type :** ERP web — Next.js App Router (Algérie : législation, devis→facture, RTL fr/ar/en)
- **Localisation :** `C:\Users\Bilal\Desktop\dzerp`

---

## 2. Stack (vérifiée — `package.json`, `npx prisma --version`, `node -v`)

| Outil | Version |
|---|---|
| Node.js | v24.18.0 |
| npm | 12.0.2 |
| Next.js | 16.2.12 |
| React | 19.2.4 |
| Prisma CLI | 7.9.1 |
| @prisma/client | ^7.9.1 |
| @prisma/adapter-pg | ^7.9.1 |
| Langage | TypeScript |
| Auth | Cookies signés HMAC-SHA256, bcrypt |
| Impression | pdf-lib, @pdf-lib/fontkit, naqqash, pdfjs-dist |

> **Source de vérité versions :** `package.json`. Ne pas épingler autrement.

---

## 3. Base de données (SOURCE DE VÉRITÉ)

| Élément | Valeur |
|---|---|
| Provider | PostgreSQL (18.4) |
| Hébergeur | Neon — région `eu-west-2` |
| Base | `neondb` |
| Modèle de connexion | Client runtime : URL **pooled** (`…-pooler.c-2…`, `sslmode=verify-full&channel_binding=verify-full`) |
| CLI Prisma (migrate/studio) | URL **directe** requise (`…c-2….aws.neon.tech`, `sslmode=require`) — cf. §4 |
| Migration state | **18 migrations, 18 appliquées — « up to date »** |

### Schéma (vérifié)
- **59 models, 21 enums** — `prisma/schema.prisma` (source unique).
- Client généré : `src/generated/prisma` (**gitignoré**, régénéré par machine).
- Extensions runtime (`src/lib/prisma.ts`) :
  - `companyScope` — isolation multi-société (listes dans `src/lib/db/company-scope.ts`)
  - `softDelete` — suppression douce
- **Un seul détail non commité :** `User.mustChangePassword Boolean @default(false)`
  + migration `20260808000000_add_must_change_password` (appliquée en base).

### Comptes présents en base (état au 2026-08-09)
- `superadmin` — rôle global `SUPER_ADMIN`, **aucune société** (par conception)
- `admin` — OWNER(DZERP) + ADMIN(MAIN)
- `directeur.oran` — MANAGER(MAIN) · `lecteur` — READER(MAIN)
- **86 permissions** au catalogue ; `Permission`/`RolePermission` en lecture seule.

> ⛔ La base `neondb` est **partagée par les deux machines** : c'est la seule source
> de vérité des données.

---

## 4. Variables d'environnement — `.env`

**Noms (source de vérité) :**
- `DATABASE_URL` — chaîne **pooled** (utilisée par le runtime Prisma/pg)
- `SESSION_SECRET` — secret de signature des cookies

> ⚠️ **Manquant :** `DATABASE_URL_DIRECT` (URL directe Neon). `prisma.config.ts`
> l'utilise en priorité (`DATABASE_URL_DIRECT ?? DATABASE_URL`) ; son absence force
> le CLI Prisma à l'URL pooled → `P1001`. **Ajout recommandé** sur les deux machines.
>
> `package.json` — scripts utiles :
> - `db:bootstrap:super` — crée le Super Admin global (mdp aléatoire, `mustChangePassword`)
> - `db:verify:super`, `db:seed` (⚠️ destructif — recrée le jeu de démo)
> - Dev : `npm run dev`

---

## 5. Commandes vérifiées

| Commande | Résultat |
|---|---|
| `npx prisma validate` | ✅ Schéma valide |
| `npx tsc --noEmit` | ✅ 0 erreur |
| `npx prisma migrate status` (URL directe) | ✅ « Database schema is up to date! » |
| `npx prisma migrate status` (URL pooled) | ❌ P1001 — utiliser l'URL directe |
| `npm run dev` | Serveur Next 16 |

---

## 6. Git — SOURCE DE VÉRITÉ

- **Branche de référence :** `main` (= `origin/main` = `2516aca` « gh »)
- **Remote :** `https://github.com/bilalghoul1/dzerp.git` (origin)
- **Branches distantes :**
  - `origin/PC22` → `0f41781` (divergée, non fusionnée)
  - `origin/company-branch` → `52ec3de` (au-dessus de `main`, non fusionnée)
- **Travail local (Computer A) non commité :** 24 fichiers modifiés (Super Admin,
  `mustChangePassword`, flux plateforme, pages admin/companies) + untracked
  (migration, scripts, `docs/admin`, `docs/debug`).
- **Gitignoré (machine-local, régénéré) :** `/src/generated/prisma`, `/.next/`,
  `/uploads`, `.env*`, `tsconfig.tsbuildinfo`.

> **Politique :** le code de référence est `main` + le diff local de Computer A.
> La base `neondb` est la seule source pour les données. Les deux machines doivent
> converger après commit (cf. plan §25 du rapport d'audit).

---

## 7. Architecture (points de référence vérifiés)

| Domaine | Fichier(s) clés | Source de vérité |
|---|---|---|
| Client Prisma | `src/lib/prisma.ts` | extensions companyScope + softDelete |
| Scoping multi-tenant | `src/lib/db/company-scope.ts` | listes COMPANY_SCOPED / OPTIONAL |
| Session/auth | `src/features/auth/{session,rbac,types,api-guard,permissions}.ts` | cookies HMAC, apiGuard |
| Rôles | `RoleAssignment` (par société) + fallback `UserRole` | table DB |
| Contexte société | `src/features/company/{resolver,context,store,types}.ts` | ALS / React.cache |
| Super Admin | `src/features/company-admin/*` | SUPER_ADMIN global, runUnscoped |
| Document Engine | `src/features/documents/engine/` | 9 types, conversions, DocumentSeries |
| Numérotation | `DocumentSeries` (CAS) | **`Counter` mort** |
| Impression | `src/features/print/service.ts` | pdf-lib + naqqash |
| Seed | `prisma/seed.ts` | ⚠️ destructif |
| Bootstrap Super Admin | `scripts/bootstrap-super-admin.ts` | idempotent, sans UserCompany |
| Docs | `docs/` | phase5→8, admin, debug, ux |

---

## 8. Décisions & conventions (à entériner)

1. **Base de référence Git = `main`.** Les branches `PC22` / `company-branch` doivent
   être arbitrées (fusion ou archivage) — jamais supprimées sans décision.
2. **Source de vérité multi-tenant :** `RoleAssignment` ; `UserRole` = fallback transitoire.
3. **Source de vérité numérotation :** `DocumentSeries` ; `Counter` obsolete.
4. **Source de vérité tiers :** `Customer` / `Supplier` ; `Client` obsolete.
5. **Source de vérité profil société :** colonnes `Company` (lues par print) —
   réconcilier les clés `Setting company.*` (dual-write à résoudre).
6. **Super Admin global** : sans société assignée → shell « plateforme » (fix local à commiter).
7. **Toute suppression** de modèle/champ/colonne doit être précédée d'une décision écrite.
   Interdit : `db push --force-reset`, `migrate reset`, suppression de migrations.
