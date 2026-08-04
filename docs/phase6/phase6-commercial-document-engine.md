# Phase 6 — Commercial Document Engine

## Objectif
Moteur réutilisable pour les 9 types de documents commerciaux : 5 ventes (Devis, Commande client, Bon de livraison, Facture, Avoir) + 4 achats (Demande d'achat, Commande fournisseur, Bon de réception, Facture fournisseur).

## Décision d'architecture
**Modèles existants conservés** (9 headers + 9 line models) — structure identique, sécurité Prisma. **Toute la logique métier** centralisée dans un moteur partagé (`src/features/documents/engine/`), zéro duplication.

## Fichiers créés / modifiés

### Schema (`prisma/schema.prisma`)
- `DocumentStatus` : +6 valeurs (PENDING_APPROVAL, APPROVED, CONFIRMED, PARTIALLY_PROCESSED, PROCESSED, CLOSED)
- `DocumentLineKind` enum : PRODUCT, SERVICE, COMMENT, SECTION
- `DocumentRelationType` enum : CONVERSION, REFERENCE, CREDIT, AMENDMENT
- 9 headers : +`exchangeRate Decimal @default(1)`, +`meta Json?`
- 9 lines : +`kind DocumentLineKind @default(PRODUCT)`
- `DocumentRelation` model : liens inter-documents avec historique de conversion
- `Company` : +`documentRelations DocumentRelation[]`
- `User` : +`createdDocumentRelations DocumentRelation[]`

### Migration
`prisma/migrations/20260805100000_phase6_document_engine/migration.sql` — appliquée avec succès.

### Engine (`src/features/documents/engine/`)
| Fichier | Rôle |
|---------|------|
| `types.ts` | Types partagés (CommercialDocType, InputDocument, ComputedTotals, StatusTransition, etc.) |
| `config.ts` | Configuration par type : prefix, transitions autorisées, party field, etc. |
| `calculation.ts` | Calcul HT/TVA/TTC par ligne et totaux — gère PRODUCT/SERVICE, ignore COMMENT/SECTION |
| `status.ts` | Transitions de statut, validation, fonctions isTerminal/isActive/canApprove |
| `validation.ts` | Validation des entrées (succursale, client/fournisseur, lignes obligatoires) |
| `workflow.ts` | Orchestration audit + activity lors des changements de statut |
| `conversion.ts` | Conversion inter-documents avec création automatique du target + DocumentRelation |
| `service.ts` | CRUD complet : create, update, delete, get, list, changeStatus, approve |
| `index.ts` | Barrel exports |

### API Routes (`src/app/api/documents/`)
| Route | Méthodes | Permission |
|-------|----------|------------|
| `/api/documents?type=X` | GET (list), POST (create) | documents.read, documents.create |
| `/api/documents/[id]?type=X` | GET, PATCH, DELETE | documents.read, documents.update, documents.delete |
| `/api/documents/[id]/status?type=X` | GET (transitions dispo), PATCH (changement) | documents.read, documents.approve |
| `/api/documents/[id]/relations?type=X` | GET (+ ?history=true pour la chaîne complète) | documents.read |
| `/api/documents/convert` | POST (conversion inter-documents) | documents.convert |

### Permissions (`src/features/auth/permissions.ts`)
7 nouvelles permissions : `documents.read`, `documents.create`, `documents.update`, `documents.delete`, `documents.approve`, `documents.convert`, `documents.print`.

### Scripts
`scripts/add-documents-permissions.ts` — upsert des permissions dans la table Permission + attribution aux rôles ADMIN, COMPANY_ADMIN, MANAGER (toutes) et READER (read + print).

### Autres modifications
- `src/lib/db/company-scope.ts` : +`DocumentRelation` dans COMPANY_SCOPED_MODELS
- `src/features/search/server.ts` : +3 types manquants (CreditNote, PurchaseRequest, GoodsReceipt)
- `prisma/seed.ts` : +`documentRelation.deleteMany()` dans le nettoyage

## Vérifications qualité
| Check | Résultat |
|-------|----------|
| `prisma validate` | ✅ Schema valid |
| `prisma migrate status` | ✅ Up-to-date (14 migrations) |
| `npx tsc --noEmit` | ✅ 0 errors |
| `npm run lint` | ✅ 0 errors (2 warnings pré-existants) |
| `npm run build` | ✅ 5 routes compilées |

## Vérifications runtime
| Test | Résultat |
|------|----------|
| POST /api/documents?type=QUOTATION | ✅ DEV2026-0002 créé, 2 lignes, 80,000 HT / 15,200 TVA / 95,200 TTC |
| GET /api/documents?type=QUOTATION | ✅ 1 élément listé |
| GET /api/documents/[id]?type=QUOTATION | ✅ Détail complet avec customer, branch, lines |
| PATCH /api/documents/[id]/status (DRAFT→PENDING_APPROVAL→APPROVED) | ✅ Transitions fonctionnelles |
| POST /api/documents/convert (QUOTATION→SALES_ORDER) | ✅ BC2026-0001 créé avec totaux + DocumentRelation |
| GET /api/documents/[id]/relations | ✅ Lien CONVERSION tracké |
| POST /api/documents?type=PURCHASE_ORDER | ✅ BCM2026-0001 créé, 100×800 = 80,000 HT |

## Non inclus (spec)
- Écrans workflow ventes/achats (Phase 7+)
- Templates PDF / Impression (Phase 8+)
- Comptabilité / Reports financiers
