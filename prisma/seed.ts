import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/features/auth/password";
import { PERMISSIONS } from "../src/features/auth/permissions";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://localhost:5432/dzerp";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  console.log("→ Nettoyage des données existantes…");

  await prisma.rolePermission.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.activityEvent.deleteMany();
  await prisma.fileAsset.deleteMany();
  await prisma.session.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.counter.deleteMany();
  await prisma.documentSeries.deleteMany();
  await prisma.supplierInvoiceLine.deleteMany();
  await prisma.supplierInvoice.deleteMany();
  await prisma.goodsReceiptLine.deleteMany();
  await prisma.goodsReceipt.deleteMany();
  await prisma.purchaseOrderLine.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.purchaseRequestLine.deleteMany();
  await prisma.purchaseRequest.deleteMany();
  await prisma.creditNoteLine.deleteMany();
  await prisma.creditNote.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.deliveryNoteLine.deleteMany();
  await prisma.deliveryNote.deleteMany();
  await prisma.salesOrderLine.deleteMany();
  await prisma.salesOrder.deleteMany();
  await prisma.quotationLine.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.user.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.client.deleteMany();
  await prisma.product.deleteMany();
  await prisma.branch.deleteMany();

  console.log("→ Succursales…");
  const branches = [
    { code: "HQ", name: "Siège Social - Alger", nameAr: "المقر الرئيسي - الجزائر العاصمة", type: "HEADQUARTER" as const, city: "Alger", phone: "+213 21 00 00 00", email: "contact@dzerp.dz" },
    { code: "OR", name: "Direction Ouest - Oran", nameAr: "المديرية الغربية - وهران", type: "DIRECTION" as const, city: "Oran", phone: "+213 41 00 00 00", email: "oran@dzerp.dz" },
    { code: "CE", name: "Direction Est - Constantine", nameAr: "المديرية الشرقية - قسنطينة", type: "DIRECTION" as const, city: "Constantine", phone: "+213 31 00 00 00", email: "constantine@dzerp.dz" },
    { code: "SU", name: "Direction Sud - Ouargla", nameAr: "المديرية الجنوبية - ورقلة", type: "DIRECTION" as const, city: "Ouargla", phone: "+213 29 00 00 00", email: "ouargla@dzerp.dz" },
  ];
  const branchRecords: Record<string, string> = {};
  for (const branch of branches) {
    const record = await prisma.branch.upsert({
      where: { code: branch.code },
      update: branch,
      create: branch,
    });
    branchRecords[branch.code] = record.id;
  }

  console.log("→ Permissions (catalogue)…");
  const permissionIds: Record<string, string> = {};
  for (const [key, value] of Object.entries(PERMISSIONS)) {
    const record = await prisma.permission.upsert({
      where: { key },
      update: { module: value.module, name: value.name, nameAr: value.nameAr },
      create: { key, module: value.module, name: value.name, nameAr: value.nameAr },
    });
    permissionIds[key] = record.id;
  }

  console.log("→ Rôles…");
  const adminRole = await prisma.role.upsert({
    where: { key: "ADMIN" },
    update: { name: "Administrateur", nameAr: "مدير النظام" },
    create: {
      key: "ADMIN",
      name: "Administrateur",
      nameAr: "مدير النظام",
      description: "Accès complet à l'application.",
      isSystem: true,
    },
  });

  const managerRole = await prisma.role.upsert({
    where: { key: "MANAGER" },
    update: { name: "Gestionnaire", nameAr: "مدير" },
    create: {
      key: "MANAGER",
      name: "Gestionnaire",
      nameAr: "مدير",
      description: "Gestion des opérations courantes.",
    },
  });

  const readerRole = await prisma.role.upsert({
    where: { key: "READER" },
    update: { name: "Consultation", nameAr: "مطّلع" },
    create: {
      key: "READER",
      name: "Consultation",
      nameAr: "مطّلع",
      description: "Accès en lecture seule.",
    },
  });

  await prisma.rolePermission.createMany({
    data: Object.keys(permissionIds).map((key) => ({
      roleId: adminRole.id,
      permissionId: permissionIds[key],
    })),
  });

  const managerPerms = [
    "dashboard.view", "crm.client.view", "crm.client.create", "crm.client.update",
    "crm.fournisseur.view", "crm.fournisseur.create",
    "ventes.devis.view", "ventes.devis.create", "ventes.devis.update",
    "ventes.facture.view", "ventes.facture.create",
    "ventes.proforma.view", "ventes.proforma.create",
    "ventes.commande.view", "ventes.commande.create",
    "ventes.livraison.view", "ventes.livraison.create",
    "ventes.avoir.view", "ventes.avoir.create",
    "achats.bon.view", "achats.bon.create",
    "achats.besoin.view", "achats.besoin.create",
    "achats.reception.view", "achats.reception.create",
    "achats.facture.view", "achats.facture.create",
    "stock.view", "stock.mouvement.create",
    "stock.produit.view", "stock.produit.create",
    "stock.entrepot.view", "stock.entrepot.create",
    "production.view",
    "compta.view",
    "rh.view",
    "rapports.view",
    "search.global", "files.upload",
  ];
  await prisma.rolePermission.createMany({
    data: managerPerms
      .filter((key) => permissionIds[key])
      .map((key) => ({ roleId: managerRole.id, permissionId: permissionIds[key] })),
  });

  const readerPerms = [
    "dashboard.view", "crm.client.view", "crm.fournisseur.view",
    "ventes.devis.view", "ventes.facture.view",
    "ventes.proforma.view", "ventes.commande.view",
    "ventes.livraison.view", "ventes.avoir.view",
    "achats.bon.view", "achats.besoin.view",
    "achats.reception.view", "achats.facture.view",
    "stock.view", "stock.produit.view", "stock.entrepot.view",
    "production.view", "compta.view", "rh.view", "rapports.view", "search.global",
  ];
  await prisma.rolePermission.createMany({
    data: readerPerms
      .filter((key) => permissionIds[key])
      .map((key) => ({ roleId: readerRole.id, permissionId: permissionIds[key] })),
  });

  console.log("→ Utilisateurs…");
  const adminPasswordHash = await hashPassword("admin123");

  const users = [
    {
      username: "admin",
      email: "admin@dzerp.dz",
      fullName: "Administrateur Système",
      title: "Administrateur",
      roleKey: "ADMIN",
      branchCode: "HQ",
    },
    {
      username: "directeur.oran",
      email: "directeur.oran@dzerp.dz",
      fullName: "Directeur Ouest",
      title: "Directeur de direction",
      roleKey: "MANAGER",
      branchCode: "OR",
    },
    {
      username: "lecteur",
      email: "lecteur@dzerp.dz",
      fullName: "Comptable",
      title: "Consultation",
      roleKey: "READER",
      branchCode: "HQ",
    },
  ];

  for (const user of users) {
    const record = await prisma.user.upsert({
      where: { username: user.username },
      update: { fullName: user.fullName, title: user.title, branchId: branchRecords[user.branchCode] },
      create: {
        username: user.username,
        email: user.email,
        passwordHash: adminPasswordHash,
        fullName: user.fullName,
        title: user.title,
        branchId: branchRecords[user.branchCode],
      },
    });
    const role = await prisma.role.findUniqueOrThrow({ where: { key: user.roleKey } });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: record.id, roleId: role.id } },
      update: {},
      create: { userId: record.id, roleId: role.id },
    });
  }

  console.log("→ Paramètres…");
  const settings = [
    { key: "company.name", value: "DzERP Algérie", type: "STRING" as const, description: "Nom de l'entreprise", isPublic: true },
    { key: "company.taxId", value: "099116001234567", type: "STRING" as const, description: "NIF" },
    { key: "company.address", value: "Cité administrative, Bab Ezzouar, Alger", type: "STRING" as const, description: "Adresse du siège", isPublic: true },
    { key: "company.phone", value: "+213 21 00 00 00", type: "STRING" as const, description: "Téléphone", isPublic: true },
    { key: "company.email", value: "contact@dzerp.dz", type: "STRING" as const, description: "Email", isPublic: true },
    { key: "company.currency", value: "DZD", type: "STRING" as const, description: "Devise par défaut", isPublic: true },
    { key: "locale.default", value: "fr", type: "STRING" as const, description: "Langue par défaut", isPublic: true },
    { key: "theme.default", value: "light", type: "STRING" as const, description: "Thème par défaut", isPublic: true },
    { key: "fiscal.year", value: "2026", type: "NUMBER" as const, description: "Exercice comptable courant" },
    { key: "notifications.email", value: "true", type: "BOOLEAN" as const, description: "Notifications par email" },
    {
      key: "tax.rates",
      value: JSON.stringify([
        { key: "TVA_19", label: "TVA 19%", rate: 19, isDefault: true },
        { key: "TVA_09", label: "TVA 9%", rate: 9 },
        { key: "TVA_00", label: "Exonéré (0%)", rate: 0, exempt: true },
      ]),
      type: "JSON" as const,
      description: "Taux de TVA configurés",
    },
    {
      key: "currency.list",
      value: JSON.stringify([
        { code: "DZD", name: "Dinar Algérien", symbol: "دج", rate: 1, isDefault: true, isActive: true },
        { code: "EUR", name: "Euro", symbol: "€", rate: 145, isActive: true },
        { code: "USD", name: "Dollar US", symbol: "$", rate: 135, isActive: true },
      ]),
      type: "JSON" as const,
      description: "Liste des devises",
    },
    {
      key: "units.list",
      value: JSON.stringify([
        { key: "u", label: "Unité", labelAr: "وحدة" },
        { key: "m", label: "Mètre", labelAr: "متر" },
        { key: "kg", label: "Kilogramme", labelAr: "كيلوغرام" },
        { key: "rouleau", label: "Rouleau", labelAr: "لفة" },
        { key: "carton", label: "Carton", labelAr: "كرتون" },
      ]),
      type: "JSON" as const,
      description: "Unités de mesure",
    },
  ];
  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value, type: setting.type, description: setting.description, isPublic: setting.isPublic },
      create: setting,
    });
  }

  console.log("→ Compteurs documentaires…");
  const counters = [
    { key: "devis", prefix: "DEV", padLength: 4 },
    { key: "bon_commande", prefix: "BC", padLength: 4 },
    { key: "facture", prefix: "FA", padLength: 4 },
    { key: "bon_livraison", prefix: "BL", padLength: 4 },
  ];
  for (const counter of counters) {
    await prisma.counter.upsert({
      where: { key: counter.key },
      update: { prefix: counter.prefix, padLength: counter.padLength },
      create: counter,
    });
  }

  console.log("→ Séries documentaires…");
  const series = [
    { key: "QUOTATION", docType: "QUOTATION" as const, label: "Devis", labelAr: "عرض سعر", prefix: "DEV" },
    { key: "SALES_ORDER", docType: "SALES_ORDER" as const, label: "Commande", labelAr: "طلب شراء", prefix: "BC" },
    { key: "DELIVERY_NOTE", docType: "DELIVERY_NOTE" as const, label: "Bon de livraison", labelAr: "ورقة تسليم", prefix: "BL" },
    { key: "INVOICE", docType: "INVOICE" as const, label: "Facture", labelAr: "فاتورة", prefix: "FA" },
    { key: "CREDIT_NOTE", docType: "CREDIT_NOTE" as const, label: "Avoir", labelAr: "سند دائن", prefix: "AV" },
    { key: "PURCHASE_REQUEST", docType: "PURCHASE_REQUEST" as const, label: "Demande d'achat", labelAr: "طلب شراء", prefix: "DA" },
    { key: "PURCHASE_ORDER", docType: "PURCHASE_ORDER" as const, label: "Bon de commande", labelAr: "أمر شراء", prefix: "BCM" },
    { key: "GOODS_RECEIPT", docType: "GOODS_RECEIPT" as const, label: "Bon de réception", labelAr: "ورقة استلام", prefix: "BR" },
    { key: "SUPPLIER_INVOICE", docType: "SUPPLIER_INVOICE" as const, label: "Facture fournisseur", labelAr: "فاتورة مورد", prefix: "FF" },
  ];
  for (const s of series) {
    await prisma.documentSeries.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }

  console.log("→ Données de démonstration…");
  const clients = [
    { code: "CL-0001", name: "Sonatrach SA", nameAr: "سوناطراك", sector: "Énergie", taxId: "099116001234567", balance: 12500000 },
    { code: "CL-0002", name: "Cevital Group", nameAr: "مجمع سيفيتال", sector: "Agroalimentaire", taxId: "099916002345678", balance: 8350000 },
    { code: "CL-0003", name: "Cosider TP", nameAr: "كوسيدار", sector: "Construction", taxId: "099816003456789", balance: 5120000 },
    { code: "CL-0004", name: "Naftal Distribution", nameAr: "نفطال", sector: "Distribution", taxId: "099216004567890", balance: 2140000 },
    { code: "CL-0005", name: "Algérie Télécom", nameAr: "اتصالات الجزائر", sector: "Télécommunications", taxId: "099416005678901", balance: 980000 },
  ];
  for (const client of clients) {
    await prisma.client.upsert({
      where: { code: client.code },
      update: {},
      create: client,
    });
  }

  const products = [
    { sku: "ART-0001", name: "Pompe industrielle 50kW", nameAr: "مضخة صناعية 50 كيلوواط", unit: "unité", category: "Équipement", price: 450000, stock: 12, stockMin: 5 },
    { sku: "ART-0002", name: "Moteur électrique 50kW", nameAr: "محرك كهربائي 50 كيلوواط", unit: "unité", category: "Équipement", price: 780000, stock: 3, stockMin: 4 },
    { sku: "ART-0003", name: "Tube acier DN100", nameAr: "أنبوب فولاذي DN100", unit: "m", category: "Pièces", price: 1200, stock: 2400, stockMin: 500 },
    { sku: "ART-0004", name: "Groupe électrogène 100kVA", nameAr: "مولد كهربائي 100 كيلوفولت أمبير", unit: "unité", category: "Équipement", price: 3200000, stock: 2, stockMin: 1 },
    { sku: "ART-0005", name: "Câble électrique 3x2.5mm²", nameAr: "كابل كهربائي 3×2.5", unit: "rouleau", category: "Électricité", price: 8500, stock: 180, stockMin: 50 },
  ];
  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {},
      create: product,
    });
  }

  const counts = {
    branches: await prisma.branch.count(),
    users: await prisma.user.count(),
    roles: await prisma.role.count(),
    permissions: await prisma.permission.count(),
    clients: await prisma.client.count(),
    products: await prisma.product.count(),
  };

  console.log("Seed terminé :", counts);
  console.log("Connexion : admin / admin123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
