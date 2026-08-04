# Phase 7.1 — Framework UI des documents commerciaux

## Objectif
Framework UI générique et réutilisable pour **rendre les 9 documents commerciaux** (5 ventes + 4 achats) à partir d'**une seule configuration, une liste et un éditeur** — sans duplication de la logique métier du moteur Phase 6, en réutilisant le design system existant (shadcn/ui, i18n fr/ar/en, RTL/LTR, responsive, a11y).

## Décision d'architecture
**Aucune page indépendante par type de document.** Chaque document est décrit par une **configuration déclarative** (`DocumentUiConfig`) ; liste et éditeur sont des composants uniques pilotés par cette config. Le moteur Phase 6 reste la seule source de logique métier (calculs, transitions, conversion) ; le framework ne fait que l'afficher et l'appeler via l'API.

## Contraintes respectées
- Réutilisation du moteur : imports client-safe uniquement (`engine/types`, `engine/config`, `engine/calculation`, `generated/prisma/enums`). **Jamais `engine/index.ts`** côté client (pulls `NextResponse` via `service.ts`).
- Zéro calcul métier dans les composants : les totaux affichés proviennent des valeurs calculées par le serveur ; `computeAllLines` n'est utilisé que pour la **prévisualisation** des lignes en édition (arrondi 2 décimales identique au moteur).
- Design system existant : `ui/badge`, `ui/button`, `ui/card`, `ui/checkbox`, `ui/dialog`, `ui/input`, `ui/label`, `ui/popover`, `ui/scroll-area`, `ui/select`, `ui/separator`, `ui/table`, `ui/tabs`, `ui/textarea`, `feedback/spinner`, `page/page-header`, icônes `material-symbols-outlined`.
- i18n : toutes les chaînes via `t()` (fr/ar/en), RTL natif, formatage localisé (`ar-DZ` pour l'arabe).

## Structure de dossiers

### Framework (`src/features/documents/framework/`) — couche de présentation, client-safe
| Fichier | Rôle |
|---------|------|
| `ui-types.ts` | `DocumentUiConfig` (type, category, icon, accent, partyLabelKey, listColumns, toolbarActions, allowedConversions, printFormat, showValidUntil), `DocumentRow`, `DocumentLineModel`, `DocumentDetailModel`, `AttachmentItem`, `RelationItem`, `ListResult`, `TransitionsResult`, `EditorPermissions` |
| `ui-config.ts` | Les 9 configurations déclaratives (icônes, accents vente/achat, conversions autorisées) + helpers `getUiConfig`, `getSalesDocTypes`, `getPurchasingDocTypes`, `docTypeSlug`, `parseDocTypeParam` |
| `status-meta.ts` | `STATUS_ORDER` + `STATUS_META` (variante de badge / pastille par statut) |
| `normalize.ts` | Normalisation serveur → modèles UI (`normalizeDocumentRow`, `normalizeDocumentDetail`, `normalizeLine`, `normalizeAttachment`, `normalizeRelation`) via `partyField` |
| `api.ts` | Client API typé : list/get/create/update/delete, transitions, approve, relations, historique, conversion, pièces jointes (upload/list/delete) |
| `index.ts` | Barrel exports + `ListParams` |

### Composants (`src/components/documents/`)
| Fichier | Rôle |
|---------|------|
| `document-status-badge.tsx` | Badge de statut (STATUS_META + `t(status.X)`) |
| `document-type-badge.tsx` | Icône + badge du type via config (accent + `t(docTypes.X)`) |
| `document-convert-dialog.tsx` | Dialogue de conversion (sélection cible depuis `allowedConversions`, gère `ALREADY_CONVERTED`) |
| `document-list.tsx` | **Liste générique** : recherche debounce 400ms, filtre statut (STATUS_ORDER), filtres sauvegardés (localStorage `dzerp.documents.filters.${type}`), visibilité colonnes, export CSV (BOM, `;`), sélection + actions groupées (approuver/rejeter/annuler/supprimer), duplication, conversion, pagination (10/20/50), permissions via `useCompany()` |
| `document-editor-context.tsx` | **Provider éditeur** : état (header, lignes, dirty, busy), totaux en prévisualisation, actions `save`/`refresh`/`applyStatus`, permissions résolues, lookups (parties, devises, unités, taux TVA) |
| `document-editor-shell.tsx` | Assemblage de l'éditeur (workflow + header + tabs + sidebar) |
| `document-workflow-bar.tsx` | Actions workflow : transitions autorisées (GET /status), enregistrer, convertir, dupliquer, imprimer — permissions `documents.*` |
| `document-header.tsx` | En-tête générique : numéro (lecture), statut, succursale, client/fournisseur (selon `partyField`), devise, taux de change, date, notes |
| `document-line-editor.tsx` | Grille de lignes éditable : sélecteur de produit (popover + recherche, prix selon category vente/achat), type (PRODUCT/SERVICE/COMMENT/SECTION), unité, qté, PU HT, remise %, TVA %, montants en lecture (preview calcul), duplicate/monter/descendre/supprimer, raccourcis (Entrée = nouvelle ligne, Ctrl+Entrée = enregistrer) |
| `document-totals-panel.tsx` | Totaux (sous-total HT, remise, TVA, total TTC) en **lecture seule** |
| `document-tabs.tsx` | Onglets paresseux : Lignes, Notes, Pièces jointes, Historique, Commentaires |
| `document-sidebar.tsx` | Informations (créé/modifié par), statistiques, documents liés, historique de conversion |
| `document-history.tsx` | Frise chronologique (création + conversions via relations) |
| `document-attachments.tsx` | Pièces jointes : upload (multipart `/api/upload`), liste, suppression (scopée), téléchargement `/api/files/[...key]` |
| `document-comments.tsx` | Commentaires (UI locale ; persistance reportée au module notifications) |

### Pages génériques (`src/components/documents/pages/`) — serveur
| Fichier | Rôle |
|---------|------|
| `document-list-page.tsx` | Page serveur : `requirePermission("documents.read")`, charge `listDocuments` via le moteur, normalise, rend PageHeader + `DocumentList` |
| `document-editor-page.tsx` | Page serveur : `requirePermission` (read ou create), charge le détail (si `docId`) + lookups serveur (parties via `listCustomers`/`listSuppliers`, devises/unités/taux TVA via settings), rend `DocumentEditorShell` |

### Routes (`src/app/(app)/documents/[type]/`)
| Route | Contenu |
|-------|---------|
| `/documents/[type]` | Liste générique du type (param validé par `parseDocTypeParam`, sinon `notFound()`) |
| `/documents/[type]/nouveau` | Création |
| `/documents/[type]/[id]` | Consultation / édition (brouillon éditable) |

### API ajoutée
`src/app/api/documents/[id]/attachments/route.ts` — GET (liste FileAsset scopée company+entity+entityId), DELETE (`attachmentId` + vérification propriété + audit). L'upload réutilise `/api/upload` existant (`entity`/`entityId`).

### i18n (`src/i18n/dictionaries.ts`)
- `status` : + PENDING_APPROVAL, APPROVED, CONFIRMED, PARTIALLY_PROCESSED, PROCESSED, CLOSED (fr/ar/en).
- `documentsUI` (fr/ar/en, ~120 clés) : liste, colonnes, export, sélection/actions groupées, éditeur (champs, lignes, totaux), workflow, pièces jointes, commentaires, sidebar, historique, pagination (`prev`/`next`/`of`/`filterName`), `kind.PRODUCT/SERVICE/COMMENT/SECTION`, `confirmTransition`.

## Vérifications qualité
| Check | Résultat |
|-------|----------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npm run lint` | ✅ 0 errors (1 warning pré-existant « incompatible-library » TanStack, non corrigeable) |
| `npm run build` | ✅ Compiled successfully — 3 routes génériques enregistrées |

## Points d'attention
- **Imports client-safe** : ne pas importer `@/features/upload/storage` dans les composants client (pulls `node:fs/promises`) — l'URL `/api/files/[...key]` est reconstruite localement (`attachmentUrl`).
- `window.confirm` utilisé pour les confirmations (aligné sur la liste) ; un dialogue de confirmation réutilisable reste un item 7.2.
- Le toast de succès réutilise `documentsUI.saved` (générique) ; `DocumentConvertDialog.onConverted` reçoit `(target, "")` car l'API de conversion renvoie `relationId/sourceNumber` (pas le targetId).
- `data-table.tsx` (TanStack) existe mais n'est pas utilisé par la liste générique (implémentation serveur maison sur `ui/table`) ; reste disponible pour les grilles internes futures.

## Travail restant — Phase 7.2 (hors périmètre 7.1)
1. **Brancher /ventes et /achats** : pages de catégories (encapsulent les types via `getSalesDocTypes`/`getPurchasingDocTypes`), navigation par carte, et aliasing vers `/documents/[type]` (nav-config déjà prête).
2. **Dialogue de confirmation réutilisable** (remplacer `window.confirm`) — composant `ui/confirm-dialog`.
3. **Commentaires persistants** : stockage serveur (modèle + API) branché au module notifications ; l'UI 7.1 est prête (hint affiché).
4. **Éditeur — champs avancés** : commercial (`issuedById`, `validUntil`) — nécessite extension de `UpdateDocument`/`InputDocument` du moteur (respect strict « backend first »).
5. **Attachments** : drag-and-drop natif sur la zone, multi-type d'entité.
6. **Impression / PDF** : print stylesheet complet + gabarits (Phase 8).
7. **Rapports** : statistiques par statut/type (bandeau de la liste).
