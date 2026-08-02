import { prisma } from "@/lib/prisma";

export type SearchHitType =
  | "client"
  | "product"
  | "user"
  | "branch"
  | "document"
  | "action";

export type SearchHit = {
  type: SearchHitType;
  id: string;
  title: string;
  titleAr?: string | null;
  subtitle: string | null;
  href: string;
  icon: string;
};

const quickActions: { title: string; titleAr: string; href: string; icon: string }[] = [
  { title: "Nouveau devis", titleAr: "عرض سعر جديد", href: "/devis/nouveau", icon: "note_add" },
  { title: "Nouveau client", titleAr: "عميل جديد", href: "/crm/nouveau", icon: "person_add" },
  { title: "Nouveau bon de commande", titleAr: "أمر شراء جديد", href: "/achats/nouveau", icon: "add_shopping_cart" },
  { title: "Rapports", titleAr: "التقارير", href: "/rapports", icon: "bar_chart" },
  { title: "Paramètres", titleAr: "الإعدادات", href: "/parametres", icon: "settings" },
];

type DocDescriptor = {
  key: string;
  label: string;
  icon: string;
  hrefPrefix: string;
  findMany: (args: {
    where: { number: { contains: string; mode: "insensitive" } };
    take: number;
    orderBy: { issuedAt: "desc" };
    select: {
      id: true;
      number: true;
      status: true;
      issuedAt: true;
      client: { select: { name: true } };
    };
  }) => Promise<
    {
      id: string;
      number: string;
      status: string;
      issuedAt: Date;
      client: { name: string } | null;
    }[]
  >;
};

const contains = (q: string) => ({
  contains: q,
  mode: "insensitive" as const,
});

const DOC_TABLES: DocDescriptor[] = [
  { key: "QUOTATION", label: "Devis", icon: "description", hrefPrefix: "/ventes/devis/", findMany: (a) => prisma.quotation.findMany(a as never) },
  { key: "SALES_ORDER", label: "Commande", icon: "shopping_cart", hrefPrefix: "/ventes/commandes/", findMany: (a) => prisma.salesOrder.findMany(a as never) },
  { key: "DELIVERY_NOTE", label: "Livraison", icon: "local_shipping", hrefPrefix: "/ventes/livraisons/", findMany: (a) => prisma.deliveryNote.findMany(a as never) },
  { key: "INVOICE", label: "Facture", icon: "receipt", hrefPrefix: "/ventes/factures/", findMany: (a) => prisma.invoice.findMany(a as never) },
  { key: "PURCHASE_ORDER", label: "Bon de commande", icon: "shopping_bag", hrefPrefix: "/achats/bons/", findMany: (a) => prisma.purchaseOrder.findMany(a as never) },
  { key: "SUPPLIER_INVOICE", label: "Facture fournisseur", icon: "payments", hrefPrefix: "/achats/factures/", findMany: (a) => prisma.supplierInvoice.findMany(a as never) },
];

const DOC_SELECT = {
  id: true,
  number: true,
  status: true,
  issuedAt: true,
  client: { select: { name: true } },
} as const;

async function searchDocuments(
  query: string,
  limit: number,
): Promise<SearchHit[]> {
  const where = { number: contains(query) };
  const rows = await Promise.all(
    DOC_TABLES.map((t) =>
      t
        .findMany({
          where,
          take: limit,
          orderBy: { issuedAt: "desc" },
          select: DOC_SELECT,
        })
        .then((rows) => ({ table: t, rows })),
    ),
  );

  const hits: SearchHit[] = [];
  for (const { table, rows: docRows } of rows) {
    for (const row of docRows) {
      hits.push({
        type: "document" as const,
        id: `${table.key}-${row.id}`,
        title: row.number,
        titleAr: null,
        subtitle: `${table.label} · ${row.client?.name ?? "—"}`,
        href: `${table.hrefPrefix}${row.id}`,
        icon: table.icon,
      });
    }
  }
  return hits;
}

export async function recentDocuments(limit = 6): Promise<SearchHit[]> {
  const rows = await Promise.all(
    DOC_TABLES.map((t) =>
      t
        .findMany({
          where: { number: contains("") },
          take: limit,
          orderBy: { issuedAt: "desc" },
          select: DOC_SELECT,
        })
        .then((rows) => ({ table: t, rows })),
    ),
  );

  const flat = rows
    .flatMap(({ table, rows: docRows }) =>
      docRows.map((row) => ({ table, row })),
    )
    .sort((a, b) => b.row.issuedAt.getTime() - a.row.issuedAt.getTime())
    .slice(0, limit);

  return flat.map(({ table, row }) => ({
    type: "document" as const,
    id: `${table.key}-${row.id}`,
    title: row.number,
    titleAr: null,
    subtitle: `${table.label} · ${row.client?.name ?? "—"}`,
    href: `${table.hrefPrefix}${row.id}`,
    icon: table.icon,
  }));
}

export async function globalSearch(
  query: string,
  limit = 5,
): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  const containsQ = { contains: q, mode: "insensitive" } as const;
  const where = { OR: [{ name: containsQ }, { code: containsQ }] };

  const [clients, products, users, branches, documents] = await Promise.all([
    prisma.client.findMany({
      where,
      take: limit,
      orderBy: { name: "asc" },
      select: { id: true, name: true, nameAr: true, code: true, sector: true },
    }),
    prisma.product.findMany({
      where: {
        OR: [{ name: containsQ }, { sku: containsQ }],
      },
      take: limit,
      orderBy: { name: "asc" },
      select: { id: true, name: true, nameAr: true, sku: true, category: true },
    }),
    prisma.user.findMany({
      where: {
        OR: [{ username: containsQ }, { fullName: containsQ }, { email: containsQ }],
      },
      take: limit,
      orderBy: { username: "asc" },
      select: { id: true, username: true, fullName: true, email: true },
    }),
    prisma.branch.findMany({
      where: {
        OR: [{ name: containsQ }, { code: containsQ }],
      },
      take: limit,
      orderBy: { name: "asc" },
      select: { id: true, name: true, nameAr: true, code: true, city: true },
    }),
    searchDocuments(q, limit),
  ]);

  const hits: SearchHit[] = [
    ...clients.map((c) => ({
      type: "client" as const,
      id: c.id,
      title: c.name,
      titleAr: c.nameAr,
      subtitle: `Client · ${c.code}${c.sector ? ` · ${c.sector}` : ""}`,
      href: `/crm/${c.id}`,
      icon: "group",
    })),
    ...products.map((p) => ({
      type: "product" as const,
      id: p.id,
      title: p.name,
      titleAr: p.nameAr,
      subtitle: `Article · ${p.sku}${p.category ? ` · ${p.category}` : ""}`,
      href: `/stock/${p.id}`,
      icon: "inventory_2",
    })),
    ...users.map((u) => ({
      type: "user" as const,
      id: u.id,
      title: u.fullName ?? u.username,
      titleAr: null,
      subtitle: `Utilisateur · ${u.username}${u.email ? ` · ${u.email}` : ""}`,
      href: `/parametres/utilisateurs/${u.id}`,
      icon: "person",
    })),
    ...branches.map((b) => ({
      type: "branch" as const,
      id: b.id,
      title: b.name,
      titleAr: b.nameAr,
      subtitle: `Succursale · ${b.code}${b.city ? ` · ${b.city}` : ""}`,
      href: `/parametres/succursales/${b.id}`,
      icon: "domain",
    })),
    ...documents,
  ];

  if (hits.length < limit) {
    hits.push(
      ...quickActions.map((a) => ({
        type: "action" as const,
        id: a.href,
        title: a.title,
        titleAr: a.titleAr,
        subtitle: null,
        href: a.href,
        icon: a.icon,
      })),
    );
  }

  return hits.slice(0, limit * 4);
}
