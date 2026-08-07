# Phase 8 — Pré-audit : Impression & PDF

Statut : **RAPPORT D'AUDIT — aucun code écrit.**

## 1. Verdict global

**Phase 8 est essentiellement ABSENTE (❌).** Il n'existe ni moteur PDF, ni template engine, ni print service, ni preview service, ni template registry, ni company branding service exploitable pour l'impression. Un seul élément est partiellement en place : un bouton « Imprimer » qui appelle `window.print()` et qui, dans l'état actuel, ne produit rien d'utile (le shell de l'éditeur est `print:hidden`).

## 2. Périmètre inspecté

- `src/features/pdf`, `src/features/print` — inexistants.
- `package.json` — aucun moteur PDF / impression : pas de `pdf-lib`, `jspdf`, `pdfmake`, `react-pdf`, `react-to-print`, `puppeteer`, `playwright`, `sharp`, `qrcode`, `bwip-js`.
- Recherche `pdf|print|export|download|renderer|template` dans `src/` — aucun `createPdf`, `generatePdf`, `toPdf`, `renderPdf`, `printDocument` ; `window.print` utilisé une seule fois (barre d'action de l'éditeur).
- CSS d'impression : aucun `@page`, aucun `@media print` dans `globals.css` ; unique occurrence `print:hidden` sur `document-editor-shell.tsx:31`.
- Données : `prisma/schema.prisma`, moteur documents `src/features/documents/engine/service.ts`, framework `framework/`, upload `src/features/upload/`, settings `src/features/settings/`, i18n, permissions.
- UI : `document-workflow-bar.tsx`, `document-sidebar.tsx`, `document-editor-page.tsx`, `company-form.tsx`, `preferences-form.tsx`.

## 3. Inventaire classifié

| # | Fonctionnalité | Statut | Emplacement / note |
|---|----------------|--------|--------------------|
| 1 | Action « Imprimer » (bouton + permission) | 🟡 | `document-workflow-bar.tsx` → `window.print()` ; permission `documents.print`. Bouton déclaratif dans `DEFAULT_TOOLBAR` (`ui-config.ts:44-49`), `DocumentActionId` contient `"print"` (`ui-types.ts:19`). Aucun template consommé. |
| 2 | Moteur PDF (génération serveur) | ❌ | Aucun. Aucune dépendance, aucun `src/features/pdf`. |
| 3 | Template Engine / rendu de document | ❌ | Aucun template (en-tête, lignes, totaux, mentions légales). |
| 4 | Template Registry (par type de doc) | ❌ | Inexistant. `DocumentUiConfig.printFormat` (`ui-types.ts:44`) est déclaratif, jamais consommé. |
| 5 | Preview Service (aperçu avant impression) | ❌ | Inexistant. |
| 6 | Print Service (impression / téléchargement PDF / export) | ❌ | Inexistant. Aucune route `/print`, aucun bouton « Télécharger PDF ». |
| 7 | Company Branding Service (logo, tampon, signature, couleurs, banque, mentions) | 🟡 | Les **données** existent dans le modèle `Company` (voir §4). Aucun service ne les lit pour l'impression. |
| 8 | QR & code-barres | ❌ | Aucune lib. Préférence `Company.qrEnabled` + `Setting.documents.qr.enabled` existent, sans consommateur. |
| 9 | Formats A4 / A5 / THERMAL | 🟡 | Modèle de données existant (`Company.printFormat`, `Setting.print.defaultFormat`, `printFormat` par type de doc dans `ui-config.ts` — tous « A4 »). Aucun rendu. |
| 10 | Multi-pages (sauts, en-tête/pied de page par page, numérotation) | ❌ | Inexistant. |
| 11 | RTL / bilingue (fr/ar/en) | 🟡 | i18n + RTL + formatters existent (`formatNumber`, `formatCurrency`, `formatDate`, `formatDateTime` dans `src/lib/utils.ts`). Aucun template ne les utilise. |
| 12 | Settings d'impression (UI) | ✅ | `company-form.tsx` (printHeader, printFormat, printMargins, logo/tampon/signature) et `preferences-form.tsx` (printFormat, QR). |
| 13 | Permissions | ✅ | `documents.print` (`permissions.ts:432`), `files.download` (`permissions.ts:397`). |
| 14 | Téléchargement / export PDF | ❌ | Inexistant. |

**Conclusion : 1 ✅ / 5 🟡 / 8 ❌.**

## 4. Existant réutilisable (NE PAS dupliquer)

- **Données d'identité légale + branding** — modèle `Company` (`schema.prisma` ~:243) : `logoKey`, `stampKey`, `signatureKey`, `primaryColor`, `printFormat`, `printMargins` (top/right/bottom/left en mm), `printHeader`, `invoiceFooter`, `qrEnabled`, `paymentTerms`, champs banque (`bank*`, RIB/IBAN/SWIFT), `rc`, `taxId`, `nis`, `ai`, `vatNumber`, `phone`, `mobile`, `email`, `website`, adresse/commune/wilaya/code postal. Lue via le company-admin (déjà per-company).
- **Upload / fichier servable** — `src/features/upload/storage.ts` (`readUploadFile`, `isInlineSafeMime`) + `src/app/api/files/[...key]/route.ts` (auth `files.download`, `FileAsset` company-scoped). Idéal pour logo/tampon/signature. ⚠️ `readUploadFile` renvoie `application/octet-stream` : pour l'embed d'image, récupérer le vrai `mimeType` depuis `FileAsset`.
- **Données document** — moteur `getDocument(docType, docId, companyId)` (`engine/service.ts` :322-344) : numéro, statut, branch (nom), issuedBy (vendeur), party (nom), lignes (triées), totaux, notes, devise, taux. Normalisé par `DocumentDetailModel` (`ui-types.ts:84-110`). Aucun moteur PDF ne doit réécrire cette lecture.
- **i18n + formatters** — fr/ar/en, RTL, étiquettes de statut/types de doc, `formatNumber/formatCurrency/formatDate/formatDateTime`.
- **Permissions** — `documents.print`, `files.download`.
- **Étiquettes** — `printFormat` A4/A5/THERMAL traduites dans l'i18n.

## 5. Conflits / données parallèles à corriger (à ne pas propager)

- **Branding : deux sources parallèles.** Le module settings expose `getCompanyProfile()` (`settings/config.ts`) qui lit la table **globale** `Setting` (sans `companyId`) : une impression l'utilisant **fuirait des données d'une autre société** (logo, RC, banque…). Phase 8 doit lire le branding **uniquement sur le modèle `Company`**. Ne pas dédoubler dans des `Setting` globaux.
- **`window.print()` actuel est inerte** : l'éditeur est `print:hidden` → l'impression ne sort rien. À remplacer par un vrai flux.
- **`Setting.print.defaultFormat` vs `Company.printFormat`** : même préférence sur deux tables ; Phase 8 s'appuie sur `Company.printFormat` (per-company), avec repli A4.

## 6. Gaps de données pour l'impression

- **Adresse/contact du client/fournisseur** : le moteur `getDocument` n'expose que le **nom** de la partie (inclut `party`, pas l'adresse/RC/NIS). Le rendu complet (en-tête destinataire : adresse, téléphone, RC/NIF/NIS/AI) exige soit d'enrichir l'inclue du moteur (source unique), soit une lecture complémentaire `Customer`/`Supplier` scoped par société. À trancher avant implémentation (§8).
- **Échéance / statut de paiement** : seuls `Invoice` et `SupplierInvoice` ont `dueDate` + `paymentStatus` ; non exposés dans `DocumentDetailModel`.
- **Moyen de paiement** : **non modélisé sur les documents** (pas de `paymentMethodId`). `PaymentMethod` est une table de référence (`schema.prisma:97`), sans lien aux documents. L'affichage « mode de règlement » sur un document est donc impossible sans changement de schéma — hors périmètre Phase 8 (afficher seulement échéance pour Facture/Facture fournisseur).
- **Adresse/coordonnées de la succursale** : modèle `Branch` riche (code, nom, adresse, ville, téléphone, email, manager, RC/NIF/NIS/AI) ; les données existent mais ne sont pas restituées par `getDocument` (seul `branchName`).

## 7. Work packages à implémenter (uniquement le manquant)

1. **Moteur PDF** (server-side) — génération binaire, multi-pages (en-tête/pied de page récurrents, numérotation), formats A4/A5/Thermal, marges depuis `Company.printMargins`, RTL/LTR.
2. **Template Registry** — template par type de document (les 9) + template générique de repli.
3. **Template Engine** — rendu d'un document (en-tête société, destinataire, métadonnées, tableau de lignes, totaux, montant en lettres, mentions/notes, pied de page légal).
4. **Company Branding Service** — lit `Company` (per-company) : logo/tampon/signature (embed via `/api/files`), couleurs, mentions légales, banque, `printHeader`, `invoiceFooter`, `printMargins`, `printFormat`, `qrEnabled`.
5. **Print Service** — API/route : résolution docType+docId → données → branding → PDF ; formats A4/A5/Thermal ; sérialisation binaire.
6. **Preview Service** — route d'aperçu (PDF inline) + dialog client.
7. **Actions client** — Imprimer, Aperçu, Télécharger PDF, Export PDF (list + éditeur), en remplacement du `window.print()` inerte. Respect de `documents.print`.
8. **QR (+ option code-barres)** — rendu QR (préférence `Company.qrEnabled`) ; sinon marqué manquant. Nécessite une lib (ex. `bwip-js` pour QR + Code128).

## 8. Décisions techniques à confirmer avant implémentation

1. **Approche de génération PDF** :
   - (a) **Serveur pur** : `pdf-lib` (+ `bwip-js` pour QR/code-barres) dans un route handler Next — PDF binaire autosuffisant, testable, pas de navigateur requis. **Recommandé.**
   - (b) Navigateur : route d'impression dédiée + CSS `@page`/`@media print` — plus simple, mais PDF dépend de « Enregistrer en PDF » du navigateur, numérotation/en-têtes fragiles, pas d'export binaire fiable.
2. **Nouvelles dépendances** : ajout de `pdf-lib` et `bwip-js` (pures JS, sans binaire) — OK ?
3. **Données destinataire** : enrichir l'inclue du moteur `getDocument` (source unique, modifie `engine/service.ts`) **ou** lecture `Customer`/`Supplier` dédiée dans le print feature (zéro impact moteur) ?
4. **Où brancher l'aperçu/impression** : éditeur (`document-workflow-bar.tsx`), liste (`document-list.tsx`), page détail ?

**En attente d'approbation — aucun code écrit.**
