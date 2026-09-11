"use client";

import * as React from "react";
import {
  AccountingUI,
  BrowserMockup,
  CrmUI,
  DashboardUI,
  DocumentsHubUI,
  HrUI,
  InventoryUI,
  ProductionUI,
} from "@/components/public/landing-art";

export { BrowserMockup };

function Row({ icon, title, sub, meta }: { icon: string; title: string; sub?: string; meta?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-[color:var(--surface-container-low)] px-3 py-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
          {icon}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-medium">{title}</div>
        {sub ? <div className="truncate text-[10px] text-muted-foreground">{sub}</div> : null}
      </div>
      {meta ? <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">{meta}</span> : null}
    </div>
  );
}

function Badge({ children, tone = "primary" }: { children: React.ReactNode; tone?: "primary" | "amber" | "neutral" }) {
  const c =
    tone === "primary"
      ? "bg-primary/10 text-primary"
      : tone === "amber"
        ? "bg-[color:var(--tertiary-container)] text-[color:var(--on-tertiary-container)]"
        : "bg-muted text-muted-foreground";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${c}`}>{children}</span>;
}

/* --------------------------------------------------------------------- */
/*  Unified cockpit: the same data visible from every module.            */
/* --------------------------------------------------------------------- */

export function UnifiedUI() {
  const kpis = [
    { l: "Ventes", v: "12,4 M DA", icon: "point_of_sale" },
    { l: "Stock", v: "1 902", icon: "inventory_2" },
    { l: "Paie", v: "CNAS ✓", icon: "badge" },
    { l: "TVA", v: "19%", icon: "calculate" },
  ];
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-semibold">Cockpit unifié</div>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
          TOUT EN UN
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {kpis.map((k) => (
          <div key={k.l} className="flex items-center gap-2 rounded-lg border border-border bg-[color:var(--surface-container-low)] px-2 py-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                {k.icon}
              </span>
            </span>
            <div className="min-w-0">
              <div className="text-[9px] text-muted-foreground">{k.l}</div>
              <div className="text-[12px] font-semibold tabular-nums">{k.v}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px] text-primary" aria-hidden="true">
              hub
            </span>
            vente → stock → compta → taxes
          </span>
          <span className="font-semibold text-primary">1 système</span>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- */
/*  Mini UI for the taxes stage. Real terminology only, no fake figures. */
/* --------------------------------------------------------------------- */

export function PurchaseUI() {
  const docs = [
    { t: "Demande d'achat", n: "DA-330", s: "Validé", icon: "request_quote" },
    { t: "Commande fournisseur", n: "CF-118", s: "Confirmé", icon: "receipt_long" },
    { t: "Réception", n: "BR-051", s: "Attente", icon: "inventory_2" },
  ];
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-semibold">Achats & approvisionnement</div>
        <Badge tone="amber">+ Nouveau</Badge>
      </div>
      {docs.map((d) => (
        <Row
          key={d.n}
          icon={d.icon}
          title={`${d.t} · ${d.n}`}
          sub="Fournisseur · ATLAS SARL"
          meta={d.s}
        />
      ))}
    </div>
  );
}

export function TaxAreaUI() {
  const rates = [
    { code: "TVA", value: "19%", tone: "primary" as const },
    { code: "TAP", value: "2%", tone: "amber" as const },
    { code: "IRG", value: "retenue", tone: "neutral" as const },
  ];
  const rows = [
    { icon: "point_of_sale", title: "Facture FAC-0773", meta: "TVA 19%" },
    { icon: "account_balance", title: "Déclaration mensuelle", meta: "Prête" },
    { icon: "badge", title: "NIF · RTIMA", meta: "Suivi" },
  ];
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-semibold">Fiscalité algérienne</div>
        <span className="rounded-full bg-[color:var(--tertiary-container)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--on-tertiary-container)]">
          SCF
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {rates.map((r) => (
          <div
            key={r.code}
            className={`rounded-lg border px-2 py-2 text-center ${
              r.tone === "primary"
                ? "border-primary/20 bg-primary/10"
                : r.tone === "amber"
                  ? "border-[color:var(--tertiary-container)] bg-[color:var(--tertiary-container)]/20"
                  : "border-border bg-[color:var(--surface-container-low)]"
            }`}
          >
            <div className="text-[11px] font-semibold">{r.code}</div>
            <div className="text-[10px] text-muted-foreground">{r.value}</div>
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div
            key={row.title}
            className="flex items-center gap-2.5 rounded-lg border border-border bg-[color:var(--surface-container-low)] px-3 py-2"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                {row.icon}
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium">{row.title}</div>
            </div>
            <span className="text-[11px] font-semibold text-primary">{row.meta}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- */
/*  Mapping of showcase stages to the UI actually rendered.              */
/* --------------------------------------------------------------------- */

export function ShowcaseStageUI({ id }: { id: string }) {
  switch (id) {
    case "sales":
      return <DocumentsHubUI />;
    case "parties":
      return <CrmUI />;
    case "stock":
      return <InventoryUI />;
    case "purchases":
      return <PurchaseUI />;
    case "accounting":
      return <AccountingUI />;
    case "production":
      return <ProductionUI />;
    case "hr":
      return <HrUI />;
    case "taxes":
      return <TaxAreaUI />;
    case "final":
      return <UnifiedUI />;
    case "dashboard":
    default:
      return <DashboardUI />;
  }
}