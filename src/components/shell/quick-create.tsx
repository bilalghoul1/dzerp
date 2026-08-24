"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { PermissionKey } from "@/features/auth/permissions";
import { useI18n } from "@/features/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type QuickCreateItem = {
  key: string;
  href: string;
  icon: string;
  permission?: PermissionKey;
  labelKey?: string;
};

type QuickCreateGroup = {
  labelKey: string;
  items: QuickCreateItem[];
};

/**
 * Création rapide (action globale « + Nouveau »).
 * - Contexte société : documents, clients/fournisseurs, produits, succursale.
 * - Profil plateforme (SUPER_ADMIN sans société) : uniquement les actions
 *   d'administration plateforme (ex. « Nouvelle société »).
 * Les éléments sont filtrés par permission ; un utilisateur sans droit de
 * création n'affiche aucun groupe.
 */
const COMPANY_GROUPS: QuickCreateGroup[] = [
  {
    labelKey: "quickCreate.sales",
    items: [
      { key: "quotation", href: "/documents/quotation/nouveau", icon: "description", permission: "ventes.devis.create" },
      { key: "salesOrder", href: "/documents/sales_order/nouveau", icon: "shopping_cart", permission: "ventes.commande.create" },
      { key: "deliveryNote", href: "/documents/delivery_note/nouveau", icon: "local_shipping", permission: "ventes.livraison.create" },
      { key: "invoice", href: "/documents/invoice/nouveau", icon: "receipt", permission: "ventes.facture.create" },
      { key: "creditNote", href: "/documents/credit_note/nouveau", icon: "currency_exchange", permission: "ventes.avoir.create" },
      { key: "customerOrder", href: "/documents/customer_order/nouveau", icon: "inbox", permission: "ventes.bcclient.create" },
      { key: "proforma", href: "/documents/proforma/nouveau", icon: "receipt_long", permission: "ventes.proforma.create" },
    ],
  },
  {
    labelKey: "quickCreate.purchasing",
    items: [
      { key: "purchaseRequest", href: "/documents/purchase_request/nouveau", icon: "request_quote", permission: "achats.besoin.create" },
      { key: "purchaseOrder", href: "/documents/purchase_order/nouveau", icon: "shopping_bag", permission: "achats.bon.create" },
      { key: "goodsReceipt", href: "/documents/goods_receipt/nouveau", icon: "inventory", permission: "achats.reception.create" },
      { key: "supplierInvoice", href: "/documents/supplier_invoice/nouveau", icon: "payments", permission: "achats.facture.create" },
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
      { key: "branch", href: "/parametres/branches", icon: "domain", permission: "parametres.manage" },
    ],
  },
];

const PLATFORM_GROUPS: QuickCreateGroup[] = [
  {
    labelKey: "quickCreate.administration",
    items: [
      { key: "company", href: "/admin/companies/nouveau", icon: "add_business", permission: "admin.company.create", labelKey: "admin.addCompany" },
    ],
  },
];

export function QuickCreate({
  permissions,
  isPlatform = false,
  onNavigate,
  className,
  triggerClassName,
  menuAlign = "end",
}: {
  permissions: readonly PermissionKey[];
  isPlatform?: boolean;
  /** Appelé avant la navigation (ex. fermeture du tiroir mobile). */
  onNavigate?: () => void;
  className?: string;
  triggerClassName?: string;
  menuAlign?: "start" | "end";
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);

  const groups = isPlatform ? PLATFORM_GROUPS : COMPANY_GROUPS;

  const has = (permission?: PermissionKey) =>
    !permission || permissions.includes(permission);

  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => has(item.permission)),
    }))
    .filter((group) => group.items.length > 0);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className={cn("relative", className)}>
      <Button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={triggerClassName}
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          add
        </span>
        {t("nav.quickNew")}
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
          expand_more
        </span>
      </Button>

      {open && visibleGroups.length > 0 ? (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="menu"
            aria-label={t("nav.quickNew")}
            className={cn(
              "absolute top-11 z-50 max-h-[70vh] w-72 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md",
              menuAlign === "end" ? "end-0" : "start-0",
            )}
          >
            {visibleGroups.map((group) => (
              <div key={group.labelKey} className="mb-1">
                <p className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t(group.labelKey)}
                </p>
                {group.items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      onNavigate?.();
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
                      {t(item.labelKey ?? `quickCreate.${item.key}`)}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
