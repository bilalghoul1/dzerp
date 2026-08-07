# Stabilisation Phase 7 — Document commerciaux

Date : 2026-08-05
Périmètre : stabilisation de l'UI documents existante uniquement — aucune nouvelle fonctionnalité, aucune modification du Document Engine, du workflow ou de la numérotation.
Référence d'audit : `docs/phase7/pre-audit.md`.

## Décisions préalables (validées le 2026-08-05)

- **Archive DEFERRÉE.** Aucune transition `ARCHIVED` n'est ajoutée à `engine/config.ts` (elle n'y est pas atteignable), aucun modèle/API d'archivage n'est créé. L'action `archive` a été retirée du catalogue déclaratif `DocumentActionId` et de `DEFAULT_TOOLBAR` (`framework/ui-types.ts`, `framework/ui-config.ts`) pour qu'aucune action d'archivage ne soit exposée dans l'UI. Documenté comme futur chantier « Document Lifecycle Management ».
- **Commentaires :** suppression des fausses valeurs ; pas de modèle ni d'API de commentaires (intégration backend reportée).
- **Tri :** tri côté client des lignes chargées, sans toucher à la signature/au locale de `engine/service.ts::listDocuments`.

## Fichiers modifiés

| Fichier | Modification |
| --- | --- |
| `src/features/search/server.ts` | Routes document obsolètes `/ventes/*` → `/documents/{slug}/*` (9 tables) ; actions rapides `/devis/nouveau`, `/achats/nouveau` → `/documents/{slug}/nouveau` ; liens user/succursale morts → `/parametres` et `/parametres/branches`. |
| `src/components/shell/command-palette.tsx` | `QUICK_ACTIONS` `/devis/nouveau`, `/achats/bons/nouveau` → `/documents/{slug}/nouveau`. |
| `src/components/shell/quick-create.tsx` | Entrée « user » supprimée (route `/parametres/utilisateurs/nouveau` inexistante, `admin.users.manage` orphelin — aucun écran de gestion utilisateur). |
| `src/components/documents/document-workflow-bar.tsx` | Boutons de transition vers `APPROVED`/`REJECTED` masqués si `permissions.approve` absent (le backend impose déjà `documents.approve`). |
| `src/components/documents/document-history.tsx` | Timeline enrichie : + événements de changement de statut (from → to, acteur) depuis le journal d'activité existant, en plus de la création et des conversions. |
| `src/features/activity/service.ts` | Nouveau `listEntityActivity(entityId, limit)` — lecture chronologique des événements d'une entité (scope société par l'extension). |
| `src/app/api/documents/[id]/activity/route.ts` | Nouvelle route GET (garde `documents.read`, 404 si document inconnu de la société) exposant le journal d'activité d'un document. |
| `src/features/documents/framework/api.ts` | Nouveau client `getDocumentActivity(type, docId)` + type `DocumentActivityEvent`. |
| `src/features/documents/framework/index.ts` | Export du type `DocumentActivityEvent`. |
| `src/components/documents/document-comments.tsx` | `EXAMPLE_AUTHOR = "current-user"` supprimé ; auteur = vrai nom de l'utilisateur courant (`company.user.fullName ?? username`). |
| `src/components/documents/document-list.tsx` | Tri utilisateur : sélecteur de colonne (date/numéro/partie/statut/total) + bouton direction, appliqué côté client aux lignes chargées. |
| `src/features/documents/framework/ui-types.ts` | `"archive"` retiré de `DocumentActionId`. |
| `src/features/documents/framework/ui-config.ts` | `"archive"` retiré de `DEFAULT_TOOLBAR`. |
| `src/i18n/dictionaries.ts` | Clés ajoutées (fr/ar/en) : `documentsUI.by`, `documentsUI.sortBy`, `documentsUI.sortDirection`. |

## Contraintes respectées

- Document Engine, workflow (`engine/config.ts`, `engine/service.ts`, `engine/workflow.ts`, `engine/status.ts`) : **aucune modification**.
- Numérotation : non touchée. Schéma Prisma : non modifié.
- Aucune nouvelle fonctionnalité métier : l'API d'activité réutilise le journal d'activité déjà écrit par le workflow (aucune nouvelle écriture ajoutée).
- Navigation : toutes les liaisons de documents passent par `/documents/{slug}/{id}` et `/documents/{slug}/nouveau` (slug = type minuscule, cf. `docTypeSlug`).

## Vérifications

- `npx tsc --noEmit` : 0 erreur.
- `npm run lint` : 0 erreur, 1 warning préexistant non lié (`companies-table.tsx:200`, TanStack).
- `npm run build` : succès — la route `/api/documents/[id]/activity` est bien générée.
- `npx prisma validate` : non nécessaire (schéma non modifié) ; vérifié au préalable.

## Dette restante (hors périmètre)

- `window.confirm` encore utilisé dans la barre de workflow, la liste et les pièces jointes (remplacement par un composant de confirmation = futur chantier).
- Persistance des commentaires : reportée (modèle/API non créés volontairement).
- Archivage : reporté — futur chantier « Document Lifecycle Management » (statut `ARCHIVED`, transition associée, UI de restauration).
- Tri serveur (sur l'ensemble des résultats, pas seulement la page chargée) : nécessiterait d'étendre `listDocuments` — exclu par le périmètre.
- Page de gestion des utilisateurs : inexistante ; l'entrée de création rapide a été retirée, pas ajoutée.
- Clés i18n `documentsUI.archive`/`confirmArchive` désormais inutilisées (conservées, inoffensives).

## Confirmation

Aucune nouvelle fonctionnalité n'a été ajoutée. Les 8 tâches de stabilisation listées dans l'audit sont implémentées et validées. En attente d'approbation.
