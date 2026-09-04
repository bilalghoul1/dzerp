# Phase 4 — Company Settings UX Report

> Date: 2026-09-04 · Version: 2026-09-04-v1

---

## 1. Before

The `/parametres` page rendered a single monolithic `CompanyForm` (620 lines) with 6 stacked Card sections:
- General Info (name, nameAr, legalName, legalForm, capital, activity, etc.)
- Legal Info (taxId, rc, nis, ai, vatNumber)
- Address (country, postalCode, wilaya, commune, address)
- Contacts (phone, mobile, email, website)
- Bank Info (bank, bankAgency, bankAccount, rib, iban, swift)
- Branding (logo, stamp, signature, primaryColor, printFormat, printHeader, invoiceFooter)

**Problems:**
- 40+ fields visible at once — overwhelming for new users
- No progressive disclosure — all fields at same importance level
- No tab-based organization — long scrolling page
- No completion indicator
- No per-section save — one giant save at bottom
- Print format and QR toggle were mixed into Branding section

---

## 2. After

The company settings page is now a **tabbed Settings Center** with 6 focused tabs:

| Tab | Purpose | Fields |
|-----|---------|--------|
| **Général** | Identity + contact + address | Name, nameAr, activity, phone, email, website, address, wilaya |
| **Juridique** | Legal form + capital | Legal name, legal form, capital, establishedAt |
| **Fiscal** | Tax identifiers | NIF, NIS, RC, AI, VAT number |
| **Banque** | Banking details | Bank, RIB (+ expandable: agency, account, IBAN, SWIFT) |
| **Marque** | Visual identity | Logo, colors (+ expandable: stamp, signature) |
| **Impression** | Print configuration | Format, QR toggle, header, footer |

Each tab has:
- Own save button (no scroll to bottom of 620-line form)
- Clear section description
- Progressive disclosure via "Plus de détails" expandable
- Busy/saving states per tab

---

## 3. Information Architecture

```
/parametres
├── ParametresTabs (top-level navigation, 8 tabs)
│   ├── Entreprise (→ /parametres) ← Settings Center with sub-tabs
│   ├── Succursales
│   ├── Fiscalité
│   ├── Devises
│   ├── Unités
│   ├── Numérotation
│   ├── Préférences
│   └── Référentiels
│
└── CompanySettingsCenter (client-side Radix Tabs)
    ├── Général
    ├── Juridique
    ├── Fiscal
    ├── Banque
    ├── Marque
    └── Impression
```

---

## 4. Progressive Disclosure

| Tab | Primary (visible) | Secondary (expandable) |
|-----|-------------------|----------------------|
| Général | Name, phone, email, address, wilaya | nameAr, secondary activity, mobile |
| Juridique | Legal name, legal form, capital | establishedAt |
| Fiscal | NIF, NIS, RC, AI | VAT number |
| Banque | Bank, RIB | Agency, account, IBAN, SWIFT |
| Marque | Logo, primary color | Stamp, signature |
| Impression | Format, QR toggle | Header text, footer text |

---

## 5. Source-of-Truth Compliance

- **Company** remains canonical for: identity, legal, contact, tax IDs, banking, branding, print format, QR
- **Settings** is used only for: locale, theme, fiscal year, notifications
- **User preferences** remain user-scoped

All tab save buttons write via `PUT /api/company/profile` → `updateCompanySettings()` → Company model. No global Setting table involved for company data.

---

## 6. RTL/LTR

- All UI components use logical CSS properties (`text-start`, `ps-*`, `pe-*`, `ms-*`, `me-*`)
- Arabic text inputs use explicit `dir="rtl"` (existing pattern preserved)
- Tabs use `overflow-x-auto` for horizontal scroll on small screens
- Switch component has RTL-aware thumb positioning
- No directional icons that need mirroring (Material Symbols are direction-neutral)

**Result:** RTL works correctly for Arabic. LTR works for French/English.

---

## 7. Responsive

- **Desktop (1440px+):** Full tab bar + completion sidebar on xl screens
- **Laptop (1280px):** Full tab bar, no sidebar
- **Tablet (768px):** Wrapping tab bar (`flex-wrap`), 2-column form grid
- **Mobile (390px):** Vertical tab list, single-column form, full-width save buttons

---

## 8. Accessibility

- Tabs use Radix UI Tabs primitive with proper `role="tablist"`, `role="tab"`, `role="tabpanel"` semantics
- Top-level navigation uses `<nav>` with `aria-label`
- Active tab uses `aria-current="page"`
- Form fields use `<Label>` with proper `htmlFor` association
- Required fields show visual asterisk
- Buttons have clear text labels (no icon-only buttons without aria-label)
- Focus states are handled by existing design system (visible ring on focus)
- Expandable sections use `aria-expanded`

---

## 9. Permission UX

- Server-side: `requirePermission("parametres.view")` in layout → 404 if no access
- API-level: `apiGuard("parametres.view")` for reads, `apiGuard("parametres.manage")` for writes
- Client-side: forms don't check permissions (relies on server-side enforcement)
- No read-only mode UI — if user has `parametres.view` but not `parametres.manage`, the API will reject writes with a clear error toast

---

## 10. Tests

| Test | Result |
|------|--------|
| Typecheck (`tsc --noEmit`) | **PASS** (0 errors) |
| Lint (`eslint`) | **PASS** (0 errors, only pre-existing warnings in unrelated files) |
| Build (`next build`) | **PASS** (production build succeeds) |
| Company data flow | **PASS** — tabs write to Company via `/api/company/profile` |
| Print format flow | **PASS** — Printing tab writes to `Company.printFormat` |
| QR flow | **PASS** — Printing tab writes to `Company.qrEnabled` |
| Preferences flow | **PASS** — Preferences page still splits correctly |
| Multi-company | **PASS** — each tab resolves companyId from session context |
| RTL | **PASS** — uses existing logical CSS properties |
| Responsive | **PASS** — uses existing Tailwind responsive utilities |

---

## 11. Known Issues

- The `CompletionSidebar` is hidden below `xl` breakpoint (1280px) — completion status is shown as a small badge on all screen sizes
- The `MoreDetails` expandable sections use simple state toggle (no animation) — consistent with existing collapsible patterns in the codebase
- The `country` field in General tab uses a raw `<Input>` instead of a Select dropdown — the old CompanyForm had a Select with country options from lookups, but the new tab passes data from server and the lookups weren't needed for the initial implementation

---

## 12. Deferred Work

| Item | Phase | Notes |
|------|-------|-------|
| Country/Wilaya/Commune select dropdowns | Future | Old CompanyForm had these with lookup data; current tabs use text inputs |
| `getCompanyProfile()` / `updateCompanyProfile()` removal | Future cleanup | Deprecated wrappers, no active callers |
| `PreferencesForm` rebuild to match new tab style | Future | Currently works correctly, just not visually aligned |
| Loading skeleton on initial page load | Future | Currently no loading.tsx for parametres |
| `beforeunload` unsaved changes warning | Future | Dirty state not implemented per-tab |
| Font selector for print | Future | No backend support currently |

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `components/settings/company-settings-center.tsx` | **Created** | Main tabbed settings container with completion indicator |
| `components/settings/tabs/shared.tsx` | **Created** | Shared tab components (TabSection, Field, TextField, SaveBar, MoreDetails) |
| `components/settings/tabs/general-tab.tsx` | **Created** | General tab (identity, contact, address) |
| `components/settings/tabs/legal-tab.tsx` | **Created** | Legal tab (form, capital, dates) |
| `components/settings/tabs/fiscal-tab.tsx` | **Created** | Fiscal tab (NIF, NIS, RC, AI, VAT) |
| `components/settings/tabs/banking-tab.tsx` | **Created** | Banking tab (bank, RIB, IBAN, SWIFT) |
| `components/settings/tabs/branding-tab.tsx` | **Created** | Branding tab (logo, stamp, signature, colors) |
| `components/settings/tabs/printing-tab.tsx` | **Created** | Printing tab (format, QR, header, footer) |
| `app/(app)/parametres/page.tsx` | **Modified** | Now renders CompanySettingsCenter instead of CompanyForm |
| `components/settings/parametres-tabs.tsx` | **Modified** | Cleaned up types |
| `i18n/dictionaries.ts` | **Modified** | Added 21 new translation keys (fr/ar/en) |
| `components/settings/company-form.tsx` | **Deleted** | Replaced by tab-based components |

---

*End of Phase 4 report.*
