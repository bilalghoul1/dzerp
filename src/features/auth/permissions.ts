/**
 * Catalogue des permissions de l'application.
 * Chaque permission suit la convention `module.resource.action`.
 * Toute permission utilisée dans le code doit être déclarée ici.
 */
export const PERMISSIONS = {
  "dashboard.view": {
    module: "dashboard",
    name: "Voir le tableau de bord",
    nameAr: "عرض لوحة القيادة",
  },
  "crm.client.view": {
    module: "crm",
    name: "Consulter les clients",
    nameAr: "عرض العملاء",
  },
  "crm.client.create": {
    module: "crm",
    name: "Créer un client",
    nameAr: "إنشاء عميل",
  },
  "crm.client.update": {
    module: "crm",
    name: "Modifier un client",
    nameAr: "تعديل عميل",
  },
  "crm.fournisseur.view": {
    module: "crm",
    name: "Consulter les fournisseurs",
    nameAr: "عرض الموردين",
  },
  "crm.fournisseur.create": {
    module: "crm",
    name: "Créer un fournisseur",
    nameAr: "إنشاء مورد",
  },
  "crm.client.delete": {
    module: "crm",
    name: "Supprimer un client",
    nameAr: "حذف عميل",
  },
  "ventes.devis.view": {
    module: "ventes",
    name: "Consulter les devis",
    nameAr: "عرض عروض الأسعار",
  },
  "ventes.devis.create": {
    module: "ventes",
    name: "Créer un devis",
    nameAr: "إنشاء عرض سعر",
  },
  "ventes.devis.update": {
    module: "ventes",
    name: "Modifier un devis",
    nameAr: "تعديل عرض سعر",
  },
  "ventes.devis.validate": {
    module: "ventes",
    name: "Valider un devis",
    nameAr: "الموافقة على عرض سعر",
  },
  "ventes.devis.delete": {
    module: "ventes",
    name: "Supprimer un devis",
    nameAr: "حذف عرض سعر",
  },
  "ventes.proforma.view": {
    module: "ventes",
    name: "Consulter les factures proforma",
    nameAr: "عرض الفواتير المبدئية",
  },
  "ventes.proforma.create": {
    module: "ventes",
    name: "Créer une facture proforma",
    nameAr: "إنشاء فاتورة مبدئية",
  },
  "ventes.commande.view": {
    module: "ventes",
    name: "Consulter les commandes",
    nameAr: "عرض طلبات الشراء",
  },
  "ventes.commande.create": {
    module: "ventes",
    name: "Créer une commande",
    nameAr: "إنشاء طلب شراء",
  },
  "ventes.livraison.view": {
    module: "ventes",
    name: "Consulter les bons de livraison",
    nameAr: "عرض أوراق التسليم",
  },
  "ventes.livraison.create": {
    module: "ventes",
    name: "Créer un bon de livraison",
    nameAr: "إنشاء ورقة تسليم",
  },
  "ventes.avoir.view": {
    module: "ventes",
    name: "Consulter les avoirs",
    nameAr: "عرض سندات الدائن",
  },
  "ventes.avoir.create": {
    module: "ventes",
    name: "Créer un avoir",
    nameAr: "إنشاء سند دائن",
  },
  "ventes.facture.view": {
    module: "ventes",
    name: "Consulter les factures",
    nameAr: "عرض الفواتير",
  },
  "ventes.facture.create": {
    module: "ventes",
    name: "Créer une facture",
    nameAr: "إنشاء فاتورة",
  },
  "ventes.facture.manage": {
    module: "ventes",
    name: "Gérer les factures",
    nameAr: "إدارة الفواتير",
  },
  "achats.bon.view": {
    module: "achats",
    name: "Consulter les bons de commande",
    nameAr: "عرض أوامر الشراء",
  },
  "achats.bon.create": {
    module: "achats",
    name: "Créer un bon de commande",
    nameAr: "إنشاء أمر شراء",
  },
  "achats.bon.manage": {
    module: "achats",
    name: "Gérer les achats",
    nameAr: "إدارة المشتريات",
  },
  "achats.besoin.view": {
    module: "achats",
    name: "Consulter les demandes d'achat",
    nameAr: "عرض طلبات الشراء",
  },
  "achats.besoin.create": {
    module: "achats",
    name: "Créer une demande d'achat",
    nameAr: "إنشاء طلب شراء",
  },
  "achats.reception.view": {
    module: "achats",
    name: "Consulter les bons de réception",
    nameAr: "عرض أوراق الاستلام",
  },
  "achats.reception.create": {
    module: "achats",
    name: "Créer un bon de réception",
    nameAr: "إنشاء ورقة استلام",
  },
  "achats.facture.view": {
    module: "achats",
    name: "Consulter les factures fournisseurs",
    nameAr: "عرض فواتير الموردين",
  },
  "achats.facture.create": {
    module: "achats",
    name: "Créer une facture fournisseur",
    nameAr: "إنشاء فاتورة مورد",
  },
  "stock.view": {
    module: "stock",
    name: "Consulter le stock",
    nameAr: "عرض المخزون",
  },
  "stock.manage": {
    module: "stock",
    name: "Gérer le stock",
    nameAr: "إدارة المخزون",
  },
  "stock.produit.view": {
    module: "stock",
    name: "Consulter les produits",
    nameAr: "عرض المنتجات",
  },
  "stock.produit.create": {
    module: "stock",
    name: "Créer un produit",
    nameAr: "إنشاء منتج",
  },
  "stock.entrepot.view": {
    module: "stock",
    name: "Consulter les entrepôts",
    nameAr: "عرض المستودعات",
  },
  "stock.entrepot.create": {
    module: "stock",
    name: "Créer un entrepôt",
    nameAr: "إنشاء مستودع",
  },
  "stock.mouvement.create": {
    module: "stock",
    name: "Créer un mouvement de stock",
    nameAr: "إنشاء حركة مخزون",
  },
  "production.view": {
    module: "production",
    name: "Consulter la production",
    nameAr: "عرض الإنتاج",
  },
  "production.manage": {
    module: "production",
    name: "Gérer la production",
    nameAr: "إدارة الإنتاج",
  },
  "compta.view": {
    module: "comptabilite",
    name: "Consulter la comptabilité",
    nameAr: "عرض المحاسبة",
  },
  "compta.manage": {
    module: "comptabilite",
    name: "Gérer la comptabilité",
    nameAr: "إدارة المحاسبة",
  },
  "rh.view": {
    module: "rh",
    name: "Consulter les ressources humaines",
    nameAr: "عرض الموارد البشرية",
  },
  "rh.manage": {
    module: "rh",
    name: "Gérer les ressources humaines",
    nameAr: "إدارة الموارد البشرية",
  },
  "parametres.view": {
    module: "parametres",
    name: "Consulter les paramètres",
    nameAr: "عرض الإعدادات",
  },
  "parametres.manage": {
    module: "parametres",
    name: "Gérer les paramètres",
    nameAr: "إدارة الإعدادات",
  },
  "admin.users.manage": {
    module: "admin",
    name: "Gérer les utilisateurs",
    nameAr: "إدارة المستخدمين",
  },
  "admin.roles.manage": {
    module: "admin",
    name: "Gérer les rôles et permissions",
    nameAr: "إدارة الأدوار والصلاحيات",
  },
  "admin.audit.view": {
    module: "admin",
    name: "Consulter le journal d'audit",
    nameAr: "عرض سجل التدقيق",
  },
  "rapports.view": {
    module: "rapports",
    name: "Consulter les rapports",
    nameAr: "عرض التقارير",
  },
  "search.global": {
    module: "search",
    name: "Recherche globale",
    nameAr: "البحث الشامل",
  },
  "files.upload": {
    module: "files",
    name: "Envoyer des fichiers",
    nameAr: "رفع الملفات",
  },
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export const ALL_PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[];

export const PERMISSION_MODULES = Array.from(
  new Set(Object.values(PERMISSIONS).map((p) => p.module)),
);
