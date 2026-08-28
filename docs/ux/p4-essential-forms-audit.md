# P4 — Essential Forms & Progressive Disclosure Audit

**Status:** READ-ONLY audit (no code/DB changes made by this document)
**Objective:** Reduce the number of fields shown at creation time so company owners create records quickly; keep details available when needed via progressive disclosure.
**Hard rules honoured here:** no schema changes, no migrations, no `prisma db push`, no RBAC/auth/company-isolation changes, no changing field optionality in the DB. All classification below is UI-only.

## Classification legend

- 🟢 **ESSENTIAL NOW** — must be visible in the create form to produce a valid, usable record.
- 🟡 **OPTIONAL DETAILS** — usually left blank at creation; can be hidden behind an expander without breaking creation.
- 🔵 **REQUIRED LATER** — becomes mandatory at a later operation (validate at that point, not at creation).
- 🔴 **SYSTEM REQUIRED** — auto-generated/derived server-side (series code, totals, timestamps). Never shown as an input.

A field is "ESSENTIAL NOW" only if it is DB-required **without a default** and/or genuinely needed to identify the record. Fields with DB defaults or optional columns default to 🟡 UNLESS the business flow cannot proceed without them.

---

## 1. Business Partner (Customer & Supplier)

Source: `src/components/business-partners/business-partners-manager.tsx` (dialog, 5 visible sections)
Server: `POST /api/customers` / `POST /api/suppliers` → `businessPartnerCreateSchema` (`src/features/business-partners/validation.ts`)
DB-required without default: `name`, `companyId`(scoped). `code` auto-generated from series (`nextDocumentNumber("CUSTOMER"/"SUPPLIER")`). `type` has server default `COMPANY`.

### General section (currently visible)
| Field | Class | Why |
|---|---|---|
| name | 🟢 | DB-required, no default |
| type | 🟢 | needs a value; server defaults to COMPANY, keep visible |
| nameAr | 🟡 | used by Arabic operators; shown conditionally today |
| sector | 🟡 | optional |
| firstName / lastName | 🟡 | only relevant for INDIVIDUAL |

### Legal section (currently visible)
| Field | Class | Why |
|---|---|---|
| legalName, commercialName, legalForm, activity | 🟡 | optional company detail |
| taxId (NIF) | 🔵 | becomes required to issue a legal invoice document |
| rc, nis, ai | 🔵 | required on printed legal documents / tax files |
| vatNumber | 🔵 | TVA reporting field |

### Address section (currently visible)
| Field | Class | Why |
|---|---|---|
| address, wilaya, commune, postalCode | 🟡 | shipping/billing detail |

### Contacts section (currently visible)
| Field | Class | Why |
|---|---|---|
| email | 🟡 | optional |
| phone | 🟡 | optional |

### Terms section (currently visible)
| Field | Class | Why |
|---|---|---|
| paymentTerms | 🟡 | default terms often set per-company |
| creditLimit | 🔵 | enforced when check-out / credit-check runs; default 0 today |
| notes | 🟡 | optional |

**Minimum viable create = `name` (+ `type`).** Deferred sections: Legal, Address, Contacts, Terms and optional General sub-fields collapse to "Additional details".

---

## 2. Product

Source: `src/components/products/products-manager.tsx` (dialog, 7 visible sections)
Server: `POST /api/products` → `createProduct`. `code` + `sku` auto-generated from series; units default. DB-required without default: `name`, `companyId`.

### General
| Field | Class | Why |
|---|---|---|
| name | 🟢 | DB-required |
| nameAr | 🟡 | optional |
| type | 🟡 | server default |
| sku | 🔴 | auto-generated (defaults to code) — hide from create |
| barcode | 🟡 | optional |
| internalReference | 🟡 | optional |

### Categorization
| Field | Class | Why |
|---|---|---|
| category, subcategory, brand, manufacturer, unit | 🟡 | optional refinement; unit sensible later |

### Pricing
| Field | Class | Why |
|---|---|---|
| costPrice, purchasePrice, sellingPrice, wholesalePrice, retailPrice, minimumSellingPrice | 🔵 | needed to sell/quote; validate when creating a sales line (default 0 today) |
| vatCategory | 🔵 | required to compute TVA on a sale of this product |
| costingMethod | 🔵 | needed for COGS/valuation; server default exists |

### Stock
| Field | Class | Why |
|---|---|---|
| minimumQuantity, maximumQuantity, reorderPoint | 🟡 | thresholds |
| trackInventory, allowNegativeStock | 🟡 | defaults false |

### Physical
| Field | Class | Why |
|---|---|---|
| weight, length, width, height, volume | 🟡 | optional |

### Suppliers
| Field | Class | Why |
|---|---|---|
| preferredSupplierId | 🟡 | optional |
| isActive | 🟡 | default true |

**Minimum viable create = `name`.** Deferred: sku (system), Categorization, Pricing, Stock, Physical, Suppliers.

---

## 3. Warehouse

Source: `src/components/warehouses/warehouses-manager.tsx`
Server: `POST /api/warehouses`. `code` auto-generated. DB-required: `code`, `name`, `companyId`.

| Field | Class | Why |
|---|---|---|
| name | 🟢 | DB-required |
| nameAr | 🟡 | optional |
| branch | 🟡 | optional |
| manager | 🟡 | optional |
| address | 🟡 | optional |
| description | 🟡 | optional |
| isActive | 🟡 | default true |

**Minimum viable create = `name`.** Small form (7 fields); low priority — only hide manager/description behind expander if desired.

---

## 4. Commercial Document (the shared editor)

Source: `src/components/documents/...` (document-header, document-workspace, document-line-editor)
Server: `POST /api/documents` → engine `createDocument`. `number`/`status`/totals/taxes auto-generated.

| Field | Class | Why |
|---|---|---|
| branchId | 🟢 | server-required |
| party (customerId/supplierId) | 🟢 | server-required |
| currency / exchangeRate | 🟡 | default DZD / 1 |
| validUntil (QUO/PROFORMA) | 🟡 | optional |
| dueDate (INVOICE/SUPPLIER_INVOICE) | 🟡 | optional |
| customerOrderNumber/Date, receivedDate, requestedDeliveryDate (CUSTOMER_ORDER) | 🟡 | optional |
| invoiceId, reason (CREDIT_NOTE) | 🟢 | reason/related invoice |
| notes, conditions | 🟡 | optional |
| Lines (≥1, label + qty + unitPrice) | 🟢 | server-required |
| number | 🔴 | auto-generated, read-only |

The editor already keeps header minimal; lines panel is required. Low priority — already close to essential-first.

---

## 5. Production

### Production Order (`production-orders-manager.tsx`)
`number` auto-generated. DB-required: `productId`, `plannedQty`, `warehouseId`.

| Field | Class | Why |
|---|---|---|
| productId | 🟢 | server-required |
| plannedQty | 🟢 | server-required |
| warehouseId | 🟢 | server-required |
| bomId, workCenterId, notes | 🟡 | optional |

Already minimal (3 required + 3 optional). No change needed.

### BOM / Machine / WorkCenter (`boms/machines/work-centers-manager.tsx`)
DB-required manually-entered `code`, `name` (+ relations). `code` is **user-entered and required** here (unlike product/party). These are specialist records created by production users; acceptable to keep flat, or optionally move non-required fields behind expander. Low priority.

---

## 6. Human Resources (RH)

Employee / Contract / Department / Job Title / Position. DB requires manual `code` (user-entered) + `name` (+ relations). These are HR records; creating them is an intentional, infrequent admin action. Leave flat unless requested. Low priority.

---

## 7. Finance

- **Journal Entry** (`journal-entry-form.tsx`): `description` + at least one line. Inline form, already minimal.
- **Payment** (`payment-form.tsx`): `amount` required; optional party/invoice/method/ref/notes. Already minimal.

Low priority — no change needed.

---

## 8. Settings / References

Series numbering, currencies, taxes, units, lookups, preferences — admin maintenance tables, typically flat editors tuned to the task. Out of scope for P4 essential-first refactor (low frequency, specialist).

---

## Recommended scope (await approval)

Highest-value, lowest-risk forms to apply progressive disclosure:

1. **Business Partner** (customer + supplier) — the largest, most frequently created record. Collapse Legal / Address / Contacts / Terms and optional General sub-fields behind an "Additional details" expander. Min viable = name + type.
2. **Product** — collapse Categorization / Pricing / Stock / Physical / Suppliers behind "Additional details". Min viable = name. Hide sku (system-generated) from create.
3. **Warehouse** — minor: collapse manager/description behind expander (optional).

All other forms are already at/near essential-first or are low-frequency specialist records.

## Implementation notes (prohibited / allowed)

- ✅ Allowed: progressive disclosure via an expander/collapse built from existing primitives (Button + local state), matching the codebase's existing collapsible precedent (document summary panel). No new UI library.
- ✅ Allowed: defer optional fields and validate Required-Later fields at the actual later operation with user-friendly i18n messages.
- ❌ Prohibited: removing DB columns / migrations / `prisma db push` / altering requiredness in the DB / changing RBAC / auth / company isolation.

## Decision log

| Form | Min viable | Deferred behind expander | Required-Later key |
|---|---|---|---|
| Business Partner | name, type | Legal, Address, Contacts, Terms, nameAr, sector, firstName/lastName | taxId/rc/nis/ai/vatNumber (on invoice), creditLimit (on credit check) |
| Product | name | Categorization, Pricing, Stock, Physical, Suppliers, barcode, internalReference | sellingPrice/vatCategory (on sales line), costingMethod (on valuation) |
| Warehouse | name | manager, description | — |
