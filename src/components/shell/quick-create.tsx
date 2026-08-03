"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { PermissionKey } from "@/features/auth/permissions";
import { useI18n } from "@/features/i18n/i18n-provider";
import { Button } from "@/components/ui/button";

type QuickCreateItem = {
  key:
    | "quotation"
    | "proforma"
    | "salesOrder"
    | "deliveryNote"
    | "invoice"
    | "creditNote"
    | "purchaseRequest"
    | "purchaseOrder"
    | "goodsReceipt"
    | "supplierInvoice"
    | "customer"
    | "supplier"
    | "product"
    | "warehouse"
    | "user"
    | "branch";
  href: string;
  icon: string;
  permission?: PermissionKey;
};

const GROUPS: {
  labelKey: "quickCreate.sales" | "quickCreate.purchasing" | "quickCreate.masterData" | "quickCreate.administration";
  items: QuickCreateItem[];
}[] = [
  {
    labelKey: "quickCreate.sales",
    items: [
      { key: "quotation", href: "/devis/nouveau", icon: "description", permission: "ventes.devis.create" },
      { key: "proforma", href: "/ventes/proforma/nouveau", icon: "receipt_long", permission: "ventes.proforma.create" },
      { key: "salesOrder", href: "/ventes/commandes/nouveau", icon: "shopping_cart", permission: "ventes.commande.create" },
      { key: "deliveryNote", href: "/ventes/livraisons/nouveau", icon: "local_shipping", permission: "ventes.livraison.create" },
      { key: "invoice", href: "/ventes/factures/nouveau", icon: "receipt", permission: "ventes.facture.create" },
      { key: "creditNote", href: "/ventes/avoirs/nouveau", icon: "currency_exchange", permission: "ventes.avoir.create" },
    ],
  },
  {
    labelKey: "quickCreate.purchasing",
    items: [
      { key: "purchaseRequest", href: "/achats/besoins/nouveau", icon: "request_quote", permission: "achats.besoin.create" },
      { key: "purchaseOrder", href: "/achats/bons/nouveau", icon: "shopping_bag", permission: "achats.bon.create" },
      { key: "goodsReceipt", href: "/achats/receptions/nouveau", icon: "inventory", permission: "achats.reception.create" },
      { key: "supplierInvoice", href: "/achats/factures/nouveau", icon: "payments", permission: "achats.facture.create" },
    ],
  },
  {
    labelKey: "quickCreate.masterData",
    items: [
      { key: "customer", href: "/crm/customers", icon: "person_add", permission: "crm.customer.create" },
      { key: "supplier", href: "/crm/suppliers", icon: "handshake", permission: "crm.supplier.create" },
      { key: "product", href: "/stock", icon: "inventory_2", permission: "product.create" },
      { key: "warehouse", href: "/stock/entrepots", icon: "warehouse", permission: "warehouse.create" },
    ],
  },
  {
    labelKey: "quickCreate.administration",
    items: [
      { key: "user", href: "/parametres/utilisateurs/nouveau", icon: "person_add", permission: "admin.users.manage" },
      { key: "branch", href: "/parametres/branches", icon: "domain", permission: "parametres.manage" },
    ],
  },
];

export function QuickCreate({
  permissions,
}: {
  permissions: readonly PermissionKey[];
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);

  const has = (permission?: PermissionKey) =>
    !permission || permissions.includes(permission);

  return (
    <div className="relative">
      <Button onClick={() => setOpen((v) => !v)} aria-haspopup="true" aria-expanded={open}>
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          add
        </span>
        {t("nav.nouveauDocument")}
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
          expand_more
        </span>
      </Button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute end-0 top-11 z-50 max-h-[70vh] w-72 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md">
            {GROUPS.map((group) => {
              const items = group.items.filter((item) => has(item.permission));
              if (items.length === 0) return null;
              return (
                <div key={group.labelKey} className="mb-1">
                  <p className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t(group.labelKey)}
                  </p>
                  {items.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        router.push(item.href);
                      }}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-start text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                          {item.icon}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {t(`quickCreate.${item.key}`)}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
