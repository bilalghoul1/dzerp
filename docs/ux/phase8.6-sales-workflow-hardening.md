# Phase 8.6 — Sales Workflow Hardening (Audit)

**Project:** DzERP
**Date:** 2026-08-07
**Author:** Hermes (audit-only)
**Scope:** Verify the real-world sales scenarios end-to-end. **No code changes** — this phase
is read-only engine/UI inspection to confirm what the basic sales cycle already supports,
and to flag precisely which scenarios still need engine/business-logic work before Phase 9 (Accounting).
**Constraint reminder:** Phase 8.5 is **frozen/approved** (no further edits). Engine, schema,
permissions, APIs and business logic are **out of scope** for this agent — only verification + reporting.

---

## 1. What the engine already supports (verified in code)

### Status machine (`src/features/documents/engine/config.ts`)
The SALES_TRANSITIONS chain (identical for Devis / BC / BL / Facture):
```
DRAFT ──Soumettre──▶ PENDING_APPROVAL ──Approuver──▶ APPROVED
   │                         │                        │
   └──Annuler (CANCELLED)    └──Rejeter (REJECTED)    ├──Confirmer──▶ CONFIRMED
                                                           │
                                              ┌────────────┴────────────┐
                                        Partiellement traité      Traité
                                           (PARTIALLY_PROCESSED)  (PROCESSED)
                                                                     │
                                                              Clôturer (CLOSED)
```
- Devis **edit** → DRAFT is editable (`isEditable = status === DRAFT`). ✅
- Devis **reject** → PENDING_APPROVAL → REJECTED. ✅
- Devis **cancel** → DRAFT → CANCELLED / APPROVED → CANCELLED. ✅
- Devis **convert to BC** → ALLOWED_CONVERSIONS.QUOTATION = [SALES_ORDER, INVOICE]. ✅
- Devis **do not convert** → stays DRAFT/APPROVED, no relation created. ✅ (verified: `existingRelation` guard prevents double-convert, but "never converting" is just a no-op)
- BC **cancel** → DRAFT/APPROVED → CANCELLED. ✅
- Facture **unpaid** → default status after creation = DRAFT (or APPROVED). ✅ represents "unpaid" trivially.

### Calculation engine (`src/features/documents/engine/calculation.ts`)
- Per line: `amountHt = qty*price - discount%`; `amountTva = amountHt * tax%`; `amountTtc = amountHt + amountTva`.
- Totals summed and rounded to 2dp. **Correct.** ✅
- Totals propagated on create/update and on conversion (lines + totals copied). ✅

### Conversion (`src/features/documents/engine/conversion.ts`)
- Copies **all** source lines with original `quantity` to the target. ✅ (full-quantity only — see gaps)
- Creates a `DocumentRelation` (CONVERSION) + audit + activity. Relations are traceable. ✅
- Guard: cannot convert a CANCELLED/CLOSED/ARCHIVED source (`isActive` check). ✅

### Reject / Cancel UI
- `document-workflow-bar.tsx` exposes transitions incl. REJECTED/APPROVED; cancel handled via transition. ✅

---

## 2. Gaps found (these scenarios CANNOT currently pass at the engine level)

| # | Phase 8.6 scenario | Supported? | Why not (evidence) |
|---|---|---|---|
| 1 | Devis → BC **partial** | ❌ | `convertDocument` copies every line at full `quantity` (conversion.ts L107-120); no partial-qty parameter. |
| 2 | BC → BL **partial delivery** | ❌ | No `deliveredQty`/`receivedQty` field on document lines (grep: 0 hits). Status can be PARTIALLY_PROCESSED but no quantity tracking links it to lines. |
| 3 | BL → Facture **partial** | ❌ | Same root cause as #1 — conversion is always full-quantity. |
| 4 | Facture **partially paid** | ❌ | **No payment module exists.** `src/features` has no payment/reglement/encaissement/paidAmount logic. INVOICE `hasPayment: true` but there is **no PAID / PARTIALLY_PAID status and no transition** to it (SALES_TRANSITIONS has none). |
| 5 | Facture **fully paid** | ❌ | Same as #4 — no way to record/reflect payment. |
| 6 | BC/Devis **full delivery** | ⚠️ | Status can reach PROCESSED (full) but, again, no line-level delivered quantity to *prove* full delivery vs partial. Status is set manually. |

### Supporting evidence
- `grep -rn "deliveredQty\|receivedQty\|partialQty"` → **0 matches** across `src` + `prisma/schema.prisma`.
- `grep` for payment across `src/features` → only `business-partners` (balance display) and `company-admin` (schemas); **no document-payment service**.
- INVOICE config: `hasPayment: true`, but `transitions: SALES_TRANSITIONS` which contains no payment status.

---

## 3. "Relations / numbers stay correct" check (for the supported happy path)

For the **full-quantity** flow (Devis → BC → BL → Facture, no partials, no payment):
- Quantities: copied 1:1, unchanged. ✅
- Amounts (HT / TVA / TTC): copied 1:1 on conversion; recomputed identically. ✅
- TVA: per-line `taxPct` preserved. ✅
- Status: each new doc starts DRAFT; progression correct. ✅
- Relations: CONVERSION link created both directions (`getDocumentRelations` queries source OR target). ✅
- Numbers/sequence: `nextDocumentNumber` assigns correct prefixes (DEV/BC/BL/FAC). ✅
- Chain trace (`getConversionHistory`): forward-only, follows `outgoing[0]` — **note**: if a source has >1 conversion, only the first branch is traced. Minor, but worth noting for "relations stay correct" when multiple children exist.

---

## 4. Verdict

The **status/transition logic, calculation engine, and full-quantity conversion** are solid and ready.
The basic sales cycle **passes** for the happy path and for reject/cancel/edit/no-convert.

It does **NOT yet pass** the partial-delivery and payment scenarios, because those require
**engine + schema work** (a `deliveredQty`/`paidAmount` model, partial-conversion parameters,
and PAID/PARTIALLY_PAID statuses/transitions) — explicitly **out of scope** for this audit-only phase
and for the frozen Phase 8.5.

### Recommendation before Phase 9 (Accounting)
To truthfully say "the basic sales cycle is ready," the following engine work should land first
(as a separate business-logic phase, NOT here):
1. Line-level `deliveredQty` / `processedQty` + partial-conversion parameter (scenarios 1-3, 6).
2. Payment module: `paidAmount`, `PAID`/`PARTIALLY_PAID` statuses, transitions, and links to accounting (scenarios 4-5).
3. Multi-branch relation tracing if a doc can spawn >1 child.

Until then, Phase 9 (Accounting) can still begin against the **supported** subset (full-cycle
documents, correct totals, valid relations), with the caveat that partials/payments are not yet modelled.

---

## 5. Files inspected (read-only)
- `src/features/documents/engine/config.ts` — status machine + allowed conversions
- `src/features/documents/engine/calculation.ts` — line/total math
- `src/features/documents/engine/conversion.ts` — convert + relation tracing
- `src/features/documents/engine/status.ts` — `isActive` guards
- `src/components/documents/document-workflow-bar.tsx` — reject/approve/cancel actions
- `src/components/documents/document-sidebar.tsx` — relation rendering (links added in 8.5)
- `prisma/schema.prisma` — line model (no partial/payment fields)

**No files were modified. No commit made.** Awaiting your go-ahead.
