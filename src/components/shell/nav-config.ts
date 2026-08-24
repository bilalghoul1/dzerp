import type { PermissionKey } from "@/features/auth/permissions";

export type NavItem = {
  labelKey: string;
  href: string;
  icon: string;
  permission?: PermissionKey;
};

/** Groupe de navigation — réservé à la navigation d'administration plateforme. */
export type NavGroup = {
  labelKey: string;
  items: NavItem[];
};

export const mainNav: NavItem[] = [
  { labelKey: "nav.dashboard", href: "/", icon: "dashboard", permission: "dashboard.view" },
  { labelKey: "nav.customers", href: "/crm/customers", icon: "group", permission: "crm.customer.view" },
  { labelKey: "nav.suppliers", href: "/crm/suppliers", icon: "handshake", permission: "crm.supplier.view" },
  { labelKey: "nav.ventes", href: "/ventes", icon: "payments", permission: "ventes.devis.view" },
  { labelKey: "nav.documents", href: "/documents", icon: "description", permission: "documents.read" },
  { labelKey: "nav.achats", href: "/achats", icon: "shopping_cart", permission: "achats.bon.view" },
  { labelKey: "nav.stock", href: "/stock", icon: "inventory_2", permission: "product.view" },
  { labelKey: "nav.production", href: "/production", icon: "factory", permission: "production.view" },
  { labelKey: "nav.comptabilite", href: "/comptabilite", icon: "account_balance", permission: "compta.view" },
  { labelKey: "nav.rh", href: "/rh", icon: "badge", permission: "rh.view" },
  { labelKey: "rh.navEmployees", href: "/rh/employees", icon: "group", permission: "rh.employee.view" },
  { labelKey: "rh.navContracts", href: "/rh/contracts", icon: "description", permission: "rh.contract.view" },
  { labelKey: "nav.rapports", href: "/rapports", icon: "bar_chart", permission: "rapports.view" },
];

export const footerNav: NavItem[] = [
  { labelKey: "nav.parametres", href: "/parametres", icon: "settings", permission: "parametres.view" },
  { labelKey: "nav.aide", href: "/aide", icon: "help" },
];

/**
 * Navigation d'entreprise (COMPANY_ADMIN et profils société), regroupée par
 * objectif métier — et NON par modèle de base de données. Remplace la liste
 * plate de `mainNav` dans la sidebar : 13 entrées plates → 6 groupes clairs.
 *
 * Aucune route n'est supprimée : `Ventes`/`Achats` (redirigent déjà vers
 * `/documents`) et `Employés`/`Contrats` (enfants de `/rh`) ne sont plus des
 * entrées de premier niveau redondantes, mais restent accessibles via le hub
 * Documents (onglets achat/vente) et le hub RH. `mainNav` est conservé pour la
 * Command Palette (Ctrl+K) qui affiche un résultat plat et filtré.
 */
export const companyNavGroups: NavGroup[] = [
  {
    labelKey: "nav.groups.accueil",
    items: [
      { labelKey: "nav.dashboard", href: "/", icon: "dashboard", permission: "dashboard.view" },
    ],
  },
  {
    labelKey: "nav.groups.piloter",
    items: [
      { labelKey: "nav.customers", href: "/crm/customers", icon: "group", permission: "crm.customer.view" },
      { labelKey: "nav.suppliers", href: "/crm/suppliers", icon: "handshake", permission: "crm.supplier.view" },
      { labelKey: "nav.documents", href: "/documents", icon: "description", permission: "documents.read" },
    ],
  },
  {
    labelKey: "nav.groups.operer",
    items: [
      { labelKey: "nav.stock", href: "/stock", icon: "inventory_2", permission: "product.view" },
      { labelKey: "nav.production", href: "/production", icon: "factory", permission: "production.view" },
    ],
  },
  {
    labelKey: "nav.groups.finance",
    items: [
      { labelKey: "nav.comptabilite", href: "/comptabilite", icon: "account_balance", permission: "compta.view" },
      { labelKey: "nav.rapports", href: "/rapports", icon: "bar_chart", permission: "rapports.view" },
    ],
  },
  {
    labelKey: "nav.groups.equipe",
    items: [
      { labelKey: "nav.rh", href: "/rh", icon: "badge", permission: "rh.view" },
    ],
  },
  {
    labelKey: "nav.groups.configuration",
    items: [
      { labelKey: "nav.parametres", href: "/parametres", icon: "settings", permission: "parametres.view" },
      { labelKey: "nav.aide", href: "/aide", icon: "help" },
    ],
  },
];

/**
 * Navigation d'administration PLATEFORME, regroupée par section. Réservée au
 * rôle global SUPER_ADMIN (le rendu est piloté par `isSuperAdmin` dans la
 * sidebar, pas par des permissions société).
 */
export const adminNavGroups: NavGroup[] = [
  {
    labelKey: "admin.nav.platform",
    items: [
      { labelKey: "admin.overview", href: "/admin", icon: "admin_panel_settings" },
      { labelKey: "admin.companies", href: "/admin/companies", icon: "shield" },
    ],
  },
  {
    labelKey: "admin.nav.access",
    items: [
      { labelKey: "admin.nav.users", href: "/admin/users", icon: "group" },
      { labelKey: "admin.nav.sessions", href: "/admin/users/sessions", icon: "devices" },
      { labelKey: "admin.nav.security", href: "/admin/security", icon: "security" },
    ],
  },
  {
    labelKey: "admin.nav.monitoring",
    items: [
      { labelKey: "admin.nav.audit", href: "/admin/audit", icon: "history" },
      { labelKey: "admin.nav.analytics", href: "/admin/analytics", icon: "monitoring" },
      { labelKey: "admin.nav.maintenance", href: "/admin/maintenance", icon: "health_and_safety" },
    ],
  },
  {
    labelKey: "admin.nav.system",
    items: [
      { labelKey: "admin.nav.settings", href: "/admin/settings", icon: "settings" },
      { labelKey: "admin.nav.backups", href: "/admin/backups", icon: "database" },
    ],
  },
];

export function filterNav(
  items: NavItem[],
  permissions: readonly PermissionKey[],
): NavItem[] {
  return items.filter(
    (item) => !item.permission || permissions.includes(item.permission),
  );
}
