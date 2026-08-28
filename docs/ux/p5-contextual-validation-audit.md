# P5 — Contextual Validation & Workflow Continuity Audit

**Status:** READ-ONLY workflow audit + selective UX continuity fixes (no schema/DB/RBAC/auth changes).
**Question answered:** Can a company owner create a customer/product with minimal P4 information, then continue through real business workflows, receiving clear contextual guidance only when genuinely required?

## Executive result

For a **minimal customer** (name + type) and **minimal product** (name + type):
- Creation always succeeds.
- Usage in quotations, sales orders, delivery notes, invoices, proformas, purchase documents **is never blocked** by missing legal identifiers, price, tax category, warehouse, or inventory.
- Printing is null-safe: missing legal identifiers are simply omitted (blank), never blocking/crashing.
- Document conversion does not require extra party/product fields.
- The only truly required fields at any stage are the shared document invariants: `branchId`, the party, and ≥1 line with a `label`.

Therefore: **P4 minimal creation does not create a blocking gap.** The workflow is continuous.

## Evidence & Requirements Matrix

| Entity | Field | Required at Creation | Required Later | Exact Trigger | Validation Location | Current User Message | UX Verdict |
|--------|-------|---------------------|----------------|---------------|---------------------|----------------------|------------|
| Customer | name | ✅ (DB required, no default) | — | creation (`write customer`) | zod `businessPartnerCreateSchema` (`src/features/business-partners/validation.ts:38-59`); Prisma NOT NULL | inline label `*` (`business-partners-manager.tsx`) | 🟢 |
| Customer | type | ✅ (server default COMPANY) | — | creation | zod enum + server default | Select present | 🟢 |
| Customer | code | ⚙️ auto (series) | — | creation | `nextDocumentNumber("CUSTOMER")` (`customers/config.ts:44`) | hidden | ⚙️ SYSTEM |
| Customer | NIF/RC/NIS/AI/VAT/address | 🔵 OPTIONAL at all flow stages | none enforced | not enforced anywhere in current code | no requirement exists | not shown unless expanded | 🔵 (legally could matter at invoice print; see GAP) |
| Supplier | name | ✅ | — | creation | same schema via suppliers | inline `*` | 🟢 |
| Supplier | code | ⚙️ series | — | creation | `nextDocumentNumber("SUPPLIER")` | hidden | ⚙️ SYSTEM |
| Product | name | ✅ | — | creation | zod `productCreateSchema` | inline `*` | 🟢 |
| Product | code/sku | ⚙️ series | — | creation | `nextDocumentNumber("PRODUCT")`; sku defaults to code | hidden/expanded | ⚙️ SYSTEM |
| Product | type | 🟡 (server default) | — | creation | enum + default | Select (expanded) | 🟡 |
| Product | sellingPrice/purchasePrice | 🔵 no requirement | none | line auto-fill uses `?? 0` | client UI only (`document-line-editor.tsx:146-162`) | price cell defaults 0 | 🔵 (see UX note) |
| Product | vatCategory | 🔵 no requirement | none | line tax uses default tax lookup, not product category | client UI (`document-line-editor.tsx:160`) | tax defaults to default rate | 🔵 |
| Product | warehouse / trackInventory | 🔵 no requirement | none | not consumed as a block anywhere (grep: label only) | — | — | 🔵 |
| Document (all) | branchId | ✅ | — | save (create/update) | **server** `validateDocumentInput` (`validation.ts:77`); `ApiError VALIDATION` | FRENCH toast: "La succursale est obligatoire" | 🟠 (raw FR, not localized) |
| Document (all) | party (customer/supplier) | ✅ | — | save | **server** `validateDocumentInput` (`validation.ts:83-93`) | FRENCH toast: "Le client est obligatoire" / "Le fournisseur..." | 🟠 |
| Document | ≥1 line with label | ✅ | — | save | **server** `validateDocumentInput`/`validateLines` (`validation.ts:95-126`) | FRENCH toast: "Au moins une ligne..." / "Ligne N: le libellé..." | 🟠 |
| Document | status transitions | — | ⚙️ lifecycle | workflow actions | `workflow.ts` + `status.ts` `assertTransition`/`canApprove` | translated `status.*` + `confirmTransition` | ⚙️ |
| Invoice | dueDate / meta taxes | — | 🟡 optional | edit header | `service.ts` optional fields, default DZD | field optional | 🟡 |
| Print | customer legal IDs | 🔵 | none | PDF generation | null-safe mapping (`print/map-document.ts:67-71`) | blank on PDF, no block | 🔵 |
| Delivery/goods receipt | warehouse | 🔵 | none | delivery creation/approval | not required (schema has no warehouseId) | no field | 🔵 |

Legend: 🟢 creation | 🟡 operational/optional | 🟠 finalization/message issue | 🔵 optional | ⚙️ system.

## Proven UX problems (and fixes applied)

### Problem 1 — Server validation messages are French and not localized (affects AR/EN users)
- **Severity:** Medium.
- **Root cause:** `validateDocumentInput`/`validateLines` throw `ApiError(422, "<French>", "VALIDATION", {...})`. `errorResponse` sends `message` (FR) + generic `code` "VALIDATION" (not per-field). Client (`document-editor-context.tsx`) shows `toast.error(error.message)` → raw French for every language.
- **Evidence:** `validation.ts:77-126`, `http.ts:19-31`, `document-editor-context.tsx:382-395`.
- **Fix applied (client-side, logic preserved):** Added contextual, localized pre-save validation in `save()` that checks branch, party, ≥1 line, and per-line label using new i18n keys (`documentsUI.missingBranch/missingParty/missingLines/missingLineLabel`) in FR/AR/EN, with a clear "what to do". Server checks remain the authority (fail-open unchanged). **Business logic unchanged.**
- **Files:** `src/components/documents/document-editor-context.tsx`, `src/i18n/dictionaries.ts`.

### Problem 2 — A product with no price is added to a line at price 0 (silent zero document)
- **Severity:** Low (not blocking).
- **Root cause:** `handleSelectProduct` uses `product.sellingPrice ?? 0` / `purchasePrice ?? 0`; price cell is editable and defaults to 0. The owner can save a €0 document without noticing.
- **Evidence:** `document-line-editor.tsx:146-162`.
- **Fix:** **Not applied** — this is a business/SOP decision (some workflows legitimately use free lines / service with later pricing). Recommended follow-up: add a non-blocking inline hint on a 0-price line ("Ce prix est à 0 — confirmez-le") reusing an existing pattern, after explicit approval. Business logic unchanged.

## GAP (requires decision — not implemented)
- **Legal identifiers on invoice print:** Current system prints invoices with blank NIF/RC/NIS/AI/TVA when a customer has none; nothing enforces them. In Algeria, invoices are legally required to carry certain identifiers. **This is a compliance gap, NOT an implemented rule.** Per P5 rules, no new compliance logic was invented or added. Recommend a separate, explicitly approved phase (with legal confirmation via `algerian-tax-expert` skill) before forcing anything at finalization.

## Selective implementation summary
Only one proven, safe UX continuity fix was applied: localized, contextual pre-save guidance for document invariant requirements. No schema, migration, RBAC, auth, isolation, or business-calculation changes.

## Not changed (explicit)
- Prisma schema, migrations, `prisma db push`.
- Two-role RBAC, permissions, auth/sessions.
- Company isolation / scoped client usage.
- Business calculations, prices, taxes, stock.
- P4 minimal creation forms (customer/product stay minimal).
- No new UI libraries, no blocking modals, no toast spam.
