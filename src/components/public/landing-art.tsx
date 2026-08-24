"use client";

import * as React from "react";

/* ------------------------------------------------------------------ */
/*  Reusable device / browser frames — generic wrappers around REAL    */
/*  DzERP UI recreations. No fake data, real module terminology only.  */
/* ------------------------------------------------------------------ */

export function BrowserMockup({
  children,
  url = "app.dzerp.dz",
  className = "",
  style,
}: {
  children: React.ReactNode;
  url?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`overflow-hidden rounded-xl border border-border bg-card shadow-2xl ${className}`} style={style}>
      <div className="flex items-center gap-2 border-b bg-[color:var(--surface-container-high)] px-3 py-2">
        <span className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </span>
        <span className="mx-auto hidden truncate rounded-full bg-background/70 px-3 py-0.5 text-[11px] text-muted-foreground sm:block">
          {url}
        </span>
      </div>
      <div className="bg-card">{children}</div>
    </div>
  );
}

export function LaptopMockup({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <div className="overflow-hidden rounded-t-xl border border-border bg-[color:var(--surface-container-high)] shadow-2xl">
        <div className="mx-auto mb-2 mt-2 h-1.5 w-16 rounded-full bg-border" />
        <div className="overflow-hidden border-x border-t border-border bg-card">{children}</div>
      </div>
      <div className="relative mx-auto h-3 w-[114%] -translate-x-[6%] rounded-b-xl bg-gradient-to-b from-[color:var(--surface-container-high)] to-[color:var(--surface-container)] shadow-md" />
      <div className="mx-auto h-1.5 w-1/3 rounded-b-md bg-border/60" />
    </div>
  );
}

export function PhoneMockup({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`w-[210px] rounded-[2rem] border-[6px] border-neutral-900 bg-neutral-900 shadow-2xl ${className}`}>
      <div className="overflow-hidden rounded-[1.5rem] bg-card">
        <div className="h-5 bg-[color:var(--surface-container-high)]">
          <div className="mx-auto h-1 w-12 translate-y-2 rounded-full bg-border" />
        </div>
        <div className="p-3">{children}</div>
      </div>
    </div>
  );
}

/* A paper-styled commercial document preview (real DzERP doc types). */
export function DocumentPreview({
  kind,
  number,
  party,
  total,
  status,
  rtl = false,
}: {
  kind: string;
  number: string;
  party: string;
  total: string;
  status: string;
  rtl?: boolean;
}) {
  return (
    <div
      className={`w-64 rounded-lg border border-border bg-card p-4 text-left shadow-xl ${rtl ? "rtl" : ""}`}
      style={{ fontFeatureSettings: "'tnum'" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold text-primary">{kind}</span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{status}</span>
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground tabular-nums">{number}</div>
      <div className="mt-3 border-t pt-2 text-[11px]">
        <div className="text-muted-foreground">Client</div>
        <div className="font-medium">{party}</div>
      </div>
      <div className="mt-2 flex items-center justify-between border-t pt-2">
        <span className="text-[10px] text-muted-foreground">Total</span>
        <span className="text-sm font-bold tabular-nums">{total}</span>
      </div>
    </div>
  );
}

/* Floating UI fragment chip. */
export function FloatChip({
  icon,
  label,
  value,
  tone = "primary",
  className = "",
}: {
  icon: string;
  label: string;
  value?: string;
  tone?: "primary" | "amber" | "neutral";
  className?: string;
}) {
  const toneCls =
    tone === "primary"
      ? "bg-card border-primary/20"
      : tone === "amber"
        ? "bg-card border-[color:var(--tertiary-container)]"
        : "bg-card border-border";
  return (
    <div className={`flex items-center gap-3 rounded-xl border ${toneCls} px-3 py-2 shadow-lg ${className}`}>
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          tone === "amber" ? "bg-[color:var(--tertiary-container)] text-[color:var(--on-tertiary-container)]" : "bg-primary/10 text-primary"
        }`}
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          {icon}
        </span>
      </span>
      <div className="min-w-0">
        <div className="text-[10px] text-muted-foreground">{label}</div>
        {value ? <div className="text-sm font-semibold tabular-nums">{value}</div> : null}
      </div>
    </div>
  );
}

/* Shared atoms used inside the real-UI recreations. */
function Bar({ w = "w-full", c = "bg-border" }: { w?: string; c?: string }) {
  return <div className={`h-2 rounded-full ${c} ${w}`} />;
}
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

/* ============================ REAL DzERP UIs ============================ */

export function DashboardUI() {
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold">DzERP</div>
          <div className="text-[10px] text-muted-foreground">Tableau de bord</div>
        </div>
        <Badge>EN TEMPS RÉEL</Badge>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { l: "Ventes", v: "12,4 M DA" },
          { l: "Clients", v: "348" },
          { l: "Stock", v: "1 902" },
        ].map((s) => (
          <div key={s.l} className="rounded-lg border border-border bg-[color:var(--surface-container-low)] p-2">
            <div className="text-[9px] text-muted-foreground">{s.l}</div>
            <div className="text-[13px] font-semibold tabular-nums">{s.v}</div>
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <Row icon="description" title="Facture FAC-0773" sub="SARL El Watan" meta="450 000" />
        <Row icon="shopping_cart" title="Commande CMD-2210" sub="ATLAS SARL" meta="Brouillon" />
        <Row icon="local_shipping" title="BL BL-1180" sub="ENNASR" meta="Livré" />
      </div>
      <Bar w="w-3/4" />
    </div>
  );
}

export function DocumentsHubUI() {
  const docs = [
    { t: "Devis", n: "DEV-2041", s: "Brouillon", icon: "description" },
    { t: "Facture Proforma", n: "FP-0912", s: "Validé", icon: "receipt_long" },
    { t: "Bon de livraison", n: "BL-1180", s: "Confirmé", icon: "local_shipping" },
    { t: "Facture", n: "FAC-0773", s: "Payée", icon: "receipt" },
  ];
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-semibold">Documents commerciaux</div>
        <Badge tone="amber">+ Nouveau</Badge>
      </div>
      {docs.map((d) => (
        <Row key={d.n} icon={d.icon} title={`${d.t} · ${d.n}`} sub="SARL El Watan" meta={d.s} />
      ))}
    </div>
  );
}

export function CrmUI() {
  const customers = [
    { n: "SARL El Wamat", p: "+213 21 45 67 89", s: "12 docs", b: "45 000 DA" },
    { n: "ATLAS SARL", p: "+213 23 11 22 33", s: "8 docs", b: "120 000 DA" },
    { n: "ENNASR Import", p: "+213 31 77 88 99", s: "21 docs", b: "310 000 DA" },
  ];
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-semibold">Clients</div>
        <Badge>348 clients</Badge>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { l: "Nom", v: "Nom (ar)" },
          { l: "Téléphone", v: "Mobile" },
          { l: "Solde", v: "Documents" },
        ].map((h) => (
          <div key={h.l} className="rounded-lg border border-border bg-[color:var(--surface-container-low)] px-1 py-1.5">
            <div className="text-[9px] text-muted-foreground">{h.l}</div>
            <div className="text-[10px] font-medium">{h.v}</div>
          </div>
        ))}
      </div>
      {customers.map((c) => (
        <div key={c.n} className="rounded-lg border border-border bg-[color:var(--surface-container-low)] p-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium">{c.n}</span>
            <span className="text-[11px] font-semibold tabular-nums text-primary">{c.b}</span>
          </div>
          <div className="text-[10px] text-muted-foreground tabular-nums">{c.p} · {c.s}</div>
        </div>
      ))}
    </div>
  );
}

export function InventoryUI() {
  const rows = [
    { p: "Ordinateur Portable", q: "120", w: "Entrepôt Nord" },
    { p: "Imprimante Laser", q: "48", w: "Entrepôt Sud" },
    { p: "Serveur Rack", q: "12", w: "Entrepôt Nord" },
  ];
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-semibold">Produits & Stock</div>
        <Badge tone="amber">DZD</Badge>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { l: "Produits", v: "1 902" },
          { l: "Entrepôts", v: "4" },
          { l: "Mouvements", v: "86" },
        ].map((s) => (
          <div key={s.l} className="rounded-lg border border-border bg-[color:var(--surface-container-low)] p-2 text-center">
            <div className="text-[9px] text-muted-foreground">{s.l}</div>
            <div className="text-[13px] font-semibold tabular-nums">{s.v}</div>
          </div>
        ))}
      </div>
      {rows.map((r) => (
        <div key={r.p} className="rounded-lg border border-border bg-[color:var(--surface-container-low)] p-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium">{r.p}</span>
            <span className="text-[12px] font-semibold tabular-nums text-primary">{r.q}</span>
          </div>
          <div className="text-[10px] text-muted-foreground">{r.w}</div>
        </div>
      ))}
    </div>
  );
}

export function AccountingUI() {
  return (
    <div className="space-y-3 p-4">
      <div className="text-[13px] font-semibold">Comptabilité & Finance</div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border bg-[color:var(--surface-container-low)] p-2">
          <div className="text-[9px] text-muted-foreground">Journal</div>
          <Bar w="w-full" />
        </div>
        <div className="rounded-lg border border-border bg-[color:var(--surface-container-low)] p-2">
          <div className="text-[9px] text-muted-foreground">Paiements</div>
          <Bar w="w-3/4" c="bg-[color:var(--tertiary-container)]" />
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between rounded-md bg-primary/10 px-2 py-1.5 text-[11px]">
          <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">account_balance</span> Compte 512 · Banque</span>
          <span className="tabular-nums font-semibold">+ 1 250 000</span>
        </div>
        <div className="flex items-center justify-between rounded-md bg-[color:var(--tertiary-container)] px-2 py-1.5 text-[11px] text-[color:var(--on-tertiary-container)]">
          <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">receipt_long</span> Compte 401 · Fournisseur</span>
          <span className="tabular-nums font-semibold">− 320 000</span>
        </div>
      </div>
    </div>
  );
}

export function ProductionUI() {
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-semibold">Production / MRP</div>
        <Badge>OF-220</Badge>
      </div>
      <div className="rounded-lg border border-border bg-[color:var(--surface-container-low)] p-2">
        <div className="text-[10px] text-muted-foreground">Nomenclature (BOM)</div>
        <Bar w="w-full" />
        <Bar w="w-2/3" c="bg-[color:var(--tertiary-container)]" />
      </div>
      <Row icon="precision_manufacturing" title="Ordre de fabrication OF-220" sub="Statut : En cours" />
      <Row icon="settings" title="Machine A — Capacité 120/h" sub="Centre de charge : Usinage" />
      <Row icon="hub" title="Poste de travail 3" sub="Effectif : 4 opérateurs" />
    </div>
  );
}

export function HrUI() {
  const people = [
    { n: "A. Benali", r: "Ventes", i: "AB" },
    { n: "S. Hadid", r: "Production", i: "SH" },
    { n: "K. Mansour", r: "Comptabilité", i: "KM" },
  ];
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-semibold">Ressources humaines</div>
        <Badge>6 départements</Badge>
      </div>
      {people.map((p) => (
        <div key={p.n} className="flex items-center gap-2 rounded-lg border border-border bg-[color:var(--surface-container-low)] p-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
            {p.i}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-medium">{p.n}</div>
            <div className="text-[10px] text-muted-foreground">{p.r}</div>
          </div>
          <Badge tone="neutral">Contrat</Badge>
        </div>
      ))}
    </div>
  );
}

/* Algeria line-art motif (subtle, not a literal map). */
export function AlgeriaMotif({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 320" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="dzg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--primary)" stopOpacity="0.5" />
          <stop offset="1" stopColor="var(--tertiary)" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <path
        d="M70 70 C120 40 210 45 250 90 C285 130 270 200 220 235 C170 270 90 260 60 210 C35 170 35 105 70 70 Z"
        fill="none"
        stroke="url(#dzg)"
        strokeWidth="1.5"
        opacity="0.6"
      />
      <circle cx="160" cy="150" r="5" fill="var(--primary)" />
      <circle cx="205" cy="195" r="3.5" fill="var(--tertiary)" />
      <circle cx="120" cy="200" r="3.5" fill="var(--primary)" opacity="0.6" />
      <path d="M160 150 L205 195 M160 150 L120 200" stroke="var(--primary)" strokeOpacity="0.35" strokeWidth="1.2" />
    </svg>
  );
}

export function AmbientBlob({ className = "", tone = "primary" }: { className?: string; tone?: "primary" | "amber" }) {
  const c = tone === "amber" ? "var(--tertiary)" : "var(--primary)";
  return (
    <div
      className={`pointer-events-none absolute rounded-full blur-3xl ${className}`}
      style={{ background: c, opacity: 0.1 }}
      aria-hidden="true"
    />
  );
}
