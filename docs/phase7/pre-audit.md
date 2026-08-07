# Phase 7 — Pre-Audit : Commercial Document UI

Date : 2026-08-05
Méthode : inspection systématique de `src/app/(app)/{ventes,achats,documents}`, `src/components/documents`, `src/features/documents/framework`, `src/features/search`, `src/components/shell` (navigation / quick-create / command palette), dashboard.

## Verdict

La Phase 7 (UI des documents commerciaux) est **essentiellement complète** — l'implémentation générique couvre les 9 types de documents (5 ventes + 4 achats) via **une liste et un éditeur uniques** pilotés par la config déclarative `DocumentUiConfig` (cf. `docs/phase7/phase7-1-document-ui-framework.md`). Le moteur Phase 6 est intact ; la couche UI consomme uniquement `src/features/documents/framework/api.ts`.

**Reste une courte liste d'écarts `🟡 Partial`** (aucun module manquant), dont **un bug réel de liens morts dans la recherche globale**.

---

## 1. Couverture des modules requis

| Module | Liste | Créer | Éditer | Détails | Suppr. | Statut |
|--------|:-----:|:-----:|:------:|:-------:|:------:|:------:|
| Devis (Quotation) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Complete |
| Commande client (Sales Order) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Complete |
| Bon de livraison (Delivery Note) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Complete |
| Facture vente (Invoice) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Complete |
| Avoir (Credit Note) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Complete |
| Demande d'achat (Purchase Request) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Complete |
| Commande fournisseur (Purchase Order) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Complete |
| Bon de réception (Goods Receipt) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Complete |
| Facture fournisseur (Supplier Invoice) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Complete |

Routes génériques (`src/app/(app)/documents/[type]`) :
- `/documents/{slug}` → liste (`[type]/page.tsx`)
- `/documents/{slug}/nouveau` → création (`[type]/nouveau/page.tsx`)
- `/documents/{slug}/{id}` → consultation/édition (`[type]/[id]/page.tsx`)

Slugs : `quotation`, `sales_order`, `delivery_note`, `invoice`, `credit_note`, `purchase_request`, `purchase_order`, `goods_receipt`, `supplier_invoice` (`docTypeSlug` dans `framework/ui-config.ts`).

---

## 2. Exigences « Each module must include »

| Exigence | Statut | Détail |
|----------|:------:|--------|
| List page | ✅ | `pages/document-list-page.tsx` (serveur, `documents.read`) + `document-list.tsx` |
| Create page | ✅ | `documents/[type]/nouveau` → `pages/document-editor-page.tsx` (sans `docId`, permission `documents.create`) |
| Edit page | ✅ | `documents/[type]/[id]` — brouillon éditable, hors brouillon lecture seule |
| Details page | ✅ | même route `/[id]` (statut, badge, sidebar, totaux, historique) |
| Delete confirmation | ✅ | `window.confirm` + confirmation groupée |
| Filters | ✅ | filtre statut (`STATUS_ORDER`), filtres sauvegardés localStorage (`document-list.tsx:441-493`) |
| Sorting | 🟡 | tri serveur fixe `createdAt desc` uniquement — **aucun contrôle de tri utilisateur** dans l'UI |
| Pagination | ✅ | page + taille (10/20/50), `document-list.tsx:682-733` |
| Search | ✅ | recherche debounce 400 ms dans la liste (`document-list.tsx:124-130`) ; recherche globale sur les numéros de docs |
| Status | ✅ | badge (`document-status-badge.tsx`), filtre, transitions workflow |
| Actions | ✅ | voir / dupliquer / convertir / supprimer (liste) ; enregistrer / approuver / rejeter / annuler / convertir / dupliquer / imprimer (éditeur) |
| Bulk actions | ✅ | approuver / rejeter / annuler / supprimer groupés (`document-list.tsx:197-241`) |
| Responsive layout | ✅ | grilles `sm:/lg:` + `flex-wrap` partout, RTL natif |

---

## 3. Framework partagé (exigences « reusable components »)

| Composant demandé | Équivalent existant | Statut |
|-------------------|---------------------|:------:|
| DocumentPage | `components/documents/pages/*` (list + editor pages) | ✅ |
| DocumentHeader | `document-header.tsx` | ✅ |
| DocumentToolbar | `document-workflow-bar.tsx` (transitions + convert + duplicate + print + save) | ✅ |
| DocumentStatusBadge | `document-status-badge.tsx` + `document-type-badge.tsx` | ✅ |
| DocumentWorkflow | `document-workflow-bar.tsx` (transitions serveur GET `/status`) | 🟡 |
| DocumentTimeline | `document-history.tsx` | 🟡 |
| DocumentSidebar | `document-sidebar.tsx` | ✅ |
| DocumentTotals | `document-totals-panel.tsx` | ✅ |
| DocumentLinesTable | `document-line-editor.tsx` (ProductPicker, kinds, remise, TVA, preview) | ✅ |
| DocumentAttachments | `document-attachments.tsx` (upload/list/delete réels via `/api/upload` + `/api/files`) | ✅ |
| DocumentHistory | `document-history.tsx` | 🟡 |
| DocumentComments | `document-comments.tsx` | 🟡 |
| ApprovalPanel | boutons d'approbation dans `document-workflow-bar.tsx` | 🟡 |
| DocumentActions | actions de ligne (`document-list.tsx`) + boutons d'éditeur | ✅ |

---

## 4. Règles métier

| Règle | Statut | Détail |
|-------|:------:|--------|
| Utilise le Document Engine existant | ✅ | `engine/` intact ; API via `framework/api.ts` (list/get/create/update/delete/status/relations/convert/attachments) |
| Numérotation existante | ✅ | `engine/series.ts` (CAS) ; numéro affiché en lecture seule |
| Permissions existantes | ✅ | `documents.read/create/delete/approve/convert/print` au niveau pages + `EditorPermissions` ; nav/quick-create sur `ventes.*`/`achats.*` |
| Workflow existant | ✅ | transitions serveur `GET /status` + `PATCH /status` (assertTransition) |
| Approbation existante | 🟡 | API sécurisée (`workflow.ts`), mais l'UI affiche les boutons d'approbation sans filtrer `documents.approve` (D10 du pré-bêta) |
| Isolation société | ✅ | `runScoped`/context + extension `companyScope` |
| Isolation succursale | ✅ | `branchId` obligatoire, sélecteur de succursale |
| Audit + activité | ✅ | via moteur/API (inchangé) |
| Recherche existante | 🟡 | **liens morts — voir §6** |

---

## 5. Écarts identifiés

### 🟡 5.1 Recherche globale → liens morts (bug réel)
`src/features/search/server.ts:63-71` : les `hrefPrefix` des documents pointent vers des routes qui **n'existent pas** :
```
/ventes/devis/{id}   /ventes/commandes/{id}   /ventes/livraisons/{id}
/ventes/factures/{id}   /ventes/avoirs/{id}
/achats/demandes/{id}   /achats/bons/{id}   /achats/receptions/{id}
/achats/factures/{id}
```
Routes réelles : `/documents/{slug}/{id}`. Même problème pour les **quick actions** :
- `search/server.ts:22-28` : `/devis/nouveau`, `/achats/nouveau` (morts)
- `command-palette.tsx:25-29` : `/devis/nouveau`, `/achats/bons/nouveau` (morts)

Impact : résultats de recherche documents + actions rapides → `notFound()`/ComingSoon. Violation « No 404 links » + « Search integration ».

### 🟡 5.2 Commentaires non persistés (fake data)
`document-comments.tsx` : état local en mémoire uniquement, auteur codé en dur (`EXAMPLE_AUTHOR = "current-user"`), aucune API/modèle serveur. Les commentaires sont perdus à la navigation. Violation « No fake data ». La persistance était **explicitement reportée** au module notifications (`phase7-1` §Travail restant n°3) — nécessite un modèle + API (au-delà de la couche présentation).

### 🟡 5.3 Tri utilisateur absent
Liste triée `createdAt desc` côté serveur sans contrôle UI. Ajout requis (tri par colonne serveur).

### 🟡 5.4 Historique sans transitions de statut
`document-history.tsx` : frise « créé + conversions » uniquement ; les changements de statut n'y figurent pas (D9 du pré-bêta).

### 🟡 5.5 Approbation : boutons non filtrés par permission
`document-workflow-bar.tsx:121-136` : les boutons de transition (dont APPROVE/REJECT) s'affichent pour tout statut éligible sans vérifier `editor.permissions.approve` (D10). API sécurisée, défaut d'UX seulement.

### 🟡 5.6 Statut ARCHIVED injoignable
`ui-config.ts` définit `toolbarActions: ["convert","duplicate","print","archive"]` mais **aucun bouton "archive"** n'est rendu ; `ARCHIVED` n'est atteignable ni en liste ni dans l'éditeur.

### 🟡 5.7 `/ventes` et `/achats` = simples redirections
Les pages catégories redirigent (`/ventes` → `/documents/quotation`, `/achats` → `/documents/purchase_request`). Pas de hub listant les 5/4 types (prévu en 7.2 §1). Fonctionnel mais sans navigation par carte.

### 🟡 5.8 Confirmations via `window.confirm`
`ui/confirm-dialog` n'existe pas encore (7.2 §2). Cohérent, non bloquant.

### 🟡 5.9 Impression
Bouton `window.print()` présent ; print stylesheet + gabarits A4/Thermal = Phase 8 (documenté dans `ui-config.printFormat`).

---

## 6. Non-retournés (hors périmètre Phase 7)
- Nav placeholder `/production`, `/comptabilite`, `/rh`, `/rapports`, `/aide` → `[...module]` → ComingSoon (modules futurs).
- `data-table.tsx` (TanStack) existe mais non utilisé par la liste générique.
- Incohérence de permissions documents (D1/D2 : seed vs `permissionPrefix` `achats.demande` vs catalogue `achats.besoin.*`) — traité au pré-bêta, hors présentation.

---

## 7. Conclusion & plan d'implémentation proposé (sous réserve d'approbation)

La Phase 7 n'est **pas manquante** : le framework complet existe et fonctionne. Les correctifs restants sont ciblés et sûrs (aucun retour sur le moteur) :

1. **Fix liens morts recherche** — `search/server.ts` (hrefPrefix documents + quick actions) et `command-palette.tsx` (QUICK_ACTIONS) → routes `/documents/{slug}/...`. *(correction de bug, couche présentation)*
2. **Tri par colonne** — contrôle serveur (`orderBy`) + UI dans `document-list.tsx`.
3. **Gating approbation UI** — filtrer les transitions APPROVE/REJECT par `editor.permissions.approve`.
4. **Bouton archiver** — rendre `archive` depuis `toolbarActions` / action de liste (status `ARCHIVED`).
5. **Historique statuts** — afficher les transitions de statut dans la frise.
6. **Commentaires persistants** — nécessite décision : (a) modèle `DocumentComment` + API (schéma + migration, au-delà de la présentation) ou (b) documenter comme limitation et retirer la donnée factice.

En attente d'approbation avant toute implémentation.
