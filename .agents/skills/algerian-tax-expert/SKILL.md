---
name: algerian-tax-expert
description: Expert on Algerian tax concepts relevant to DzERP: TVA (VAT) rates and fields, tax identifiers (NIF, NIS, RC, AI), the project's tax settings, and document requirements. Use when implementing or reviewing anything tax-related: tax fields on documents, customer/supplier tax identifiers, TVA computation, invoices, tax reporting, or legal document formatting. Legal points are explicitly labeled CONFIRMED (project) vs REQUIRES_VERIFICATION (external law).
license: MIT
metadata:
  author: dzerp
  version: "1.0.0"
---

# Algerian Tax Expert (Expert Fiscal Algérien)

## Purpose

Provide the tax rules relevant to DzERP so agents add tax fields, compute TVA,
validate tax identifiers, and format legal documents correctly — without
inventing Algerian tax law. All external legal statements are labeled;
anything labeled `REQUIRES_VERIFICATION` must be confirmed with the user or a
legal source before it becomes code or documentation.

## Scope

- TVA (TVA = Taxe sur la Valeur Ajoutée / VAT) on sales and purchases.
- Tax identifiers: NIF, NIS, RC, AI on customers and suppliers.
- Tax fields and labels on documents and PDFs.
- TVA rates configurable per company/settings.
- Tax reporting placeholders (declaration/CA data) — design only.

Out of scope: accounting posting of tax (accounting-expert), international tax.

## TVA Framework (CONFIRMED in DzERP — settings + schema)

- `taxPct` (Decimal) exists on every commercial line; `totalTva` on every
  document. The engine computes TVA per line from `taxPct` (see
  `src/features/documents/engine/calculation.ts`).
- `VatCategory` exists in the schema (link between products and tax
  categories).
- Company settings include a `tax.rates` configuration
  (project config). Default project rates: **TVA 19%**, **9%**, **0%**.
- TVA is included/computed per line and summed at document level; do not
  apply a single document-wide percentage.

## TVA Rates (PROJECT CONFIG, external law REQUIRES_VERIFICATION)

- The project configures TVA 19% / 9% / 0% by default.
- In Algerian law (as commonly applied):
  - Standard TVA rate is 19% (`REQUIRES_VERIFICATION` for current law).
  - A reduced rate of 9% historically applied to some goods/services
    (`REQUIRES_VERIFICATION` for current law).
  - Some exports/services are at 0% or exempt (`REQUIRES_VERIFICATION`).
- Treat the legal rates as **configurable**, never hard-coded in business
  logic. The code must read the rate from the company's `tax.rates` setting.

## Tax Identifiers (CONFIRMED fields; legal format REQUIRES_VERIFICATION)

DzERP customer/supplier records carry Algerian tax identifiers:

| Identifier | Meaning | Note |
| --- | --- | --- |
| NIF | Numéro d'Identification Fiscale (fiscal ID) | Assumed 15 digits in Algeria — `REQUIRES_VERIFICATION` before validating format in code. |
| RC | Registre de Commerce (trade register) | Business registration number. |
| NIS | Numéro d'Identification Statistique (statistical ID) | Assumed 15 digits — `REQUIRES_VERIFICATION`. |
| AI | Article d'Imposition (tax article number) | Used on official invoices — `REQUIRES_VERIFICATION` on exact rules. |

Rules to apply:
- These identifiers are data on the customer/supplier record; they are printed
  on PDF documents (official invoice format).
- Do NOT invent digit-format validation without confirming the official format
  (`REQUIRES_VERIFICATION`).
- Keep identifiers optional (a customer may be a foreigner or individual).

## Other Algerian Taxes (informational — REQUIRES_VERIFICATION)

These exist in Algerian tax practice and may appear in future requirements.
They are NOT implemented in DzERP:

- IRG (Impôt sur le Revenu Global) — income tax, with employer withholding.
- IBS (Impôt sur les Bénéfices des Sociétés) — corporate profits tax.
- TAP (Taxe sur l'Activité Professionnelle) — activity tax.
- TIM (Taxe sur les Marchés) — market tax.
- Tax on salaries withheld at source, retirement contribution, etc.
- Annual declaration (déclaration annuelle des salaires).

If a task mentions any of these, first determine what DzERP must actually do
(e.g. compute and withhold IRG on payroll, display TAP fields, or produce a
report). Then design with the user; do not implement silently.

## Official Invoice Requirements (REQUIRES_VERIFICATION — external legal rules)

Algerian invoicing rules commonly require on official invoices:
- The seller's complete identity: name, address, NIF, RC, NIS, AI, TVA status.
- The buyer's identity (at least name/NIF for businesses).
- TVA rates applied per line.
- Sequential invoice numbering.
- Date, currency, totals HT / TVA / TTC.

DzERP already prints business documents via `src/features/print/*`; any
official-invoice feature must add the required fields and validate the exact
legal list with the user. Do NOT assume the current PDF is already compliant.

## Existing DzERP Tax Rules (CONFIRMED by source)

- `taxPct` per line + `totalTva`/`totalTtc` computed by the engine.
- `VatCategory` links products to tax categories; settings provide tax rates.
- Currency and exchange rate are captured on documents; TVA is computed in the
  document currency. Multi-currency TVA reporting is `REQUIRES_VERIFICATION`.

## Forbidden Assumptions

- Do NOT hard-code 19%/9% in code — read from settings.
- Do NOT validate NIF/NIS/RC/AI formats without confirming official rules.
- Do NOT assume the PDF is legally compliant.
- Do NOT assume TVA applies on top of every amount (some amounts are TTC).
- Do NOT treat TVA as revenue — it is tax collected on behalf of the state.
- Do NOT invent declaration/report requirements.

## STOP Conditions

- STOP if asked to validate a tax identifier format.
- STOP if asked to compute withheld taxes (IRG/IBS/TAP) — not modeled.
- STOP if a legal document must be compliant and the field list is unknown.
- STOP if a tax rate must be hard-coded.

## Examples

1. "Show TVA on an invoice line" → read `taxPct` from settings, compute line
   TVA, display label "TVA 19%" using the configured rate.
2. "Add NIF validation" → confirm the official Algerian NIF format first
   (`REQUIRES_VERIFICATION`); then validate server-side.
3. "Print a legal invoice" → ensure seller/buyer identifiers, per-line TVA,
   sequential number (DocumentSeries) are on the PDF; confirm field list with
   the user.

## Interaction With Other Skills

- `commercial-expert`: invoice lines and totals carry tax data.
- `accounting-expert`: TVA collectée/deductible posting (future module).
- `document-engine-expert`: numbering is the legal invoice number source.
- `database-auditor`: decimal precision of tax columns, indexes on identifiers.
- `security-rbac-expert`: tax settings are privileged company config.
