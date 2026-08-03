import { prisma } from "@/lib/prisma";

export type SearchHitType =
  | "client"
  | "supplier"
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
  { title: "New quotation", titleAr: "عرض سعر جديد", href: "/devis/nouveau", icon: "note_add" },
  { title: "New customer", titleAr: "عميل جديد", href: "/crm/customers", icon: "person_add" },
  { title: "New purchase order", titleAr: "أمر شراء جديد", href: "/achats/nouveau", icon: "add_shopping_cart" },
  { title: "Reports", titleAr: "التقارير", href: "/rapports", icon: "bar_chart" },
  { title: "Settings", titleAr: "الإعدادات", href: "/parametres", icon: "settings" },
];

type DocParty = "customer" | "supplier";

const DOC_SELECT = (party: DocParty) =>
  ({
    id: true,
    number: true,
    status: true,
    issuedAt: true,
    [party]: { select: { name: true } },
  }) as const;

type DocRow = {
  id: string;
  number: string;
  status: string;
  issuedAt: Date;
  customer?: { name: string } | null;
  supplier?: { name: string } | null;
};

const DOC_TABLES: {
  key: string;
  label: string;
  icon: string;
  hrefPrefix: string;
  party: DocParty;
  findMany: (args: {
    where: { number: { contains: string; mode: "insensitive" } };
    take: number;
    orderBy: { issuedAt: "desc" };
    select: { id: true; number: true; status: true; issuedAt: true };
  }) => Promise<Omit<DocRow, "customer" | "supplier">[]>;
}[] = [
  { key: "QUOTATION", label: "Quotation", icon: "description", hrefPrefix: "/ventes/devis/", party: "customer", findMany: (a) => prisma.quotation.findMany(a as never) },
  { key: "SALES_ORDER", label: "Sales order", icon: "shopping_cart", hrefPrefix: "/ventes/commandes/", party: "customer", findMany: (a) => prisma.salesOrder.findMany(a as never) },
  { key: "DELIVERY_NOTE", label: "Delivery note", icon: "local_shipping", hrefPrefix: "/ventes/livraisons/", party: "customer", findMany: (a) => prisma.deliveryNote.findMany(a as never) },
  { key: "INVOICE", label: "Invoice", icon: "receipt", hrefPrefix: "/ventes/factures/", party: "customer", findMany: (a) => prisma.invoice.findMany(a as never) },
  { key: "PURCHASE_ORDER", label: "Purchase order", icon: "shopping_bag", hrefPrefix: "/achats/bons/", party: "supplier", findMany: (a) => prisma.purchaseOrder.findMany(a as never) },
  { key: "SUPPLIER_INVOICE", label: "Supplier invoice", icon: "payments", hrefPrefix: "/achats/factures/", party: "supplier", findMany: (a) => prisma.supplierInvoice.findMany(a as never) },
];

async function searchDocuments(
  query: string,
  limit: number,
): Promise<SearchHit[]> {
  const where = { number: { contains: query, mode: "insensitive" as const } };
  const rows = await Promise.all(
    DOC_TABLES.map((t) =>
      t
        .findMany({
          where,
          take: limit,
          orderBy: { issuedAt: "desc" },
          select: DOC_SELECT(t.party) as never,
        })
        .then((rows) => ({ table: t, rows })),
    ),
  );

  const hits: SearchHit[] = [];
  for (const { table, rows: docRows } of rows) {
    for (const row of docRows) {
      const party = (row as DocRow)[table.party];
      hits.push({
        type: "document" as const,
        id: `${table.key}-${row.id}`,
        title: row.number,
        titleAr: null,
        subtitle: `${table.label} · ${party?.name ?? "—"}`,
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
          where: { number: { contains: "", mode: "insensitive" as const } },
          take: limit,
          orderBy: { issuedAt: "desc" },
          select: DOC_SELECT(t.party) as never,
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

  return flat.map(({ table, row }) => {
    const party = (row as DocRow)[table.party];
    return {
      type: "document" as const,
      id: `${table.key}-${row.id}`,
      title: row.number,
      titleAr: null,
      subtitle: `${table.label} · ${party?.name ?? "—"}`,
      href: `${table.hrefPrefix}${row.id}`,
      icon: table.icon,
    };
  });
}

export async function globalSearch(
  query: string,
  limit = 5,
): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  const containsQ = { contains: q, mode: "insensitive" } as const;
  const where = { OR: [{ name: containsQ }, { code: containsQ }] };

  const [customers, suppliers, products, users, branches, documents] =
    await Promise.all([
      prisma.customer.findMany({
        where,
        take: limit,
        orderBy: { name: "asc" },
        select: { id: true, name: true, nameAr: true, code: true, sector: true },
      }),
      prisma.supplier.findMany({
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
    ...customers.map((c) => ({
      type: "client" as const,
      id: c.id,
      title: c.name,
      titleAr: c.nameAr,
      subtitle: `Customer · ${c.code}${c.sector ? ` · ${c.sector}` : ""}`,
      href: `/crm/customers`,
      icon: "group",
    })),
    ...suppliers.map((s) => ({
      type: "supplier" as const,
      id: s.id,
      title: s.name,
      titleAr: s.nameAr,
      subtitle: `Supplier · ${s.code}${s.sector ? ` · ${s.sector}` : ""}`,
      href: `/crm/suppliers`,
      icon: "handshake",
    })),
    ...products.map((p) => ({
      type: "product" as const,
      id: p.id,
      title: p.name,
      titleAr: p.nameAr,
      subtitle: `Item · ${p.sku}${p.category ? ` · ${p.category}` : ""}`,
      href: `/stock/${p.id}`,
      icon: "inventory_2",
    })),
    ...users.map((u) => ({
      type: "user" as const,
      id: u.id,
      title: u.fullName ?? u.username,
      titleAr: null,
      subtitle: `User · ${u.username}${u.email ? ` · ${u.email}` : ""}`,
      href: `/parametres/utilisateurs/${u.id}`,
      icon: "person",
    })),
    ...branches.map((b) => ({
      type: "branch" as const,
      id: b.id,
      title: b.name,
      titleAr: b.nameAr,
      subtitle: `Branch · ${b.code}${b.city ? ` · ${b.city}` : ""}`,
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
