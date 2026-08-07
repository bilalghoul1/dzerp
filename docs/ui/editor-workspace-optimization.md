# Editor Workspace Optimization

**Files:** `src/components/documents/document-workspace.tsx` (new), `document-editor-shell.tsx` (rewired),
`src/i18n/dictionaries.ts` (4 keys × 3 locales)
**Date:** 2026-08-06
**Scope:** UX-only. No business engine / workflow / pricing / taxes / inventory / permissions / API / DB / Prisma touched.
**Status:** Implemented. No git commit (awaiting approval).

---

## 1. Chosen solution (Option A — collapsible, persisted)

The summary panel is now **collapsible**:
- **Default: collapsed** on every load.
- A compact **sticky footer** shows HT / TVA / TTC / status / line count; clicking it expands the full summary.
- A toggle button (Afficher / Masquer) sits in a small summary header.
- **Preference persisted** in `localStorage` (`dzerp.docEditor.summaryCollapsed`), so a collapsed choice stays collapsed next session.
- When collapsed, the grid becomes **single-column** → the line editor **immediately reclaims the full width** (no reserved 300px track).

Why Option A over B/C: it keeps the summary one click away, never permanently reduces editing space,
and on large screens (≥1536px) expanding still places it in a 300px right column — smooth, no modal/drawer
complexity, no layout jump/flicker (animated `max-h`/`opacity` transition).

---

## 2. Audit — widths (px)

Fixed chrome: left sidebar `w-60` = **240px**; main padding `p-4 sm:p-6` = **48px** total.
Right panel (when present): **300px**.

### Available editing width = viewport − 240 (sidebar) − 48 (padding) − rightPanel

| Viewport | Before (original, right 320 always, sidebar 256) | v2 (right dropped below <2xl) | **This task (collapsed, default)** | This task (expanded ≥2xl) |
|----------|---------------------------------------------------|-------------------------------|------------------------------------|----------------------------|
| 1366 | 742 | 1078 | **1078** | n/a (single col, panel below) |
| 1440 | 816 | 1152 | **1152** | n/a |
| 1600 | 976 | 1312 | **1312** | 1012 |
| 1920 | 1328 | 1632 | **1632** | 1332 |

**Gain vs original at 1600/1920:** +336px / +304px reclaimed because the summary no longer
permanently reserves space — it is collapsed by default even on large screens.

### Sidebar widths
- Left navigation: **240px** (w-60) — unchanged this task (reduced 256→240 in prior v2 phase).
- Right summary: **300px** when expanded (≥2xl); **0px** when collapsed (editor full width).

### Workspace ratio (editor : chrome) at 1920
- Original: editor 1328 / total 1920 = **69%**
- **This task, collapsed:** editor 1632 / 1920 = **85%** ← primary focus achieved.
- This task, expanded (≥2xl): editor 1332 / 1920 = 69% (user opted to open summary).

---

## 3. Screens modified

- `src/components/documents/document-workspace.tsx` — **NEW**. Renders the grid + collapsible
  summary (toggle + animated full panel + compact sticky footer). Reads `useDocumentEditor()`
  (HT/TVA/TTC/lines/status) and persists collapse state.
- `src/components/documents/document-editor-shell.tsx` — removed the old hardcoded grid/aside;
  now wraps `<DocumentHeader/>` + `<DocumentTabs/>` in `<DocumentWorkspace/>` (which lives inside
  `<DocumentEditorProvider>`, so it can read editor state). Unused imports removed.
- `src/i18n/dictionaries.ts` — added `documentsUI.summaryShow`, `summaryHide`, `summaryCollapsedHint`,
  `lineCount` in FR / AR / EN.

No changes to: calculations, validation, workflow, conversion, stock, pricing, VAT, permissions,
API contracts, Prisma schema, or database.

---

## 4. Responsive behaviour

| Width | Summary default | Layout |
|-------|----------------|--------|
| < 1536px (incl. 1366 / 1440 / tablet) | collapsed | single column; editor full width; sticky footer at bottom; expand = inline full panel below editor |
| ≥ 1536px (1600 / 1920) | collapsed | single column by default; expanding switches grid to `minmax(0,1fr)_300px` (editor left, summary right) |
| Small screens | collapsed | same single-column + sticky footer; expand renders full panel inline (acts as a full-width section) |

Animations: `transition-[max-height,opacity] duration-300` on the panel; grid template switches
instantly on expand (intentional, no flicker). No empty margins when collapsed — editor uses 100%.

---

## 5. Screenshots

- Collapsed (default, editor full width + sticky footer): `docs/ui/shots/workspace-collapsed.png`
- Expanded (full statistics + related-docs sidebar, footer hidden): `docs/ui/shots/workspace-expanded.png`

Verified at runtime (viewport 1264 ≈ 1366 class):
- Collapsed → grid single-column (976px track), table fills full width, sticky footer shows HT/TVA/TTC +
  "Brouillon" badge + "1 lignes".
- Expanded → statistics panel + related-docs sidebar render, footer gone, "Masquer" toggle present.
- Numeric inputs rectangular/comfortable; headers (Prix HT, Remise %, TVA %, Montant TTC) not wrapped.

---

## 6. Quality gates

| Gate | Command | Result |
|------|---------|--------|
| Type check | `npx tsc --noEmit` | ✅ exit 0 |
| Lint | `npx eslint src/components/documents/document-workspace.tsx src/components/documents/document-editor-shell.tsx` | ✅ exit 0 |
| Build | `npm run build` | ✅ exit 0 |

All gates green. Work remains uncommitted, awaiting approval.
