import type { PermissionKey } from "@/features/auth/permissions";

export type NavItem = {
  labelKey: string;
  href: string;
  icon: string;
  permission?: PermissionKey;
};

export const mainNav: NavItem[] = [
  { labelKey: "nav.dashboard", href: "/", icon: "dashboard", permission: "dashboard.view" },
  { labelKey: "nav.customers", href: "/crm/customers", icon: "group", permission: "crm.customer.view" },
  { labelKey: "nav.suppliers", href: "/crm/suppliers", icon: "handshake", permission: "crm.supplier.view" },
  { labelKey: "nav.ventes", href: "/ventes", icon: "payments", permission: "ventes.devis.view" },
  { labelKey: "nav.achats", href: "/achats", icon: "shopping_cart", permission: "achats.bon.view" },
  { labelKey: "nav.stock", href: "/stock", icon: "inventory_2", permission: "stock.view" },
  { labelKey: "nav.production", href: "/production", icon: "factory", permission: "production.view" },
  { labelKey: "nav.comptabilite", href: "/comptabilite", icon: "account_balance", permission: "compta.view" },
  { labelKey: "nav.rh", href: "/rh", icon: "badge", permission: "rh.view" },
  { labelKey: "nav.rapports", href: "/rapports", icon: "bar_chart", permission: "rapports.view" },
];

export const footerNav: NavItem[] = [
  { labelKey: "nav.parametres", href: "/parametres", icon: "settings", permission: "parametres.view" },
  { labelKey: "nav.aide", href: "/aide", icon: "help" },
];

export function filterNav(
  items: NavItem[],
  permissions: readonly PermissionKey[],
): NavItem[] {
  return items.filter(
    (item) => !item.permission || permissions.includes(item.permission),
  );
}
