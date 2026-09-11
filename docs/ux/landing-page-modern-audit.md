# Landing Page — Modern Interactive Audit

> **Type:** READ-ONLY audit. No code was changed.
> **Scope:** Public landing page served at `/` (`src/app/page.tsx`), plus the throwaway public components under `src/components/public/`, public assets, i18n/RTL/theme mechanics, and the pages it links to (`/login`, `/register`, `/faq`, `/security`).
> **Goal:** Replace the current single-hero JPG page with a modular, interactive, bilingual (AR/FR/RTL) SaaS landing following the product's real identity: Algerian multi-company ERP with Commercial → Stock → Compta → Production → RH + Payroll (IRG/CNAS) + Tax (TVA/TAP/IRG).

---

## A. Current State

### A.1 What is live today
- The public page is a single ~1221-line client component: `src/app/page.tsx` (`"use client"`), with **no server component layer**, **no exported `metadata`**, and **no viewport/OG tags of its own**.
- All copy lives in an **inline `{fr, ar, en}` dictionary** inside the same file (`type Lang = "ar" | "fr" | "en"`). Language is switched with a local `useState`, **independent from the app's real i18n stack** (`src/i18n/`, `I18nProvider`).
- Rendered via **framer-motion** (`useReducedMotion` respected) with a `fadeUp` reveal + `AnimatePresence` section pipes.
- Sections currently present (in order):
  1. Fixed translucent **nav** (dark glass: `bg-slate-950/70 backdrop-blur`) with logo, links, language dropdown 🚩, **Login**, and a **"Begin / ابدأ"** CTA.
  2. **Hero:** dark slate gradient background, eyebrow, ar + fr headline, description, two CTAs (primary emerald "Start free trial / ابدأ تجربتك المجانية"; secondary WhatsApp), and a **hero.png** product screenshot (1536×1024, **1799 KB**).
  3. **Trust/stats** row (3 counters: 9 modules, 1 platform, automatic docs).
  4. **Features grid** (6 feature cards, emerald accent icons).
  5. **Tour / screenshots section** using 4 webp images (`dz-sales`, `dz-accounting`, `dz-inventory`, `dz-dashboard`) inside light/dark "browser mockups", with per-locale captions.
  6. **Demo calculators:** a **payroll simulator** (salaire brut, plafond CNAS, taux CNAS, taux d'accident, abattement, IRG brackets) and a **TVA invoice simulator** (HT, TVA rate, TTC) — genuinely on-brand, only real interactive logic on the page.
  7. **Pricing:** 3 tiers in DZD (2 900 / 5 900 / 11 900 DZD/mois) via local dropdown.
  8. **Testimonials / social proof** cards.
  9. **FAQ** accordion (6 questions, own state, no `<details>` semantics).
  10. **Final CTA** + **footer** with WhatsApp link (`+213777321649`) and language pills.
- Nav and footer are **inline in the same file** (`page.tsx`) — no shared `PublicNav`/`PublicFooter`.

### A.2 Dead-code twin
- `src/components/public/` contains a **second, abandoned implementation** used by nothing:
  - `landing-page.tsx` (429 lines) — a more elaborate landing with `PublicNav`, `PublicFooter`, module cards, `SceneImage`, `AmbientBlob`, `BrowserMockup`.
  - `public-nav.tsx`, `public-footer.tsx`, `scene-image.tsx`, `landing-art.tsx` (420 lines: Browser/Laptop/Phone mockups, `DocumentPreview`, `MiniCharts`, etc.).
- Grep confirms nothing imports `landing-page.tsx`; it consumes `t("landing.*")` keys from the real `src/i18n/dictionaries.ts` (3 `landing:` blocks, ~1768/3647/5530) which are otherwise unused.
- The abandoned twin is a valuable **source of reusable art** (BrowserMockup, DocumentPreview, mini widget UI) but must not be "wired in" as-is.

### A.3 Assets (audit)
| Asset | Size | Dims | Used? |
|---|---|---|---|
| `public/landing/hero.png` | **1799 KB** | 1536×1024 | Yes (hero) |
| `public/landing/dz-sales.webp` | 4.4 KB | — | Yes (tour) |
| `public/landing/dz-accounting.webp` | 5.6 KB | — | Yes (tour) |
| `public/landing/dz-inventory.webp` | 9.0 KB | — | Yes (tour) |
| `public/landing/dz-dashboard.webp` | 10.3 KB | — | Yes (tour) |
| `public/landing/dz-hero.webp` | 9.3 KB | — | No |
| `public/landing/dz-hr.webp` / `dz-cta.webp` / `dz-integration.webp` / `dz-algeria.webp` / `dz-production.webp` | 5–9 KB | — | No |
| `public/landing/features.png` | 241 KB | 1200×800 | No |
| `public/landing/campaign-preview.jpg` | 687 KB | 1408×768 | No |
| `public/landing/*.svg` (hero.svg, integration.svg, algeria.svg, … 12 SVGs) | — | — | No |
| `assets/images/hero.png`, `assets/images/features (1).jpg` | — | — | Orphaned copies in non-public dir (unused) |

- The only heavyweight on the critical path is `hero.png` (1.8 MB) — a top LCP offender.
- The whole `dz-*.webp` family is tiny and designed; **the tour section was clearly intended to be the product showcase**, but 5 of them are never used.

### A.4 Mechanics that affect the design
- **Layout** (`src/app/layout.tsx`): fonts **IBM Plex Sans + IBM_Plex_Sans_Arabic** via `next/font/google`; `metadata.title` is the single static French string; `dir` and `theme` come from **cookies** written by `I18nProvider`/`ThemeProvider`.
- **I18n real stack:** `src/i18n/index.ts` (locales fr/ar/en, `getDirection`, dot-path translator), `src/features/i18n/i18n-provider.tsx` (persists locale to **localStorage + cookie**, sets root `lang`/`dir`). The landing page bypasses it.
- **Theme:** `src/features/theme/theme-provider.tsx` + `bootstrap-script.tsx` (afterInteractive anti-FOUC). The landing uses its own fixed dark hero palette with **emerald/cyan** accents, while the app itself is **Material 3 green** (`--primary #00482f`, `@custom-variant dark` in `globals.css`).
- **Styling:** Tailwind v4 via `@import "tailwindcss"` + `tw-animate-css` + material-symbols.
- **Auth CTAs:** `/login` (client form with its own i18n/theme + first-login password change), `/register` (server redirect if authed → `register-form.tsx`). Both use **Material symbols + theme-token classes**, i.e. they look like a *different brand* than the landing (dark slate / emerald).
- **Footer links** `/faq` and `/security` are **Arabic-only, hardcoded `dir="rtl"` pages** — a locale island.
- `reference-ui/DESIGN.md` is referenced in a `globals.css` comment but **does not exist**.

### A.5 Known-good anchors to preserve
- `useReducedMotion` guard 👍
- Real interactive calculators (payroll IRG/CNAS, TVA) — brand-defining, rare
- Real WhatsApp lead path (`wa.me/+213777321649` with default Arabic message)
- Small, efficient `dz-*.webp` art family already tuned
- `next/font` self-hosting (no external font requests)

---

## B. Problems

### B.1 Identity & trust (highest impact)
1. **Wrong visual identity.** The app is emerald/white Material-3 with Arabic+French; the public page is dark-slate **emerald/cyan** glass. Login/Register/pages look like another product. A prospect who "tries it" meets a totally different interface.
2. **Nav links point to sections that encourage SaaS scrolling but the page never explains the *workflow* (Ventes → Stock → Compta)** — the demo calculators are the only "why DzERP is different" element; they are buried mid-page and not presented as a mini product tour.
3. **No section storytelling.** Modules are a flat feature card grid; there is no "one document flows through the whole company" narrative, no multi-company/multi-branch panel, no tax-ecosystem panel.
4. **The `integration`/`algeria`/`cta` SVG art and 5 unused webp are proof of a richer intended design that got cut in half.**

### B.2 SEO & metadata (high impact, free to fix)
5. `/` has **no `metadata`, no OG, no title beyond the static layout French string**, no per-locale titles. It is invisible to search for "ERP Algérie", "logiciel de gestion Algérie", etc., and shares links on WhatsApp/Telegram/Slack with no preview image.
6. Header `<h1>` is the hero eyebrow/title but the **layout already emits one `title`**; headings hierarchy is loose (h2s with arbitrary big sizes), pricing uses `<h3>` — acceptable but improvable.

### B.3 Performance (high impact)
7. **hero.png = 1.8 MB** at 1536×1024 is the LCP image. Next's `Image` optimizer alone won't fix the *source* weight; a webp/avif re-encode at ~1200×800 would cut ~90%.
8. `page.tsx` is an all-client component: **no caching route, no `export const dynamic`**, styles and JS for the entire page get shipped even for crawler/first paint. Framer-motion batch animations add layout work; `AnimatePresence` on every section.
9. Material-symbols + lucide + tw-animate-css pull font/icon assets for one marketing page.
10. Flags (🇩🇿🇫🇷🇬🇧) and emoji in copy are cheap but rendering-heavy on Windows; minor.

### B.4 i18n / RTL consistency (high impact)
11. **The page's own local language state is disconnected** from the persisted app locale: a user switches to AR on `/`, navigates to `/login`, and the interface jumps back to the cookie locale (often `fr`). Direction flips only inside `page.tsx`'s wrapper `dir`, not via the root.
12. `/faq` and `/security` are **Arabic-only** while landing is trilingual; footer pills lie ("Arabic · French").
13. A single inline dictionary means ar/fr/en copy lives outside the real `src/i18n/` system — translators can't extend it, and `t("landing.*")` keys (already in `dictionaries.ts`) are dead.

### B.5 Structure & maintainability (medium impact)
14. 1221-line single file: real risk of edit collisions; no composable sections.
15. Two landing implementations coexist (`src/app/page.tsx` live, `src/components/public/*` dead) — safe to reuse art only, not to keep both.
16. `docs` says `reference-ui/DESIGN.md` exists — it doesn't; the design tokens are only discoverable by reading `globals.css`.

### B.6 Accessibility (medium impact)
17. FAQ accordion uses custom buttons without `aria-expanded`/`id`/`controls`; no `<details>` semantics.
18. Language switcher lacks proper `aria-haspopup`, listbox roles; the country flags carry `aria-hidden`? (no) — assistive tech reads "🇩🇿".
19. Hero is a contrast-heavy dark-on-dark; text `text-slate-200` on `slate-950/gradient` may fail AA at small sizes.
20. Counters/anchors: `scroll-behavior` and anchor offsets are fine, but there is no skip-link.

---

## C. Proposed Design

New landing structure (one cohesive Material-3, bilingual, AR-first-friendly, aligns with the app's emerald/white identity):

```
[0] Announcement bar (thin, dismissible): "14-day free trial, no card needed" (localized)
[1] Nav — sticky, glass, Material-3, logo + docs-link dropdown + lang (real I18nProvider) + theme toggle + [Se connecter] + [CTA Essayer]
[2] HERO — interactive product preview
     ├─ headline AR + FR, one eyebrow
     ├─ two CTAs: [Essayer gratuitement 14 jours] [Demander une démo (WhatsApp)]
     └─ interactive panel: a REAL mini-DzERP window (BrowserMockup):
        left: module rail (Commercial, Stock, Compta, RH) — click switches the preview
        main: mini widgets (revue du jour: chiffre d'affaires, TVA, stock bas) + a «document» card flow
        the preview copies the app UI (Material symbols, --primary #00482f, cards, tables)
[3] Stats strip — 4 counters: 9 modules · 1 platform · 3 langues (AR/FR) · 14 jours d'essai (animated count-up)
[4] Product/dashboard preview — large still (webp, no autoplay) in a Laptop frame with caption switcher
[5] BENTO grid — modules as tiles of varied sizes (Commercial / Stock / Achats / Compta / Production / RH+Paie / Tax), each tile = icon + title + mini UI glimpse (like DocumentPreview/MiniSpan)
[6] Module storytelling — 2 alternating split rows:
     6.1 Devis → Bon → Facture → BL (Commercial)
     6.2 Stock → RM → Production → Coût (Stock/PM)
     6.3 Écriture → TVA → TAP → IRG (Compta/Fisc)  ← the tax coma
[7] Currency/Tax ecosystem panel — Algerian chips: TVA (19% / 9% / 0%), TAP, IRG, CNAS, CASNOS, SCF, bilingue AR/FR — with a mini TVA invoice calculator (move existing simulator here, dressed up)
[8] Workflow section — Ventes → Stock → Compta as a 3-step flow diagram (SVG arrows, RTL-aware flip)
[9] Multi-company / multi-branch panel — with a real screenshot crop (multi-tenant isolation) + security badges (SSL, audit log, RBAC)
[10] Trust/testimonials — 3 short quotes + a "used modules" chip cloud
[11] Pricing — 3 tiers DZD, AR/FR, monthly billing toggle, "www / entreprise / multi-entreprise" labels
[12] Final CTA — emerald panel: [Démarrer l'essai] [WhatsApp démo]
[13] Footer — real shared component: links (/faq, /security, contact), lang, WhatsApp, © 2026
```

Visual system: **Material-3 white/emerald light + dark-mode switch** using the app's `theme-provider` tokens (CSS vars from `globals.css:` `--primary`, `--surface-*`, `--background`). Hero keeps subtle warm gradient (amber-tinted, like the CTA blob tone) instead of dark slate. Accent colors used sparingly per module (Commercial=green, Stock=teal, Compta=indigo, RH=rose) — applied only in icon tints, never on text.

---

## D. Interaction Plan

### D.1 Motion philosophy (already partially enforced → keep)
- **All defined animations go through variants that respect `useReducedMotion`** (existing `fadeUp` pattern is the template).
- **No autoplay/video.** The only time-based animation allowed: the stats count-up (runs once on first view, ~600 ms, prefers-reduced-motion → instant).

### D.2 Micro-interactions catalogue
| Interaction | Trigger | Effect | Priority |
|---|---|---|---|
| Section reveal | scroll into viewport (once) | fade+translate (24 px), stagger 60–80 ms | P1 |
| Nav | scroll | sticky + glass (bg blur + border-bottom) | P1 |
| Hero module rail | click/tap | right-panel content crossfades (AnimatePresence 150 ms), active rail item tint | P1 |
| Stats | first view | count-up 0→N (DZD/tiers) | P2 |
| Bento tiles | hover | tile lifts 2 px, icon tint saturates, mini-UI shadows | P2 |
| FAQ (real `<details>`) | open/close | smooth `grid-template-rows` animation (CSS, no JS lib) | P2 |
| Lang switch | click | instantly swaps `dir`+text (no full reload if we move to I18nProvider) | P1 |
| Theme toggle | click | `dark` class swap, icons swap | P1 |
| WhatsApp CTA | click | `wa.me` deep-link with localized msg | P1 |
| Nav mobile | hamburger | slide-down panel (once) — no spotify-style sheet | P2 |

### D.3 Micro-copy requirements for the hero panel (localized ar/fr/en)
- Keep "Essai 14 jours sans carte bancaire" as the primary trust line.
- The default WhatsApp message must stay localized (`السلام عليكم، أريد…` for AR, French/English equivalents for others).

---

## E. Component Plan

New file layout (`src/components/public/` reused/rebuilt — **strongly prefer a fresh `src/components/landing/`** so we don't drag the old twin):

```
src/components/landing/
  landing-page.tsx            # server component composition root (imports metadata-cfgs here? see below)
  landing-nav.tsx             # sticky nav (client, uses I18nProvider + theme)
  landing-footer.tsx          # shared footer (client-lite)
  hero.tsx                    # hero headline + CTAs
  hero-preview.tsx             # interactive module preview (client)
  module-rail.tsx              # rail + mini widgets, reuses mockup/art
  device-mockups.tsx           # BrowserMockup / LaptopMockup / PhoneMockup (moved art from landing-art.tsx)
  document-flow.tsx            # Devis→Bon→Facture→BL steps
  tax-panel.tsx                # Algerian tax chips + TVA simulator (moved from page.tsx)
  payroll-simulator.tsx        # moved IRG/CNAS simulator
  workflow-section.tsx         # Ventes→Stock→Compta
  bento-grid.tsx               # module tiles + module data model (localized)
  multi-tenant-section.tsx
  stats-strip.tsx              # count-up
  pricing.tsx                  # 3 tiers DZD
  faq.tsx                      # <details>-based, 6–8 items
  final-cta.tsx
  ui/reveal.tsx                # motion wrapper (respects reduced motion)
  ui/section.tsx               # section head (eyebrow + title + sub)
```

- **i18n:** all copy moves **out of inline dict** into `src/i18n/dictionaries.ts` by replacing/expanding the dead `landing:` blocks with `home:` (ar/fr/en) — or keep `landing:` keys and consume them with `useI18n`. The page root => a thin server component reading the cookie (like `/register`) so `metadata` can be exported **per locale**.
- **Metadata:** `page.tsx` gets `export const metadata` (title/description/OG) localized via the router-locale/cookie, plus `viewport`. OG image: reuse the dashboard webp/hero art (see Asset Plan).
- **Auth CTAs** keep pointing to `/login` and `/register` — no new auth logic. Nav shows "Se connecter" + "Essayer" (unauthenticated) and swaps to "Ouvrir l'app" (+ user chip) when a session cookie exists — same check used by `/register` (`/api/auth/me`), not new auth code.

Existing files touched (execution phase only):
- `src/app/page.tsx` → reduced to composition + metadata.
- `src/app/layout.tsx` → possibly localized title (already cookie-aware), no structural change.
- `src/i18n/dictionaries.ts` → land `home/landing` keys (currently dead → now used).
- `src/app/faq/page.tsx`, `src/app/security/page.tsx` → trilingual + theme-token styling (currently Arabic-only).
- `src/app/login/page.tsx`, `register-form.tsx` → align brand tokens if needed (they already use theme tokens; mainly accent cleanup).

---

## F. Asset Plan

### F.1 Source-weight fixes (execution)
1. **hero re-encode:** `hero.png` (1536×1024, 1.8 MB) → webp/avif at 1200×800 (or 1440×900) ≈ **~120–200 KB**, keep an `xl` 1440 variant for `2x` displays. Delete the PNG from `public/landing/` (replace by `hero.webp` + optional `hero@2x.webp`). *(Runtime: execution phase; audit constraint: READ-ONLY → do not delete now.)*
2. **Reuse the idle `dz-*.webp` set** in tour/module storytelling instead of generating new art — they are already lightweight (4–10 KB).
3. **Delete orphaned assets** listed in A.3 (`features.png`, `campaign-preview.jpg`, and the non-public `assets/images/*` copies) in execution — flag for removal, do not remove during this audit.
4. **SVG art family** (`integration.svg`, `algeria.svg`, `cta.svg`, `multibusiness.svg`, …): reuse as decorative background art (as the old twin did via `SceneImage`), not as main content images.

### F.2 New/rebuild assets needed
| Asset | Type | Purpose |
|---|---|---|
| `brand/dz.svg` favicon/mark | SVG | OG/favicon consistent green mark |
| OG image | 1200×630 webp/png | per-locale og:image via static generator at build |
| Bento tile mini-UI | inline SVG/JSX components | tile glimpses (DocumentPreview, MiniSpan from `landing-art.tsx`) |
| Workflow arrows | inline SVG | Ventes→Stock→Compta, RTL-flippable |
| Hero panel art | JSX components + cropped dashboard webp | module preview, no new photography |
| Avatar/testimonial | initial-based circles (no photos) | trust strip |

### F.3 Fonts
- Keep `IBM Plex Sans` + `IBM_Plex_Sans_Arabic` via `next/font` (already self-hosted). No new font downloads. For headings AR maybe weight bump to 800 for the eyebrow.

---

## G. RTL / LTR Plan

1. **Move language control to the real stack:** consume `useI18n()` from `i18n-provider` everywhere on `/`; the provider already sets root `dir`, `lang`, and persists cookie+localStorage → landing, login, register, app all agree.
2. **Direction-safe primitives only in new components:** use logical props everywhere (`ms`, `me`, `ps`, `pe`, `start`, `end`, `text-start/end`).
3. **Hero preview rail:** in AR, rail sits on the right, preview slides to the left (CSS logical order + flex-row-reverse via `dir`).
4. **Workflow arrows:** SVG `Ventes→Stock→Compta` must be mirrored for RTL (flip on `:dir(rtl)` or via CSS `dir`/`rtl` attribute → `scaleX(-1)` on the arrow group; read `writing-mode`/text direction of steps).
5. **Pricing/currency:** DZD always; formatting uses `Intl.NumberFormat('fr-DZ'/'ar-DZ')` the same way `formatDZD` already does — extend to AR digits choice (`ar-DZ` vs `ar`).
6. **FAQ/security pages trilingual:** `/faq` and `/security` get locale from cookie + `dir` set by provider (or their own `useI18n` — they are static server components; simplest: accept `locale` search/cookie + generate localized static pages server-side, consistent with what `/register` does).
7. **Testing matrix:** for AR and FR (and EN as best-effort):
   - `dir=rtl` on `<html>`; verify the OS/scrollbars, floating buttons, hero preview panel, pricing tables, FAQs, final CTA buttons, nav drawer — no hard left/right classes (`left-*-*`, `right-*-*`) except decorative ones that are inconsequential (blobs/glows).
   - Screenshot at 375 / 768 / 1440 both dirs.

---

## H. Responsive Plan

| Breakpoint | Behavior |
|---|---|
| < 640 | Nav → hamburger drawer; hero → stacked, preview panel below CTAs full-width; bento → single column with big title tile; workflow arrows → vertical (SVG group rotated) or step list; pricing stacked; product preview full-bleed cropped |
| 640–1024 | bento 2 cols; hero preview beside on tablet landscape; module storytelling alternates but keeps 1-col if cramped |
| ≥ 1024 | All original layouts (nav inline links, bento 4-col with spans, hero 2-col, workflow 3-col) |

- All new components tested against the existing audit tools pattern (the repo generates design-audit PDFs for prints; for landing we add a **static checklist** — not a headless browser, which isn't installed).
- Touch targets ≥ 44 px on all interactive elements (existing requirement pattern in the app).
- The nav drawer, hero rail, FAQ toggles: all ≥ 44 px hit areas.

---

## I. Performance Plan

### I.1 Targets
- **LCP < 2.5 s** on 4G mid device: the hero preview must render as **below-the-fold-lazy**; hero panel is interactive so it cannot be 100% static — but the *paint* image is a webp `Image` with `priority`, bounded at 1200px.
- **Total page weight < ~450 KB** (down from ~2.5 MB+ incl. JS+fonts after hero.png re-encode).

### I.2 Concrete levers
1. `next/image` everywhere, explicit `sizes`, `priority` only on hero art, `loading="lazy"` on tour/storytelling visuals.
2. Re-encode hero (F.1). This alone removes ~1.6 MB of LCP.
3. Move the page to **server-component shell + client islands**: sections that can be static (bento copy, workflow, trust header, footer, FAQ text) render on the server; only interactive islands (nav lang/theme, hero preview, simulators, pricing toggle, FAQ toggle, stats count-up, drawer) become client `"use client"` chunks — cut JS parse cost dramatically (framer-motion only in islands that need it, ideally confined to `ui/reveal.tsx`).
4. `export const dynamic = "force-static"` on `/` (it's not auth-sensitive) so the route memoizes; locale variations are client-switched, not per-URL routes — no dynamic rendering blowup.
5. Self-host everything already (fonts, icons). Drop the unused material-symbols **full sheet** if only a dozen icons are used — use `subset`/`unpkg-less` approach or keep the sheet but `display=block`; weigh cost: keep scope conservative — reuse existing `material-symbols-outlined` that the app already loads.
6. Replace nested `AnimatePresence` around every section with the current single `fadeUp` variant pattern + `IntersectionObserver`; disable on reduced-motion.

### I.3 Audit-only numbers
- Current `/` with hero.png: hero image request ≈ 1.8 MB; document payload ≈ client-chunk.
- Fix removes ~1.6 MB download *and* half the main-thread parse (islands).

---

## J. Implementation Roadmap

> Execution is **outside this READ-ONLY audit**; steps are ordered to keep the route in production at every step and each commit green (`lint`, `build`, `tsc --noEmit`).

### Phase 0 — Foundations (P0, no visible change)
1. Copy reusable art from `src/components/public/landing-art.tsx` into fresh `src/components/landing/` (BrowserMockup/LaptopMockup/PhoneMockup, DocumentPreview, chips, mini charts) — **do not import the abandoned twin**.
2. Expand `src/i18n/dictionaries.ts` dead `landing:` blocks → complete `home:` set for ar/fr/en (hero, nav, stats, bento, workflow, tax, multi-tenant, pricing, faq, footer). Delete inline dict from `page.tsx`.
3. Add `ui/reveal.tsx` (fadeUp + reduced-motion switch) and `ui/section.tsx`.
4. Re-encode hero art → `public/landing/hero.webp` (+`@2x`), keep sizes; add OG image 1200×630 + `/` metadata (`title`, `description`, `openGraph`) localized via cookie at request time (like `/register` does).

### Phase 1 — Core rebuild (P1)
5. Replace `src/app/page.tsx` content with the server-shell composition: `landing-page` imports `ui/reveal`-wrapped sections; keep `export const dynamic = "force-static"` + exported `metadata`.
6. Build `landing-nav` (sticky glass, real `useI18n` + theme toggle, auth-aware CTA via `/api/auth/me`, mobile drawer) and `landing-footer` (shared).
7. Build `hero` + `hero-preview` (module rail × mini widgets, all logical-props).
8. Build `stats-strip` and `product-preview` section with `LaptopMockup` + webp captions.
9. Swap `/login` + `/register` header CTAs to the new shared nav (no auth-logic change).

### Phase 2 — Storytelling modules (P2)
10. `bento-grid` (module tiles + DocumentPreview glimpses), `module-story` split rows, `workflow-section` (SVG arrows, RTL flippable).
11. `tax-panel` (TVA chips + TVA simulator — port from page.tsx) and `payroll-simulator` (port IRG/CNAS), both now server-wrapped, interactive islands.

### Phase 3 — Conversion & polish (P2)
12. `multi-tenant-section`, `pricing` (3 tiers DZD, AR/FR), `faq` → real `<details>/<summary>` with CSS-only open/close animation, `final-cta` + `testimonials`.
13. Screen reader pass: `aria-expanded`, listbox on lang, caption text on mockups, no flag-emoji-a11y (use text labels + country code).

### Phase 4 — Multi-page consistency (P3)
14. Localize `/faq` and `/security` to ar/fr/en (server static per cookie) + align theme tokens.
15. Asset cleanup: remove verified-orphan files (`features.png`, `campaign-preview.jpg`, `assets/images/*` copies, unused `dz-*` webp only if no new section uses them) — **each removal in its own commit**, re-verified by build + `git status`.
16. Delete the dead `src/components/public/` twin only after confirming zero imports (it already is zero; final grep + `rm` in execution).

### Phase 5 — Verify (each phase gates)
- `npx tsc --noEmit` clean; `npm run lint` 0 new errors; `npm run build` green.
- Manual pass at 375/768/1440 × AR/FR × light/dark (RTL matrix from Section G). Performance re-measure: LCP & total weight vs. current baseline.

---

## Risks & guardrails (for the execution phase)
- **Do not touch** the print engine, document engine, accounting, RBAC, or schema in any landing work — landing only *displays* product concepts already implemented (calcs, WhatsApp, i18n).
- `faq` claims must stay consistent with `/faq` content (tax: "engine computes TVA/TAP/IRG; confirm with your advisor" — mirror existing wording).
- Pricing DZD values already exist on the page (2900/5900/11900); if real pricing is unknown, keep the existing numbers **unchanged** rather than inventing new ones.
- WhatsApp number `+213777321649` is the only conversion channel; preserve and localize its default message.
- **This audit changed nothing.** After the audit phase, `git status` must only show this report.