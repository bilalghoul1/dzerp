# Phase 8 — Impression & PDF

Statut : **TERMINÉ — audit complet (51 vérifications) + E2E HTTP (15 vérifications) verts.**

Référence pré-audit : [`pre-audit.md`](./pre-audit.md) (état antérieur : phase absente, 1 🟡 / 5 🟡 / 8 ❌).

## 1. Verdict global

La Phase 8 est désormais **complète et vérifiée** :

- Moteur PDF serveur déterministe (aucune ressource externe, aucun navigateur headless).
- Template engine pour les **9 types de documents** commerciaux, formats **A4 / A5 / THERMAL**, multi-pages, en-tête/pied de page répétés et numérotés.
- Typographie **latin + arabe (RTL)** via fontkit (Amiri + Inter) avec composition arabe des ligatures et cmap ToUnicode — le texte arabe reste copiable/extractible.
- **Preview, Téléchargement et Impression partagent exactement le même pipeline** serveur (`printDocument()`), seul le `Content-Disposition` diffère.
- Branding société (logo, tampon, signature, couleurs, mentions) résolu de manière **isolée par société** (scoping `FileAsset`).
- Routes API protégées (`documents.read`), échec-fermé multi-société, en-têtes de sécurité.

## 2. Architecture

Pipeline unique, orchestré par `printDocument()` dans `src/features/print/service.ts` :

```
GET /api/documents/[id]/preview|pdf  (disposition inline|attachment)
        │  apiGuardWithContext("documents.read") → runScoped
        ▼
printDocument({ docId, companyId, locale })
        │  1. resolveDocType → résout le type (ou ?type=)
        │  2. mapToPrintableDocument → DTO print (scopé société)
        │  3. buildLabels → libellés localisés (fr/ar/en)
        │  4. PdfEngine.create(format, margins, rtl, header, footer)
        │  5. renderPrintableDocument → templates par type
        ▼
        pdf bytes (Uint8Array) → NextResponse (application/pdf)
```

Preview (`/preview`, inline), Téléchargement (`/pdf`, attachment) et Impression (bouton → `window.print()` sur le PDF inline) consomment **le même code** : rendu garanti identique.

### Modules

| Fichier | Rôle |
|---------|------|
| `service.ts` | Orchestration du pipeline, `printDocument()`, `buildLabels()`. |
| `renderer.ts` | Moteur PDF (pdf-lib) : formats, marges, RTL, flux de texte, images, en-têtes/pieds, garde de boucle multi-pages. |
| `templates.ts` | Templates des 9 types, en-tête courant, pied de page, blocs parties/bank, tableau de lignes, mentions. |
| `map-document.ts` | Mapping DB → DTO print (`PrintableDocument`), include fiables, échec 404/403 multi-société. |
| `fonts.ts` | Chargement Amiri/Inter (fontkit), cache par octets, composition arabe, `splitRuns` lat/ar. |
| `registry.ts` | Configuration print par type de document (libellés, parties, disposition). |
| `company-branding.ts` | Résolution des actifs société (logo/tampon/signature) scopés `FileAsset`. |
| `format.ts` | Formatage nombres/monnaies/dates selon locale et devise. |
| `table.ts` | Composition du tableau de lignes (colonnes, largeurs, sauts de page). |
| `types.ts` | Types du domaine print (`PrintableDocument`, `PrintLabels`, …). |

## 3. Stratégie de polices

- **Inter** (Regular/Bold/Italic/BoldItalic) pour le latin, **Amiri** (Regular/Bold) pour l'arabe, chargées depuis `assets/fonts/` via **fontkit** (subsetting + embedding pdf-lib).
- Cache au niveau module **par octets** : une seule empreinte `embedFont` par police et par document ; coût dominant amorti entre documents.
- `assertFontsAvailable()` vérifie la présence des polices avant rendu.
- Composition arabe : `shapeArabicForRender`/`shapeArabicText` (lettres init/médianes/finales, ZWNJ), `splitRuns` découpe les segments latins/arabes pour un directionnel correct.
- Cmap **ToUnicode (bfchar)** : les glyphes composés reviennent en **Arabic Presentation Forms** (`\uFB50`–`\uFDFF`, `\uFE70`–`\uFEFF`), donc le texte arabe est copiable et vérifiable à l'extraction.
- Glyphes non couverts (ex. CJK) : rendu sans échec (espaces de substitution), jamais d'exception.

## 4. Moteur de rendu (`renderer.ts`)

- Formats : `A4` (595.28 × 841.89 pt), `A5` (419.53 × 595.28), `THERMAL` (226.77 × 841.89) avec marges dédiées par format.
- RTL : activé via `rtl: locale === "ar"`.
- En-tête courant et pied de page rappelés à **chaque page**, pied centré sur le centre réel de la page (correction : `(contentLeft + contentRight) / 2`).
- Multi-pages : garde anti-boucle (`MAX_PAGES`), sauts de tableau propres, numérotation.
- Images : `embedImage` **attend** `embedPng`/`embedJpg` dans le `try` (`return await`) — une image corrompue est ignorée gracieusement au lieu de faire planter le rendu.
- `wrap`/`drawText` : césure, largeur disponible, alignement LTR/RTL.

## 5. Templates (9 types)

`QUOTATION`, `SALES_ORDER`, `DELIVERY_NOTE`, `INVOICE`, `CREDIT_NOTE`, `PURCHASE_REQUEST`, `PURCHASE_ORDER`, `GOODS_RECEIPT`, `SUPPLIER_INVOICE` — tous rendus en A4 mono-page **et** multi-page, plus THERMAL et A5 (audit §2).

Blocs composés : en-tête société (nom, identifiants RC/NIF/NIS/AI, adresse, contact), bloc parties (client/fournisseur + refs), tableau de lignes (Qté, PU, remise, TVA, HT/TTC), totaux, mentions légales, pied de page (format de papier, devise, « de votre confiance » par société).

## 6. Branding société & actifs

- `Company.logoKey` / `stampKey` / `signatureKey` pointent vers des `FileAsset` **scopés société** (`companyId`).
- La résolution (`company-branding.ts`) requiert un `where` explicite `{ companyId, storageKey }` : aucun actif ne peut fuiter vers une autre société (vérifié à l'audit §4/§6).
- Couleurs `primaryColor`/`secondaryColor` et mentions `invoiceFooter`, `paymentTerms` par société.

## 7. API

| Route | Disposition | Permission |
|-------|-------------|------------|
| `GET /api/documents/[id]/preview?type=&locale=` | `inline` | `documents.read` |
| `GET /api/documents/[id]/pdf?type=&locale=` | `attachment` | `documents.read` |

- `type` optionnel (résolution auto sinon), `locale` optionnel (fr/ar/en, i18n serveur sinon).
- En-têtes : `Content-Type: application/pdf`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`.
- Échecs : 401 non authentifié, 403 membre sans permission ou hors société, 404 document introuvable/hors société (échec-fermé **avant** le check 403).

## 8. Intégration UI

- `document-preview-dialog.tsx` : aperçu PDF inline (iframe) + impression navigateur (`window.print`).
- `document-workflow-bar.tsx` : actions Aperçu / Télécharger PDF / Imprimer branchées sur le pipeline.
- Aucune action print sur Dashboard / Recherche globale / Quick Create (règle projet).

## 9. Sécurité & isolation multi-société

- Scoping strict (`runWithCompanyContext`/`apiGuardWithContext`, `src/lib/db/company-scope.ts`) ; tout `findFirst` d'actif requiert un `companyId` explicite.
- Document d'une autre société → « introuvable » (404) avant tout détail.
- Rendu 100 % serveur et hors-ligne : aucun appel réseau, aucune donnée client exposée dans le flux.
- Images : MIME/extension contrôlés à l'upload, fichiers corrompus ignorés au rendu.

## 10. Performance

- Audit §7 : rendu A4 mono-page **~1448 ms** en moyenne (3 échantillons) — sous le seuil de 5 s.
- Polices mises en cache par octets ; une seule empreinte `embedFont` par police/document.

## 11. Résultats d'audit

| Section | Périmètre | Résultat |
|---------|-----------|----------|
| 1 | Système de polices (ar, lat, bilingue, CJK) | ✓ |
| 2 | Templates (9 types × A4 mono/multi + THERMAL + A5 + cas limites) | ✓ |
| 3 | RTL / LTR | ✓ |
| 4 | Images (logo, tampon corrompu, signature) | ✓ |
| 5 | Sécurité (lien, injection, chemins) | ✓ |
| 6 | Isolation multi-société (Alpha/Beta) | ✓ |
| 7 | Performance | ✓ |
| 8 | Validation PDF (pdf.js, 12 PDF) | ✓ |

**Audit : `OK : 51 vérifications passent.`** (exécution ≈ 67 s)

**E2E HTTP (`scripts/e2e-http.ts`, serveur `next start` + session signée réelle) : `OK : 15 vérifications passent.`** — preview inline FR/AR, Content-Type/Disposition, PDF valide pdf.js, numéro + pied de page présents, arabe composé extrait, résolution auto du type, download attachment, 401 non authentifié, 404 autre société, 403 sans permission.

## 12. Scripts

| Script | Rôle |
|--------|------|
| `scripts/print-audit.ts` | Audit complet (51 vérifications). |
| `scripts/print-smoke.ts` | Smoke (7 cas) + export `mockDoc`. |
| `scripts/print-corrupt-check.ts` | Régression image corrompue (crash). |
| `scripts/e2e-http.ts` | E2E HTTP réel (serveur + cookies + PDF). |
| `scripts/print-glyph-check.ts`, `print-debug.ts`, `font-perf.ts` | Diagnostics ponctuels. |

Exécution : `npx tsx scripts/print-audit.ts` / `npx tsx scripts/e2e-http.ts` (nécessite build : `npm run build`).

## 13. Limitations connues & extensibilité

- **QR / code-barres** : les préférences `Company.qrEnabled` et `Setting.documents.qr.enabled` existent mais aucun QR n'est encore composé (aucune lib QR embarquée) — point d'extension naturel de `templates.ts`.
- **`nameAr` non utilisé pour l'en-tête** : le template compose `company.name` (latin ou arabe selon la valeur saisie) ; `nameAr` est persistant mais pas encore rendu automatiquement en locale `ar`.
- **Glyphes CJK non couverts** : rendus en espaces de substitution (jamais d'échec) ; extension = ajout d'une police CJK dans `fonts.ts`.
- **Formats fixes** : A4/A5/THERMAL ; un format personnalisé impliquerait d'étendre la table `FORMATS` de `renderer.ts`.
- **Une seule langue active par rendu** : la locale contrôle RTL + libellés ; un document réellement bilingue sur une même page reste à faire (le moteur gère déjà les runs mixtes lat/ar).
