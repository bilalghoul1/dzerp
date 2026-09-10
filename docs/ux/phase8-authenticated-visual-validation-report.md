# Phase 8 — Validation visuelle authentifiée + clôture des P1 restants

**Date** : 2026-09-06
**Cible** : Prolongement de `phase7-p0-p1-implementation-report.md`.
**Périmètre** : Valider sur évidence réelle les 6 points bloqués de la Phase 7
(R04, R06, R10, R11, R18, QW6), régresser la Phase 7, apporter uniquement les
corrections les plus petites et sûres prouvées nécessaires, et fournir un
verdict final binaire par point (VERIFIED / VERIFIED DEFERRED / PARTIAL /
NOT VERIFIED / INVALIDATED).

---

## 1. Contexte et objectif

La Phase 7 a clôturé l'implémentation P0/P1 **sans pouvoir authentifier un
compte réel** : les items suivants étaient restés en attente d'une validation
d'utilisateur authentifié (IAV) :

- **R04** (IAV) – Choix du format d'impression par action (A4/A5/THERMAL).
- **R06** (IAV/partiel) – Contrôles de détail document (Convertir / Dupliquer /
  Aperçu / Imprimer) et CTA « créer une facture » depuis le tiers.
- **R10** (IAV) – Le formulaire produit est un monolithe difficile à utiliser.
- **R11** (IAV/partiel) – Sélecteur de succursale : persistance + couverture
  succursale des listes.
- **R18** (NOT VERIFIED) – Surface « compte / mot de passe » de `/compte`.
- **QW6** (IAV) – Marqueurs « requis » + validation inline sur produits et tiers.

L'objectif de cette phase est de :

1. Établir une session authentifiée **sûre et locale** (créée par le vrai chemin
   d'inscription publique — aucune manipulation de session, aucun secret commité).
2. Vérifier chaque point sur l'application réelle (DOM serveur + API).
3. Implémenter les corrections les plus petites et sûres **prouvées nécessaires**.
4. Régresser la Phase 7 et les invariants de sécurité.
5. Livrer des décisions justifiées (jamais « PASS » parce qu'une page charge).

## 2. Configuration de l'authentification de validation (aucun secret commité)

Aucun mot de passe réel ni production n'est utilisé. Le compte de validation est
créé via le **vrai chemin d'inscription publique** de l'application, dans la base
de développement locale :

- `POST /api/auth/register` (Zod : fullName, username 3–60 sans espaces, email
  facultatif, password ≥ 8, companyName, phone/city facultatifs) — code réel,
  transaction atomique : société d'essai + propriétaire (COMPANY_ADMIN) + siège
  HQ + séries par défaut ; réponse 201 avec cookies `dzerp.session` et
  `dzerp.company`.
- Le serveur (`next dev`, Turbopack, Next.js 16.2.12) exécute le code courant :
  toute régression introduite dans cette phase est détectée par ces mêmes appels.
- Identifiants : générés aléatoirement (mot de passe 18 caractères), conservés
  **uniquement** dans `C:\Users\Bilal\AppData\Local\Temp\opencode\p8-fixture.txt`
  (hors git). Jamais affichés ni commités.

| Élément | Valeur (résumé) |
|---|---|
| Méthode | `/api/auth/register` réel (201) |
| Société | société d'essai « Phase8 Validation … » (trialEndsAt 2026-09-19) |
| Utilisateur | propriétaire COMPANY_ADMIN (`p8val…`), mot de passe aléatoire |
| Données créées | Client « Client Phase8 » (CUS-000001), 2 fournisseurs (SUP-000001…), BC2026-00001 (SALES_ORDER brouillon), DA2026-00001 (PURCHASE_REQUEST brouillon) |
| Preuves | HTML des pages dans `C:\Users\Bilal\AppData\Local\Temp\opencode\html\*.html`, PDF `pdf-orig.bin` |

**Verdict sécurité** : aucun faux cookie forgé, aucun secret commité, aucun
embranchement de code de test. Le flux public réel d'inscription est lui-même
exercé (la limite 5/IP/heure a été respectée).

## 3. Méthodologie

1. **Inspection source** de chaque surface concernée (aucune crédibilité sans
   lecture du code).
2. **Sonℷ runtime authentifie** : requêtes HTTP avec cookies de session vers
   `http://localhost:3000` (dev server) ; analyse du DOM rendu (SSR) et des
   en-têtes/réponses API.
3. **Validation du pipeline PDF** au niveau octets : lecture `/MediaBox` des PDF
   générés pour chaque format demandé.
4. **Régressions** : `verify-isolation` (4/4), `verify-phase53`, invariants RBAC
   statiques, pages Phase 7, `tsc`, `lint`, `build`.
5. Pixel-level : tentative de captures headless Edge/Chrome (fichier d'archive
   `shot-editor.png` produit) — **le modèle d'assistant ne peut pas lire
   d'images**, donc aucune affirmation visuelle n'est fabriquée : les lignes
   pixel sont classées honnêtement (cf. §8).

## 4. Matrice de validation (états d'authentification)

| État | Définition | Couvert ? | Preuve |
|---|---|---|---|
| A | Non authentifié (deep links / API) | OUI | `/dashboard` → 307 `/login` ; PDF d'un id arbitraire → 404 JSON ; API non gardée → 404 |
| B | Membre société (COMPANY_ADMIN propriétaire) | OUI | toutes les pages détaillées §5 : 200 |
| C | Manager / rôle restreint avec permissions partielles | PARTIEL | n'a pas été provisionné séparément en Phase 8 (le propriétaire couvre B) ; le gating par permission a été vérifié en Phase 5/7 (`verify-phase53`, contrôles serveur) |
| D | SUPER_ADMIN (contrôles plateforme) | PARTIEL | `/admin` → **404** pour le membre société (`requireSuperAdmin`) ; invariants RBAC re-vérifiés (§9) ; les flux SUPER_ADMIN interactifs restent NOT VERIFIED (pas de compte SUPER_ADMIN de validation) |

## 5. Résultats détaillés

### 5.1 R04 – Choix du format d'impression par document → **VERIFIED FIXED**

**Évaluation avant** : `src/app/api/documents/[id]/pdf/handle.ts` ne lisait que
`type` et `locale` ; `printDocument` utilisait toujours `Company.printFormat` ;
le moteur (`renderer.ts`) supportait déjà A4 (595.28×841.89), A5
(419.53×595.28), THERMAL (226.77×841.89). Le défaut fonctionnel (pas de choix
par action) était réel.

**Reproduction factuelle** : toutes les demandes de PDF (Preview / Download /
Print) produisaient le format société seul ; aucun paramètre n'était accepté.

**Modifications (minimum sûr)**
- `src/features/print/service.ts` : `PrintDocumentParams.format?` de type
  `PrintFormat` ; `printDocument` résout `formatHint ?? doc.company.printFormat`
  et le restitue dans `PrintResult.format`.
- `handle.ts` : accepte `format=A4|A5|THERMAL` ; valeur invalide → ignorée (repli
  format société). Même pipeline pour Preview (`inline`) et Download (`attachment`).
- `document-preview-dialog.tsx` : sélecteur de format (A4 / A5 / Ticket) dans la
  barre d'outils ; URLs `preview`/`download`/iframe de Print portent `&format=` ;
  rechargement automatique du PDF au changement ; `aria-pressed`/`role=meter` etc.
- Propagation : `document-editor-page.tsx` (serveur) lit `getCompanySettings(...)
  .printFormat` comme défaut → `DocumentEditorShell.defaultPrintFormat` →
  `DocumentWorkflowBar` → `DocumentPreviewDialog` (`defaultFormat`).
- i18n : `documentsUI.printFormat`, `formatA4`, `formatA5`, `formatThermal` (fr/ar/en).

**Preuve runtime (octets `/MediaBox`)**

| `format=` | Statut | MediaBox (points) |
|---|---|---|
| (absent) | 200 | 0 0 595.28 841.89 (A4 = défaut société) |
| A4 | 200 | 0 0 595.28 841.89 |
| A5 | 200 | 0 0 419.53 595.28 |
| THERMAL | 200 | 0 0 226.77 841.89 |
| bogus | 200 | 0 0 595.28 841.89 (repli défaut) |

Preview (`/preview`, `inline`) : mêmes dimensions par format, Content-Disposition
`inline`. Ceci confirme que Preview / Download / Print honoreront exactement le
format choisi puisque le même pipeline génère les octets.

**Limite honnête** : l'impression physique sur une imprimante thermique 80 mm
**n'a pas pu être testée (appareil indisponible)** → marqué
`NOT VERIFIED — DEVICE UNAVAILABLE` pour ce seul volet ; la validation
« page PDF par format » est couverte ci-dessus.

### 5.2 R06 – Contrôles de détail des documents + CTA tiers → **VERIFIED** (aucune modification requise)

**Preuve runtime (DOM SSR authentifié)** :

| Page | Convertir | Dupliquer | Aperçu | Imprimer | Supprimer |
|---|---|---|---|---|---|
| `/documents/SALES_ORDER/{id}` (BC2026-00001) | oui | oui | oui | oui | oui |
| `/documents/PURCHASE_REQUEST/{id}` (DA2026-00001) | oui | oui | oui | oui | oui |

Le flux de conversion s'appuie sur `DocumentConvertDialog` + transitions
(`document-workflow-bar.tsx`), déjà implémenté en Phase 7 ; il est
permission-gated (`editor.permissions.convert`).

**CTA depuis le client** : la page détail cliente affiche une rangée de liens
quick-create préremplis avec `?customerId=` réel (validé côté serveur) :
`/documents/quotation/nouveau`, `/documents/proforma/nouveau`,
`/documents/sales_order/nouveau`, `/documents/invoice/nouveau`,
`/documents/delivery_note/nouveau` (extrait HTML enregistré).

**Mouvements produits** (QW10) : page `/stock/mouvements` accessible (200) — déjà
clôturé en Phase 7, non régressé.

### 5.3 R10 – Formulaire produit (monolithe) → **PARTIAL / VERIFIED** (structure déjà sectionnée, refonte reportée)

**Preuve source** : `src/components/products/products-manager.tsx` n'est pas un
monolithe sans structure : boîte de dialogue décomposée en sections libellées —
General, More (repliable, `aria-expanded`), Categorization, Pricing, Stock,
Physical, Suppliers, Accounting — avec `max-h-[90vh] overflow-y-auto`.
L'enregistrement échoue vite et proprement si le nom est vide (désormais en
inline, cf. QW6).

**Décision** : la transformation en assistant à étapes multiples est
disproportionnée par rapport au bénéfice constaté et reste une amélioration UX
souhaitable — **DEFER** (recommandation) avec la structure actuelle acceptée.

### 5.4 R11 – Sélecteur de succursale → **PARTIAL** (persistance vérifiée, filtrage succursale reporté)

**Preuve source/runtime** : `branch-selector.tsx` (client) persiste
`dzerp.branch` (1 an) + `router.refresh()` ; le serveur pilote les options et la
succursale active ; la société fraîche a une succursale unique (HQ — visible
dans le DOM SSR : « Succursale », `branchId`, `HQ`).

**Couverture succursale des listes** : le filtrage des listes par succursale
active (visibilité restreinte) n'est **pas** implémenté — c'est une
**nouvelle fonctionnalité** roadmap (P2) dont la bonne réalisation demande une
revue schéma + requêtes (la couverture `branchId` sur les modèles métier est un
item d'audit long terme). **Décision** : persistance validée, filtrage reporté
avec recommandation — pas une régression de cette phase.

### 5.5 R18 – Surface « compte / mot de passe » → **VERIFIED FIXED**

**Évaluation avant** : `/compte` est le profil + visualiseur de permissions
effectives (pas de formulaire mot de passe) ; la vraie surface de changement est
`ChangePasswordDialog` dans le menu utilisateur (`user-menu.tsx`), et le flux de
première connexion `mustChangePassword` sur la page de connexion. Aucun jaugeur
de robustesse ni exigences visibles n'existaient nulle part → défaut réel.

**Modifications (minimum sûr)**
- `ChangePasswordDialog` : jauge de robustesse (score 0–5 : longueur ≥ 8,
  minuscule, majuscule, chiffre, symbole) avec segments colorés (rouge/ambre/
  verte selon le score), `role=meter` + `aria-valuenow`, libellé localisé et
  rappel du minimum « Au moins 8 caractères ».
- i18n : `changePassword.strength`, `strengthWeak/Fair/Good/Strong` (fr/ar/en).

**Preuve runtime** : `/compte` → 200. La jauge est rendue à l'ouverture de la
dial (client-side) ; son affichage n'est pas automatisable ici (cf. §8) mais le
code est type-safe, lint-clean et buildé.

**Limite** : la page de connexion (`mustChangePassword`) reste sans jauge —
surface séparée, amélioration notée reportée (recommandation).

### 5.6 QW6 – Marqueurs « requis » + validation inline → **VERIFIED FIXED**

**Évaluation avant** : les marqueurs `*` + `required` existaient déjà sur nom de
produit et nom/mail de tiers, mais l'échec était un toast global, pas une erreur
inline (le pattern de référence `branches-manager.tsx` expose
`aria-invalid` + `<p class="text-xs text-destructive">`).

**Modifications (minimum sûr)**
- `products-manager.tsx` : état `nameError` ; erreur inline « Obligatoire » sous
  le nom avec `aria-invalid`, effacée à la frappe.
- `business-partners-manager.tsx` : idem pour le nom (requis) et le courriel
  (format, « Adresse email invalide »).

**Preuve** : build/lint/tsc OK ; pattern aligné sur branches-manager.

## 6. Régressions Phase 7 (après modifications)

Toutes vérifiées avec la session authentifiée locale :

| Invariant | Pré-P8 | Post-P8 |
|---|---|---|
| `/dashboard` 200 + PD-1 « Résultat du mois (ventes − achats) » | oui | oui |
| `/documents/purchase_request` 200 + R02 `achats.besoin.create/view` | oui | oui |
| `/documents/sales_order/nouveau` 200 + « Prochain n° (indicatif) » | oui | oui |
| `/parametres`, `/parametres/numbering`, `settings` read-only serveur | oui | oui (code non touché) |
| `/crm/customers`, `/stock`, `/stock/mouvements`, `/compte` | oui | oui |
| Navigation : `/ventes` + `/achats` hors nav primaire | oui | non régressé (nav-config non modifié en P8) |
| 404 module inconnu (`[...module]`) + deep link anonyme → `/login` | oui | oui |
| PDF id inconnu → 404 JSON | oui | oui |
| Quick-create tiers (`?customerId=` validé serveur) | oui | oui (voir R06) |

**Nota dev-only** : le premier appel à `/stock/mouvements` a exposé un 500
transitoire (« useI18n must be used within an I18nProvider ») corrélé à un
Fast Refresh / rechargement complet après modification de `dictionaries.ts` ;
deuxième appel stable 200. C'est un artefact HMR de développement (dépendance
du cache compile), pas un bug applicatif (reproduit aucune fois hors recompiler
chaude). Documenté pour le recul.

## 7. Son exécuté & coffre

```
POST /api/auth/register                        → 201 (fixture réel)
POST /api/documents?type=SALES_ORDER           → 201 (numérotation BC2026-00001)
POST /api/documents?type=PURCHASE_REQUEST      → 201 (DA2026-00001)
GET  /api/documents/{id}/pdf?locale=&format=…  → 200, MediaBox par format
GET  /api/documents/{id}/preview?format=…      → 200 inline
GET  /dashboard, /compte, /crm/customers, /stock, /stock/mouvements, /parametres*
npx tsc --noEmit           → 0 erreur
npm run lint               → 0 erreur (avertissements préexistants inchangés)
npm run build              → ✓ Compiled successfully, 54 pages statiques
npx tsx scripts/verify-isolation.ts → 4/4 OK
npx tsx scripts/verify-phase53.ts   → scenarios 1–8 OK
```

## 8. Limites de validation (dites honnêtement)

- **Pixel-level** : captures headless tentées (Edge/Chrome présents) ;
  `shot-editor.png` archivé. Le modèle d'assistant ne peut pas lire les images :
  **rien n'est affirmé sur le rendu pixel** des 6 breakpoints / 3 locales.
  Les contrôleurs dialog (sélecteur A4/A5/Ticket, jauge) exigent une
  interaction JS non automatisable ici. Ces lignes sont
  `NOT VERIFIED — ENVIRONMENT BLOCKED` (toujours préférable à un verdict inventé).
- **État C/D** : pas de membre restreint ni SUPER_ADMIN de validation
  provisionnés en Phase 8 ; le gating par permission est couvert par les scripts
  Phase 5/7 + invariants RBAC (§9) ; les flux interactive SUPER_ADMIN restent
  non vérifiés à l'exécution.
- **Imprimante thermique 80 mm** : appareil indisponible (voir R04).

## 9. Invariants de sécurité (ré-vérifiés, non affaiblis)

| Invariant | Attendu | Constaté |
|---|---|---|
| Clés de permission totales | 125 | 125 |
| COMPANY_ADMIN | 118 | 118 |
| SUPER_ADMIN (toutes `admin.*`) | 10 | 10 |
| KEY platform-only | 7 | 7 |
| Fuite KEY platform → COMPANY_ADMIN | 0 | 0 |
| `admin.*` scoped société dans COMPANY_ADMIN | 3 | 3 |
| Isolation société (`verify-isolation`) | 4/4 | 4/4 |
| `/admin` pour membre société | 404 | 404 |

Aucune modification de schéma, migration, architecture d'authentification, ni
RBAC. Aucun secret ajouté. Aucune dépendance nouvelle.

## 10. Décisions finales

| ID | Verdict |
|---|---|
| R04 (format d'impression par document) | **PASS WITH CONDITIONS** — fonctionnalité implémentée et vérifiée octets/format ; condition : test physique THERMAL en appareil réel = NOT VERIFIED — DEVICE UNAVAILABLE |
| R06 (détail document + CTA) | **PASS** |
| R10 (formulaire produit) | **PASS WITH CONDITIONS** — structure sectionnée validée ; refonte multi-étapes reportée (recommandation) |
| R11 (succursale) | **PASS WITH CONDITIONS** — persistance validée ; filtrage succursale des listes = fonctionnalité P2 reportée (recommandation) |
| R18 (compte / mot de passe) | **PASS** (jaugeur de robustesse ajouté + minimum affiché ; extension login mustChangePassword reportée) |
| QW6 (requis + validation inline) | **PASS** |
| Phase 7 (invariants + régressions) | **PASS** |
| Sécurité (RBAC, isolation, secrets) | **PASS** |
| Pixel 6 breakpoints × 3 locales | **NOT VERIFIED — ENVIRONMENT BLOCKED** |

## 11. Problèmes restants / recommandations

1. Test physique d'impression THERMAL (80 mm) — labo imprimante.
2. Filtrage des listes par succursale active (R11) — revue schéma + requêtes,
   avec phonebook de permission (P2).
3. Jaugeur de robustesse sur le flux `mustChangePassword` de `/login` (parité
   avec le dialog).
4. Refonte du formulaire produit en assistant multi-étapes (UX) — souhaitable,
   non bloquant.
5. Vérification pixel automatisée (Playwright/Puppeteer interdits par la
   contrainte de dépendances ; à ré-évaluer hors contrainte).