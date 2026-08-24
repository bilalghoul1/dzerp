"use client";

import * as React from "react";
import Link from "next/link";
import { useI18n } from "@/features/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { PublicNav } from "@/components/public/public-nav";
import { PublicFooter } from "@/components/public/public-footer";
import { SceneImage } from "@/components/public/scene-image";
import {
  AmbientBlob,
  DocumentsHubUI,
  CrmUI,
  InventoryUI,
  HrUI,
  DashboardUI,
} from "@/components/public/landing-art";

type Card = { icon: string; title: string; desc: string };

export function LandingPage({ isAuthed = false }: { isAuthed?: boolean }) {
  const { t, locale } = useI18n();
  const isAr = locale === "ar";

  const modules: { icon: string; title: string; desc: string; ui: React.ReactNode }[] = [
    { icon: "sell", title: t("landing.moduleCommercialTitle"), desc: t("landing.moduleCommercialDesc"), ui: <DocumentsHubUI /> },
    { icon: "group", title: t("landing.modulePartiesTitle"), desc: t("landing.modulePartiesDesc"), ui: <CrmUI /> },
    { icon: "inventory_2", title: t("landing.moduleStockTitle"), desc: t("landing.moduleStockDesc"), ui: <InventoryUI /> },
    { icon: "shopping_bag", title: t("landing.modulePurchaseTitle"), desc: t("landing.modulePurchaseDesc"), ui: <DocumentsHubUI /> },
    { icon: "account_balance", title: t("landing.moduleAccountingTitle"), desc: t("landing.moduleAccountingDesc"), ui: <DashboardUI /> },
    { icon: "precision_manufacturing", title: t("landing.moduleProductionTitle"), desc: t("landing.moduleProductionDesc"), ui: <InventoryUI /> },
    { icon: "badge", title: t("landing.moduleHrTitle"), desc: t("landing.moduleHrDesc"), ui: <HrUI /> },
    { icon: "description", title: t("landing.moduleDocsTitle"), desc: t("landing.moduleDocsDesc"), ui: <DocumentsHubUI /> },
  ];

  // 6 panels matching the features.png showcase image (2 rows x 3 cols).
  const featurePanels: { icon: string; title: string; desc: string }[] = [
    { icon: "sell", title: t("landing.moduleCommercialTitle"), desc: t("landing.moduleCommercialDesc") },
    { icon: "inventory_2", title: t("landing.moduleStockTitle"), desc: t("landing.moduleStockDesc") },
    { icon: "account_balance", title: t("landing.moduleAccountingTitle"), desc: t("landing.moduleAccountingDesc") },
    { icon: "precision_manufacturing", title: t("landing.moduleProductionTitle"), desc: t("landing.moduleProductionDesc") },
    { icon: "badge", title: t("landing.moduleHrTitle"), desc: t("landing.moduleHrDesc") },
    { icon: "verified_user", title: t("landing.moduleComplianceTitle"), desc: t("landing.moduleComplianceDesc") },
  ];

  const benefits: Card[] = [
    { icon: "hub", title: t("landing.benefit1Title"), desc: t("landing.benefit1Desc") },
    { icon: "insights", title: t("landing.benefit2Title"), desc: t("landing.benefit2Desc") },
    { icon: "auto_awesome", title: t("landing.benefit3Title"), desc: t("landing.benefit3Desc") },
    { icon: "dataset", title: t("landing.benefit4Title"), desc: t("landing.benefit4Desc") },
    { icon: "visibility", title: t("landing.benefit5Title"), desc: t("landing.benefit5Desc") },
    { icon: "description", title: t("landing.benefit6Title"), desc: t("landing.benefit6Desc") },
  ];

  const algeria: Card[] = [
    { icon: "translate", title: t("landing.algeria1Title"), desc: t("landing.algeria1Desc") },
    { icon: "payments", title: t("landing.algeria2Title"), desc: t("landing.algeria2Desc") },
    { icon: "gavel", title: t("landing.algeria3Title"), desc: t("landing.algeria3Desc") },
    { icon: "corporate_fare", title: t("landing.algeria4Title"), desc: t("landing.algeria4Desc") },
  ];

  const why = [
    t("landing.why1"), t("landing.why2"), t("landing.why3"), t("landing.why4"),
    t("landing.why5"), t("landing.why6"), t("landing.why7"),
  ];

  // Central asset map: each value points to a generated/provided scene.
  const assets = {
    hero: "/landing/hero.png",
    features: "/landing/features.png",
    dashboard: "/landing/dz-dashboard.webp",
    commercial: "/landing/dz-sales.webp",
    sales: "/landing/dz-sales.webp",
    crm: "/landing/dz-hr.webp",
    inventory: "/landing/dz-inventory.webp",
    accounting: "/landing/dz-accounting.webp",
    production: "/landing/dz-production.webp",
    hr: "/landing/dz-hr.webp",
    algeria: "/landing/dz-algeria.webp",
    integration: "/landing/dz-integration.webp",
    cta: "/landing/dz-cta.webp",
  };

  const heroTitle1 = isAr ? t("landing.heroTitleArLine1") : t("landing.heroTitleLine1");
  const heroTitle2 = isAr ? t("landing.heroTitleArLine2") : t("landing.heroTitleLine2");
  const heroDesc = isAr ? t("landing.heroDescAr") : t("landing.heroDesc");
  const finalTitle = isAr ? t("landing.finalCtaTitleAr") : t("landing.finalCtaTitle");
  const finalSub = isAr ? t("landing.finalCtaSubtitleAr") : t("landing.finalCtaSubtitle");
  const ctaHref = isAuthed ? "/dashboard" : "/login";
  const ctaLabel = isAuthed ? t("common.nav.dashboard") : t("landing.login");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicNav isAuthed={isAuthed} />

      <main className="flex-1 overflow-x-clip">
        {/* ============================ HERO ============================ */}
        <section className="relative isolate">
          <AmbientBlob className="-top-32 -start-24 h-96 w-96" />
          <AmbientBlob tone="amber" className="top-24 -end-32 h-80 w-80" />
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[5fr_7fr] lg:py-24">
            <div className="dz-reveal">
              <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
                <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">eco</span>
                {t("landing.heroEyebrow")}
              </span>
              <h1 className="mt-6 text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl lg:text-5xl" style={isAr ? { fontWeight: 800, lineHeight: 1.25 } : undefined}>
                {heroTitle1}
                <span className="mt-1 block text-primary">{heroTitle2}</span>
              </h1>
              <p className="mt-6 max-w-xl text-base text-muted-foreground">{heroDesc}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="w-full sm:w-auto"><Link href={ctaHref}>{ctaLabel}</Link></Button>
                <Button asChild size="lg" variant="outline" className="w-full sm:w-auto"><a href="#modules">{t("landing.ctaDiscover")}</a></Button>
              </div>
            </div>
            <div className="relative dz-reveal" style={{ animationDelay: "120ms" }}>
              <SceneImage src={assets.hero} alt="L'écosystème DzERP : une plateforme pour piloter toute votre entreprise" priority className="dz-float-slow" />
            </div>
          </div>
        </section>

        {/* ====================== FEATURES GRID ====================== */}
        <section className="border-t bg-[color:var(--surface-container-lowest)] py-16 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <span className="text-sm font-semibold uppercase tracking-wide text-primary">
              {t("landing.featuresGridEyebrow")}
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              {t("landing.featuresGridTitle")}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {t("landing.featuresGridSubtitle")}
            </p>
          </div>
          {/* Image carries embedded FR/EN captions; the localized
              explainer cards below describe each module in the active language. */}
          <div className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
            <SceneImage
              src={assets.features}
              alt="Les modules DzERP : commercial, stock, comptabilité, production, RH et conformité Algérie"
              className="dz-reveal rounded-2xl"
              priority
            />
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featurePanels.map((m) => (
                <div
                  key={m.title}
                  className="flex items-start gap-3 rounded-2xl border bg-card p-4"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                      {m.icon}
                    </span>
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{m.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{m.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ==================== COMMERCIAL DOCUMENTS ==================== */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
            <div className="dz-reveal">
              <span className="text-sm font-semibold uppercase tracking-wide text-primary">{t("landing.showcaseDocsTitle")}</span>
              <p className="mt-4 text-lg text-muted-foreground">{t("landing.showcaseDocsSubtitle")}</p>
            </div>
            <div className="relative dz-reveal" style={{ animationDelay: "120ms" }}>
              <SceneImage src={assets.commercial} alt="Générez vos documents commerciaux en quelques clics" />
              <div className="absolute -bottom-6 end-2 hidden w-56 rounded-2xl border border-primary/15 bg-card/95 p-3 shadow-xl backdrop-blur sm:block">
                <DocumentsHubUI />
              </div>
            </div>
          </div>
        </section>

        {/* ==================== SALES CYCLE ==================== */}
        <section className="border-t bg-[color:var(--surface-container-lowest)] py-16 sm:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
            <div className="dz-reveal">
              <span className="text-sm font-semibold uppercase tracking-wide text-primary">{t("landing.moduleCommercialTitle")}</span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t("landing.moduleCommercialTitle")}</h2>
              <p className="mt-4 text-lg text-muted-foreground">{t("landing.moduleCommercialDesc")}</p>
              <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-[18px]">receipt_long</span> Devis &amp; Proforma</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-[18px]">point_of_sale</span> Factures &amp; Avoirs</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-[18px]">local_shipping</span> Bons de livraison</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-[18px]">payments</span> Encaissements &amp; relances</li>
              </ul>
            </div>
            <div className="relative dz-reveal" style={{ animationDelay: "120ms" }}>
              <SceneImage src={assets.sales} alt="Du devis à l'encaissement : pilotez votre cycle de vente" />
              <div className="absolute -bottom-6 end-2 hidden w-56 rounded-2xl border border-primary/15 bg-card/95 p-3 shadow-xl backdrop-blur sm:block">
                <DocumentsHubUI />
              </div>
            </div>
          </div>
        </section>

        {/* ===================== CRM ===================== */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
            <div className="relative dz-reveal order-2 lg:order-1">
              <SceneImage src={assets.crm} alt="Gérez vos clients et fournisseurs" />
              <div className="absolute -bottom-6 -start-4 hidden w-56 rounded-2xl border border-primary/15 bg-card/95 p-3 shadow-xl backdrop-blur sm:block">
                <CrmUI />
              </div>
            </div>
            <div className="dz-reveal order-1 lg:order-2" style={{ animationDelay: "120ms" }}>
              <span className="text-sm font-semibold uppercase tracking-wide text-primary">{t("landing.modulePartiesTitle")}</span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t("landing.modulePartiesTitle")}</h2>
              <p className="mt-4 text-lg text-muted-foreground">{t("landing.modulePartiesDesc")}</p>
            </div>
          </div>
        </section>

        {/* ===================== INVENTORY ===================== */}
        <section className="border-t bg-[color:var(--surface-container-lowest)] py-16 sm:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
            <div className="dz-reveal">
              <span className="text-sm font-semibold uppercase tracking-wide text-primary">{t("landing.showcaseInventoryTitle")}</span>
              <p className="mt-4 text-lg text-muted-foreground">{t("landing.showcaseInventorySubtitle")}</p>
              <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-[18px]">inventory_2</span> Produits</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-[18px]">warehouse</span> Entrepôts</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-[18px]">swap_horiz</span> Mouvements</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-[18px]">fact_check</span> Inventaire</li>
              </ul>
            </div>
            <div className="relative dz-reveal" style={{ animationDelay: "120ms" }}>
              <SceneImage src={assets.inventory} alt="Maîtrisez vos stocks en un coup d'œil" />
              <div className="absolute -bottom-6 end-2 hidden w-52 rounded-2xl border border-primary/15 bg-card/95 p-3 shadow-xl backdrop-blur sm:block">
                <InventoryUI />
              </div>
            </div>
          </div>
        </section>

        {/* ===================== ACCOUNTING ===================== */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
            <div className="relative dz-reveal order-2 lg:order-1">
              <SceneImage src={assets.accounting} alt="Votre comptabilité sous contrôle" />
            </div>
            <div className="dz-reveal order-1 lg:order-2" style={{ animationDelay: "120ms" }}>
              <span className="text-sm font-semibold uppercase tracking-wide text-primary">{t("landing.showcaseAccountingTitle")}</span>
              <p className="mt-4 text-lg text-muted-foreground">{t("landing.showcaseAccountingSubtitle")}</p>
            </div>
          </div>
        </section>

        {/* ===================== PRODUCTION ===================== */}
        <section className="border-t bg-[color:var(--surface-container-lowest)] py-16 sm:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
            <div className="dz-reveal">
              <span className="text-sm font-semibold uppercase tracking-wide text-primary">{t("landing.showcaseProductionTitle")}</span>
              <p className="mt-4 text-lg text-muted-foreground">{t("landing.showcaseProductionSubtitle")}</p>
              <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-[18px]">schema</span> Nomenclatures (BOM)</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-[18px]">precision_manufacturing</span> Ordres de fabrication</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-[18px]">settings</span> Machines</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-[18px]">hub</span> Centres de charge</li>
              </ul>
            </div>
            <div className="dz-reveal" style={{ animationDelay: "120ms" }}>
              <SceneImage src={assets.production} alt="Pilotez votre production" />
            </div>
          </div>
        </section>

        {/* ===================== HR ===================== */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
            <div className="relative dz-reveal order-2 lg:order-1">
              <SceneImage src={assets.hr} alt="Structurez vos équipes et votre organisation" />
              <div className="absolute -bottom-6 -start-4 hidden w-56 rounded-2xl border border-primary/15 bg-card/95 p-3 shadow-xl backdrop-blur sm:block">
                <HrUI />
              </div>
            </div>
            <div className="dz-reveal order-1 lg:order-2" style={{ animationDelay: "120ms" }}>
              <span className="text-sm font-semibold uppercase tracking-wide text-primary">{t("landing.showcaseHrTitle")}</span>
              <p className="mt-4 text-lg text-muted-foreground">{t("landing.showcaseHrSubtitle")}</p>
            </div>
          </div>
        </section>

        {/* ===================== BENEFITS ===================== */}
        <section id="features" className="border-t bg-[color:var(--surface-container-lowest)] py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center dz-reveal">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("landing.benefitsTitle")}</h2>
              <p className="mt-3 text-muted-foreground">{t("landing.benefitsSubtitle")}</p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {benefits.map((b, i) => (
                <div key={b.title} className="dz-reveal flex items-start gap-3 rounded-2xl border bg-card p-5" style={{ animationDelay: `${i * 60}ms` }}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{b.icon}</span>
                  </span>
                  <div>
                    <div className="font-semibold">{b.title}</div>
                    <div className="text-sm text-muted-foreground">{b.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===================== MODULES ===================== */}
        <section id="modules" className="py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center dz-reveal">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("landing.modulesTitle")}</h2>
            </div>
            <div className="mt-12 grid auto-rows-[minmax(150px,auto)] grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
              {modules.map((m, i) => (
                <div key={m.title} className="dz-reveal group overflow-hidden rounded-2xl border bg-card transition-colors hover:border-primary/40" style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="border-b bg-[color:var(--surface-container-lowest)] p-3">
                    <span className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{m.icon}</span>
                      </span>
                      <span className="text-sm font-semibold">{m.title}</span>
                    </span>
                  </div>
                  <div className="p-3">{m.ui}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===================== ALGERIAN BUSINESS ===================== */}
        <section className="relative isolate overflow-hidden border-t bg-[color:var(--surface-container-lowest)] py-16 sm:py-24">
          <AmbientBlob className="-top-20 start-0 h-72 w-72" />
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
            <div className="dz-reveal">
              <SceneImage src={assets.algeria} alt="Conçu pour les entreprises algériennes" />
            </div>
            <div className="dz-reveal" style={{ animationDelay: "120ms" }}>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("landing.algeriaTitle")}</h2>
              <p className="mt-4 text-lg text-muted-foreground">{t("landing.algeriaSubtitle")}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {algeria.map((a) => (
                  <div key={a.title} className="flex items-start gap-3 rounded-xl border bg-card p-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{a.icon}</span>
                    </span>
                    <div>
                      <div className="text-sm font-semibold">{a.title}</div>
                      <div className="text-xs text-muted-foreground">{a.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ===================== WHY DzERP (integration centerpiece) ===================== */}
        <section id="why" className="py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center dz-reveal">
              <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                {isAr ? "من العمليات اليومية" : "De vos opérations quotidiennes"}
                <span className="mt-1 block text-primary">
                  {isAr ? "إلى رؤية المؤسسة بالكامل" : "à la vision globale de votre entreprise"}
                </span>
              </h2>
              <p className="mt-5 text-lg text-muted-foreground">{t("landing.whySubtitle")}</p>
            </div>
            <div className="mx-auto mt-12 max-w-5xl dz-reveal">
              <SceneImage src={assets.integration} alt="Tous vos modules reliés autour de DzERP" />
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {why.map((w, i) => (
                <div key={w} className="dz-reveal flex items-center gap-3 rounded-2xl border bg-card p-5" style={{ animationDelay: `${i * 70}ms` }}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">check</span>
                  </span>
                  <span className="font-medium">{w}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===================== MULTI-BUSINESS ===================== */}
        <section className="border-t bg-[color:var(--surface-container-lowest)] py-16 sm:py-24">
          <div className="mx-auto max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid lg:grid-cols-2">
            <div className="dz-reveal lg:pe-10">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("landing.multiBusinessTitle")}</h2>
              <p className="mt-4 text-lg text-muted-foreground">{t("landing.multiBusinessDesc")}</p>
            </div>
            <div className="dz-reveal mt-10 lg:mt-0" style={{ animationDelay: "120ms" }}>
              <SceneImage src={assets.integration} alt="Gérez plusieurs entreprises depuis DzERP" />
            </div>
          </div>
        </section>

        {/* ===================== FINAL CTA ===================== */}
        <section id="contact" className="relative isolate overflow-hidden px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-16 text-center text-primary-foreground sm:px-12">
            <div className="absolute inset-0 opacity-20" aria-hidden="true">
              <SceneImage src={assets.cta} alt="" fillParent />
            </div>
            <AmbientBlob className="-top-10 -start-10 h-64 w-64" />
            <AmbientBlob tone="amber" className="-bottom-16 end-0 h-64 w-64" />
            <div className="relative dz-reveal">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl" style={isAr ? { fontWeight: 800 } : undefined}>{finalTitle}</h2>
              <p className="mx-auto mt-4 max-w-2xl text-primary-foreground/85">{finalSub}</p>
              <div className="mt-8 flex justify-center">
                <Button asChild size="lg" variant="secondary"><Link href={ctaHref}>{ctaLabel}</Link></Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter isAuthed={isAuthed} />
    </div>
  );
}
