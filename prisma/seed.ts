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

  await prisma.roleAssignment.deleteMany();
  await prisma.userCompany.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.activityEvent.deleteMany();
  await prisma.fileAsset.deleteMany();
  await prisma.session.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.counter.deleteMany();
  await prisma.documentSeries.deleteMany();
  await prisma.documentApproval.deleteMany();
  await prisma.commune.deleteMany();
  await prisma.wilaya.deleteMany();
  await prisma.bank.deleteMany();
  await prisma.paymentMethod.deleteMany();
  await prisma.businessSector.deleteMany();
  await prisma.legalForm.deleteMany();
  await prisma.country.deleteMany();
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
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.warehouseLocation.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.productSupplier.deleteMany();
  await prisma.productAttributeValue.deleteMany();
  await prisma.productAttribute.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.manufacturer.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.vatCategory.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.company.deleteMany();

  console.log("→ Société par défaut (Phase 5.3)…");
  const mainCompany = await prisma.company.upsert({
    where: { code: "MAIN" },
    update: {
      name: "DzERP Algérie",
      nameAr: "دزيرب الجزائر",
      currency: "DZD",
      isDefault: true,
      isActive: true,
    },
    create: {
      code: "MAIN",
      name: "DzERP Algérie",
      nameAr: "دزيرب الجزائر",
      currency: "DZD",
      isDefault: true,
      isActive: true,
    },
  });

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
      where: { companyId_code: { companyId: mainCompany.id, code: branch.code } },
      update: {
        name: branch.name,
        nameAr: branch.nameAr,
        type: branch.type,
        city: branch.city,
        phone: branch.phone,
        email: branch.email,
      },
      create: { ...branch, companyId: mainCompany.id },
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
    "dashboard.view", "crm.customer.view", "crm.customer.create", "crm.customer.update",
    "crm.supplier.view", "crm.supplier.create",
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
    "product.view", "product.create", "product.update",
    "warehouse.view", "warehouse.create", "warehouse.update",
    "inventory.view", "inventory.create", "inventory.adjust", "inventory.transfer",
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
    "dashboard.view", "crm.customer.view", "crm.supplier.view",
    "ventes.devis.view", "ventes.facture.view",
    "ventes.proforma.view", "ventes.commande.view",
    "ventes.livraison.view", "ventes.avoir.view",
    "achats.bon.view", "achats.besoin.view",
    "achats.reception.view", "achats.facture.view",
    "product.view", "warehouse.view", "inventory.view",
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

    // Phase 5.3 : adhésion société par défaut + attribution de rôle (RoleAssignment).
    const membership = await prisma.userCompany.upsert({
      where: { userId_companyId: { userId: record.id, companyId: mainCompany.id } },
      update: { active: true, isDefault: true },
      create: {
        userId: record.id,
        companyId: mainCompany.id,
        active: true,
        isDefault: true,
      },
    });
    await prisma.roleAssignment.upsert({
      where: {
        userCompanyId_roleId: { userCompanyId: membership.id, roleId: role.id },
      },
      update: { active: true, assignedBy: record.id },
      create: {
        userCompanyId: membership.id,
        roleId: role.id,
        active: true,
        assignedBy: record.id,
      },
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
    { key: "CUSTOMER", docType: "CUSTOMER" as const, label: "Client", labelAr: "عميل", prefix: "CUS", padLength: 6, withYear: false },
    { key: "SUPPLIER", docType: "SUPPLIER" as const, label: "Fournisseur", labelAr: "مورد", prefix: "SUP", padLength: 6, withYear: false },
    { key: "PRODUCT", docType: "PRODUCT" as const, label: "Produit", labelAr: "منتج", prefix: "PRD", padLength: 6, withYear: false },
    { key: "WAREHOUSE", docType: "WAREHOUSE" as const, label: "Entrepôt", labelAr: "مستودع", prefix: "WH", padLength: 6, withYear: false },
    { key: "INVENTORY_MOVEMENT", docType: "INVENTORY_MOVEMENT" as const, label: "Mouvement de stock", labelAr: "حركة مخزون", prefix: "MOV", padLength: 6, withYear: false },
  ];
  for (const s of series) {
    await prisma.documentSeries.upsert({
      where: { companyId_key: { companyId: mainCompany.id, key: s.key } },
      update: {},
      create: { ...s, companyId: mainCompany.id },
    });
  }

  console.log("→ Référentiels (fondation algérienne)…");

  const countries = [
    { code: "DZ", name: "Algérie", nameAr: "الجزائر", isDefault: true },
    { code: "FR", name: "France", nameAr: "فرنسا" },
    { code: "MA", name: "Maroc", nameAr: "المغرب" },
    { code: "TN", name: "Tunisie", nameAr: "تونس" },
    { code: "ES", name: "Espagne", nameAr: "إسبانيا" },
    { code: "IT", name: "Italie", nameAr: "إيطاليا" },
    { code: "DE", name: "Allemagne", nameAr: "ألمانيا" },
    { code: "CN", name: "Chine", nameAr: "الصين" },
    { code: "TR", name: "Turquie", nameAr: "تركيا" },
    { code: "US", name: "États-Unis", nameAr: "الولايات المتحدة" },
    { code: "AE", name: "Émirats arabes unis", nameAr: "الإمارات العربية المتحدة" },
    { code: "SA", name: "Arabie saoudite", nameAr: "المملكة العربية السعودية" },
  ];
  for (const country of countries) {
    await prisma.country.upsert({
      where: { code: country.code },
      update: {},
      create: country,
    });
  }

  const legalForms = [
    { code: "SARL", name: "SARL", nameAr: "شركة ذات مسؤولية محدودة" },
    { code: "EURL", name: "EURL", nameAr: "شركة ذات مسؤولية محدودة بمسؤولية فردية" },
    { code: "SPA", name: "SPA", nameAr: "شركة مساهمة" },
    { code: "SNC", name: "SNC", nameAr: "شركة تضامنية" },
    { code: "SCS", name: "SCS", nameAr: "شركة توصية بسيطة" },
    { code: "SCA", name: "SCA", nameAr: "شركة توصية بالأسهم" },
    { code: "EI", name: "Entreprise Individuelle", nameAr: "مؤسسة فردية" },
    { code: "AE", name: "Auto-Entrepreneur", nameAr: "مقاول ذاتي" },
    { code: "ASSOC", name: "Association", nameAr: "جمعية" },
    { code: "COOP", name: "Coopérative", nameAr: "تعاونية" },
    { code: "PUB", name: "Institution Publique", nameAr: "مؤسسة عمومية" },
    { code: "GIE", name: "Groupement d'Intérêt Économique", nameAr: "مجموعة المصالح الاقتصادية" },
    { code: "HOLDING", name: "Holding", nameAr: "شركة قابضة" },
    { code: "SUCC", name: "Succursale", nameAr: "فرع" },
  ];
  for (const form of legalForms) {
    await prisma.legalForm.upsert({ where: { code: form.code }, update: {}, create: form });
  }

  const businessSectors = [
    { code: "construction", name: "Construction", nameAr: "البناء" },
    { code: "beton", name: "Produits en béton", nameAr: "منتجات خرسانية" },
    { code: "industrie", name: "Industrie & Manufacturing", nameAr: "الصناعة والتحويل" },
    { code: "detail", name: "Commerce de détail", nameAr: "تجارة التجزئة" },
    { code: "gros", name: "Commerce de gros", nameAr: "تجارة الجملة" },
    { code: "transport", name: "Transport", nameAr: "النقل" },
    { code: "agriculture", name: "Agriculture", nameAr: "الفلاحة" },
    { code: "sante", name: "Santé", nameAr: "الصحة" },
    { code: "education", name: "Éducation", nameAr: "التعليم" },
    { code: "it", name: "Informatique & IT", nameAr: "الإعلام الآلي" },
    { code: "hotellerie", name: "Hôtellerie & Restauration", nameAr: "الفنادق والمطاعم" },
    { code: "services", name: "Services", nameAr: "الخدمات" },
    { code: "energie", name: "Énergie", nameAr: "الطاقة" },
    { code: "btp", name: "BTP & Travaux publics", nameAr: "البناء والأشغال العمومية" },
    { code: "telecom", name: "Télécommunications", nameAr: "الاتصالات" },
    { code: "agroalimentaire", name: "Agroalimentaire", nameAr: "الصناعات الغذائية" },
    { code: "immobilier", name: "Immobilier", nameAr: "العقار" },
    { code: "distribution", name: "Distribution", nameAr: "التوزيع" },
    { code: "import_export", name: "Import / Export", nameAr: "الاستيراد والتصدير" },
    { code: "finance", name: "Finance", nameAr: "المالية" },
  ];
  for (const sector of businessSectors) {
    await prisma.businessSector.upsert({ where: { code: sector.code }, update: {}, create: sector });
  }

  const paymentMethods = [
    { code: "cash", name: "Espèces", nameAr: "نقدًا" },
    { code: "cheque", name: "Chèque", nameAr: "شيك" },
    { code: "transfert", name: "Virement bancaire", nameAr: "تحويل بنكي" },
    { code: "carte", name: "Carte bancaire", nameAr: "بطاقة بنكية" },
    { code: "differe", name: "Paiement différé", nameAr: "دفع مؤجل" },
    { code: "30j", name: "30 jours", nameAr: "30 يومًا", days: 30 },
    { code: "60j", name: "60 jours", nameAr: "60 يومًا", days: 60 },
    { code: "90j", name: "90 jours", nameAr: "90 يومًا", days: 90 },
    { code: "lc", name: "Lettre de crédit", nameAr: "اعتماد مستندي" },
    { code: "traite", name: "Traite", nameAr: "سند سحب" },
  ];
  for (const method of paymentMethods) {
    await prisma.paymentMethod.upsert({ where: { code: method.code }, update: {}, create: method });
  }

  const banks = [
    { code: "BEA", name: "Banque Extérieure d'Algérie", nameAr: "البنك الخارجي الجزائري" },
    { code: "BNA", name: "Banque Nationale d'Algérie", nameAr: "البنك الوطني الجزائري" },
    { code: "BDL", name: "Banque de Développement Local", nameAr: "بنك التنمية المحلية" },
    { code: "CPA", name: "Crédit Populaire d'Algérie", nameAr: "القرض الشعبي الجزائري" },
    { code: "BADR", name: "Banque de l'Agriculture et du Développement Rural", nameAr: "بنك الفلاحة والتنمية الريفية" },
    { code: "CNEP", name: "Caisse Nationale d'Épargne et de Prévoyance", nameAr: "الصندوق الوطني للادخار والاحتياط" },
    { code: "SG", name: "Société Générale Algérie", nameAr: "سوسيتيه جنرال الجزائر" },
    { code: "BNP", name: "BNP Paribas El Djazaïr", nameAr: "بي إن بي باريبا الجزائر" },
    { code: "TBA", name: "Trust Bank Algeria", nameAr: "تراست بنك الجزائر" },
    { code: "ABARAKA", name: "Al Baraka Bank", nameAr: "بنك البركة" },
    { code: "GBA", name: "Gulf Bank Algérie", nameAr: "بنك الخليج الجزائر" },
    { code: "HBA", name: "Housing Bank", nameAr: "بنك السكن" },
    { code: "CITI", name: "Citibank Algérie", nameAr: "سيتي بنك الجزائر" },
    { code: "CACIB", name: "Crédit Agricole Corporate & Investment Bank", nameAr: "كريدي أغريكول الجزائر" },
    { code: "ARAB", name: "Arab Bank", nameAr: "البنك العربي" },
    { code: "NATIXIS", name: "Natixis Algérie", nameAr: "ناتيكسيس الجزائر" },
    { code: "CCP", name: "Algérie Poste (CCP)", nameAr: "بريد الجزائر (حساب جاري بريدي)" },
    { code: "BOFA", name: "Bank Of Africa Algérie", nameAr: "بنك إفريقيا الجزائر" },
    { code: "SALEM", name: "Salem Banque", nameAr: "سليم بنك" },
  ];
  for (const bank of banks) {
    await prisma.bank.upsert({ where: { code: bank.code }, update: {}, create: bank });
  }

  console.log("→ Wilayas (58) et communes…");
  // [code, nomFr, nomAr, [communes supplémentaires hors chef-lieu]]
  const wilayas: [string, string, string, string[]][] = [
    ["01", "Adrar", "أدرار", []],
    ["02", "Chlef", "الشلف", []],
    ["03", "Laghouat", "الأغواط", []],
    ["04", "Oum El Bouaghi", "أم البواقي", []],
    ["05", "Batna", "باتنة", []],
    ["06", "Béjaïa", "بجاية", ["Akbou", "أقبو"]],
    ["07", "Biskra", "بسكرة", []],
    ["08", "Béchar", "بشار", []],
    ["09", "Blida", "البليدة", ["Boufarik", "بوفاريك"]],
    ["10", "Bouira", "البويرة", []],
    ["11", "Tamanrasset", "تمنراست", []],
    ["12", "Tébessa", "تبسة", []],
    ["13", "Tlemcen", "تلمسان", []],
    ["14", "Tiaret", "تيارت", []],
    ["15", "Tizi Ouzou", "تيزي وزو", ["Azazga", "عزازقة"]],
    ["16", "Alger", "الجزائر", ["Bab El Oued", "باب الوادي", "Bab Ezzouar", "باب الزوار", "Kouba", "القبة", "El Harrach", "الحراش", "Bordj El Kiffan", "برج الكيفان", "Bir Mourad Raïs", "بئر مراد رايس", "Cheraga", "الشراقة", "Hussein Dey", "حسين داي"]],
    ["17", "Djelfa", "الجلفة", []],
    ["18", "Jijel", "جيجل", []],
    ["19", "Sétif", "سطيف", ["El Eulma", "العلمة"]],
    ["20", "Saïda", "سعيدة", []],
    ["21", "Skikda", "سكيكدة", []],
    ["22", "Sidi Bel Abbès", "سيدي بلعباس", []],
    ["23", "Annaba", "عنابة", ["El Bouni", "البوني", "Sidi Amar", "سيدي عمار"]],
    ["24", "Guelma", "قالمة", []],
    ["25", "Constantine", "قسنطينة", ["El Khroub", "الخروب", "Didouche Mourad", "ديدوش مراد", "Hamma Bouziane", "حامة بوزيان", "Ain Smara", "عين سمارة"]],
    ["26", "Médéa", "المدية", []],
    ["27", "Mostaganem", "مستغانم", []],
    ["28", "M'Sila", "المسيلة", []],
    ["29", "Mascara", "معسكر", []],
    ["30", "Ouargla", "ورقلة", ["Rouissat", "الرويسات", "Hassi Ben Abdellah", "حاسي بن عبد الله"]],
    ["31", "Oran", "وهران", ["Es Sénia", "السانية", "Bir El Djir", "بئر الجير", "Arzew", "أرزيو", "Aïn El Turk", "عين الترك"]],
    ["32", "El Bayadh", "البيض", []],
    ["33", "Illizi", "إيليزي", []],
    ["34", "Bordj Bou Arréridj", "برج بوعريريج", []],
    ["35", "Boumerdès", "بومرداس", ["Bordj Menaïel", "برج منايل", "Thenia", "الثنية", "Boudouaou", "بودواو", "Khemis El Khechna", "خميس الخشنة"]],
    ["36", "El Tarf", "الطارف", []],
    ["37", "Tindouf", "تندوف", []],
    ["38", "Tissemsilt", "تيسمسيلت", []],
    ["39", "El Oued", "الوادي", ["Guemar", "قمار"]],
    ["40", "Khenchela", "خنشلة", []],
    ["41", "Souk Ahras", "سوق أهراس", []],
    ["42", "Tipaza", "تيبازة", []],
    ["43", "Mila", "ميلة", []],
    ["44", "Aïn Defla", "عين الدفلى", []],
    ["45", "Naâma", "النعامة", []],
    ["46", "Aïn Témouchent", "عين تموشنت", []],
    ["47", "Ghardaïa", "غرداية", []],
    ["48", "Relizane", "غليزان", []],
    ["49", "Timimoun", "تيميمون", []],
    ["50", "Bordj Badji Mokhtar", "برج باجي مختار", []],
    ["51", "Ouled Djellal", "أولاد جلال", []],
    ["52", "Béni Abbès", "بني عباس", []],
    ["53", "In Salah", "عين صالح", []],
    ["54", "In Guezzam", "عين قزام", []],
    ["55", "Touggourt", "تقرت", []],
    ["56", "Djanet", "جانت", []],
    ["57", "El M'Ghair", "المغير", []],
    ["58", "El Meniaa", "المنيعة", []],
  ];
  for (const [code, name, nameAr, extra] of wilayas) {
    await prisma.wilaya.upsert({
      where: { code },
      update: {},
      create: { code, name, nameAr },
    });
    const capitalCode = `${code}-01`;
    await prisma.commune.upsert({
      where: { code: capitalCode },
      update: {},
      create: { code: capitalCode, wilayaCode: code, name, nameAr },
    });
    for (let i = 0; i + 1 < extra.length; i += 2) {
      const index = Math.floor(i / 2) + 2;
      await prisma.commune.upsert({
        where: { code: `${code}-${String(index).padStart(2, "0")}` },
        update: {},
        create: {
          code: `${code}-${String(index).padStart(2, "0")}`,
          wilayaCode: code,
          name: extra[i],
          nameAr: extra[i + 1],
        },
      });
    }
  }

  console.log("→ Données de démonstration…");
  const customers = [
    { code: "CUS-000001", name: "Sonatrach SA", nameAr: "سوناطراك", sector: "Énergie", taxId: "099116001234567", balance: 12500000 },
    { code: "CUS-000002", name: "Cevital Group", nameAr: "مجمع سيفيتال", sector: "Agroalimentaire", taxId: "099916002345678", balance: 8350000 },
    { code: "CUS-000003", name: "Cosider TP", nameAr: "كوسيدار", sector: "Construction", taxId: "099816003456789", balance: 5120000 },
    { code: "CUS-000004", name: "Naftal Distribution", nameAr: "نفطال", sector: "Distribution", taxId: "099216004567890", balance: 2140000 },
    { code: "CUS-000005", name: "Algérie Télécom", nameAr: "اتصالات الجزائر", sector: "Télécommunications", taxId: "099416005678901", balance: 980000 },
  ];
  for (const customer of customers) {
    await prisma.customer.upsert({
      where: { companyId_code: { companyId: mainCompany.id, code: customer.code } },
      update: {},
      create: { ...customer, companyId: mainCompany.id },
    });
  }

  const suppliers = [
    { code: "SUP-000001", name: "Sarl Métallurgie Maghreb", nameAr: "شركة معادن المغرب العربي", sector: "Industrie & Manufacturing", taxId: "099016006789012" },
    { code: "SUP-000002", name: "Cimenterie du Nord", nameAr: "اسمنت الشمال", sector: "BTP & Travaux publics", taxId: "099116007890123" },
    { code: "SUP-000003", name: "Fournitures Industrielles SA", nameAr: "اللوازم الصناعية", sector: "Import / Export", taxId: "099216008901234" },
  ];
  for (const supplier of suppliers) {
    await prisma.supplier.upsert({
      where: { companyId_code: { companyId: mainCompany.id, code: supplier.code } },
      update: {},
      create: { ...supplier, companyId: mainCompany.id },
    });
  }

  // Keep partner series counters past the seeded demo codes.
  await prisma.documentSeries.updateMany({
    where: { companyId: mainCompany.id, docType: "CUSTOMER" },
    data: { nextValue: BigInt(6) },
  });
  await prisma.documentSeries.updateMany({
    where: { companyId: mainCompany.id, docType: "SUPPLIER" },
    data: { nextValue: BigInt(4) },
  });

  console.log("→ Catalogue produits (Phase 4)…");

  const units = [
    { code: "U", name: "Unité", nameAr: "وحدة" },
    { code: "M", name: "Mètre", nameAr: "متر" },
    { code: "ROU", name: "Rouleau", nameAr: "لفة" },
  ];
  const unitRecords: Record<string, string> = {};
  for (const unit of units) {
    const record = await prisma.unit.upsert({
      where: { code: unit.code },
      update: { name: unit.name, nameAr: unit.nameAr },
      create: unit,
    });
    unitRecords[unit.code] = record.id;
  }

  const vatCategories = [
    { code: "TVA_19", name: "TVA 19%", nameAr: "ت.ق.م 19٪", rate: 19, isDefault: true },
    { code: "TVA_09", name: "TVA 9%", nameAr: "ت.ق.م 9٪", rate: 9 },
    { code: "TVA_00", name: "Exonéré (0%)", nameAr: "معفى (0٪)", rate: 0 },
  ];
  const vatRecords: Record<string, string> = {};
  for (const vat of vatCategories) {
    const record = await prisma.vatCategory.upsert({
      where: { code: vat.code },
      update: { name: vat.name, nameAr: vat.nameAr, rate: vat.rate },
      create: vat,
    });
    vatRecords[vat.code] = record.id;
  }

  const categories = [
    { code: "EQUIP", name: "Équipement", nameAr: "معدات", parentCode: null },
    { code: "POMPES", name: "Pompes", nameAr: "مضخات", parentCode: "EQUIP" },
    { code: "MOTEURS", name: "Moteurs", nameAr: "محركات", parentCode: "EQUIP" },
    { code: "GROUPE", name: "Groupe électrogène", nameAr: "مولدات", parentCode: "EQUIP" },
    { code: "PIECES", name: "Pièces", nameAr: "قطع غيار", parentCode: null },
    { code: "ELEC", name: "Électricité", nameAr: "كهرباء", parentCode: null },
  ];
  const categoryRecords: Record<string, string> = {};
  for (const category of categories) {
    const record = await prisma.productCategory.upsert({
      where: { companyId_code: { companyId: mainCompany.id, code: category.code } },
      update: { name: category.name, nameAr: category.nameAr },
      create: {
        code: category.code,
        name: category.name,
        nameAr: category.nameAr,
        companyId: mainCompany.id,
      },
    });
    categoryRecords[category.code] = record.id;
  }
  for (const category of categories) {
    if (category.parentCode) {
      await prisma.productCategory.update({
        where: { companyId_code: { companyId: mainCompany.id, code: category.code } },
        data: { parentId: categoryRecords[category.parentCode] },
      });
    }
  }

  const brands = [
    { code: "GRUNDFOS", name: "Grundfos", nameAr: "غروندفوس" },
    { code: "SIEMENS", name: "Siemens", nameAr: "سيمنز" },
    { code: "ABB", name: "ABB", nameAr: "إيه بي بي" },
    { code: "CATERPILLAR", name: "Caterpillar", nameAr: "كاتربيلر" },
  ];
  const brandRecords: Record<string, string> = {};
  for (const brand of brands) {
    const record = await prisma.brand.upsert({
      where: { companyId_code: { companyId: mainCompany.id, code: brand.code } },
      update: { name: brand.name, nameAr: brand.nameAr },
      create: { ...brand, companyId: mainCompany.id },
    });
    brandRecords[brand.code] = record.id;
  }

  const manufacturers = [
    { code: "SONELGAZ", name: "Sonelgaz Équipements", nameAr: "سونلغاز للتجهيزات" },
    { code: "INOX", name: "Inox SA", nameAr: "إينوكس" },
  ];
  const manufacturerRecords: Record<string, string> = {};
  for (const manufacturer of manufacturers) {
    const record = await prisma.manufacturer.upsert({
      where: { companyId_code: { companyId: mainCompany.id, code: manufacturer.code } },
      update: { name: manufacturer.name, nameAr: manufacturer.nameAr },
      create: { ...manufacturer, companyId: mainCompany.id },
    });
    manufacturerRecords[manufacturer.code] = record.id;
  }

  const products = [
    {
      code: "PRD-000001",
      sku: "ART-0001",
      name: "Pompe industrielle 50kW",
      nameAr: "مضخة صناعية 50 كيلوواط",
      category: "POMPES",
      brand: "GRUNDFOS",
      manufacturer: "SONELGAZ",
      unit: "U",
      vat: "TVA_19",
      costPrice: 350000,
      sellingPrice: 450000,
      stockMin: 5,
    },
    {
      code: "PRD-000002",
      sku: "ART-0002",
      name: "Moteur électrique 50kW",
      nameAr: "محرك كهربائي 50 كيلوواط",
      category: "MOTEURS",
      brand: "SIEMENS",
      manufacturer: "SONELGAZ",
      unit: "U",
      vat: "TVA_19",
      costPrice: 620000,
      sellingPrice: 780000,
      stockMin: 4,
    },
    {
      code: "PRD-000003",
      sku: "ART-0003",
      name: "Tube acier DN100",
      nameAr: "أنبوب فولاذي DN100",
      category: "PIECES",
      brand: null,
      manufacturer: "INOX",
      unit: "M",
      vat: "TVA_09",
      costPrice: 900,
      sellingPrice: 1200,
      stockMin: 500,
    },
    {
      code: "PRD-000004",
      sku: "ART-0004",
      name: "Groupe électrogène 100kVA",
      nameAr: "مولد كهربائي 100 كيلوفولت أمبير",
      category: "GROUPE",
      brand: "CATERPILLAR",
      manufacturer: null,
      unit: "U",
      vat: "TVA_19",
      costPrice: 2700000,
      sellingPrice: 3200000,
      stockMin: 1,
    },
    {
      code: "PRD-000005",
      sku: "ART-0005",
      name: "Câble électrique 3x2.5mm²",
      nameAr: "كابل كهربائي 3×2.5",
      category: "ELEC",
      brand: "ABB",
      manufacturer: null,
      unit: "ROU",
      vat: "TVA_19",
      costPrice: 6500,
      sellingPrice: 8500,
      stockMin: 50,
    },
  ];

  const productRecords: Record<string, string> = {};
  for (const product of products) {
    const record = await prisma.product.upsert({
      where: { companyId_sku: { companyId: mainCompany.id, sku: product.sku } },
      update: {},
      create: {
        code: product.code,
        sku: product.sku,
        companyId: mainCompany.id,
        name: product.name,
        nameAr: product.nameAr,
        categoryId: categoryRecords[product.category],
        brandId: product.brand ? brandRecords[product.brand] : null,
        manufacturerId: product.manufacturer
          ? manufacturerRecords[product.manufacturer]
          : null,
        purchaseUnitId: unitRecords[product.unit],
        salesUnitId: unitRecords[product.unit],
        inventoryUnitId: unitRecords[product.unit],
        vatCategoryId: vatRecords[product.vat],
        costPrice: product.costPrice,
        purchasePrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        retailPrice: product.sellingPrice,
        minimumQuantity: product.stockMin,
        reorderPoint: product.stockMin,
        trackInventory: true,
        allowNegativeStock: false,
        costingMethod: "AVERAGE",
        minimumSellingPrice: product.costPrice,
        isActive: true,
      },
    });
    productRecords[product.sku] = record.id;
  }

  console.log("→ Entrepôts (Phase 4)…");
  const warehouses = [
    {
      code: "WH-000001",
      name: "Entrepôt Central - Alger",
      nameAr: "المستودع المركزي - الجزائر",
      branchCode: "HQ",
      address: "Zone industrielle, Rouiba, Alger",
    },
    {
      code: "WH-000002",
      name: "Entrepôt Ouest - Oran",
      nameAr: "مستودع الغرب - وهران",
      branchCode: "OR",
      address: "Zone industrielle, Es Sénia, Oran",
    },
  ];
  const warehouseRecords: Record<string, string> = {};
  for (const warehouse of warehouses) {
    const record = await prisma.warehouse.upsert({
      where: { companyId_code: { companyId: mainCompany.id, code: warehouse.code } },
      update: {},
      create: {
        code: warehouse.code,
        name: warehouse.name,
        nameAr: warehouse.nameAr,
        companyId: mainCompany.id,
        branchId: branchRecords[warehouse.branchCode],
        address: warehouse.address,
        isActive: true,
      },
    });
    warehouseRecords[warehouse.code] = record.id;
  }

  console.log("→ Mouvements d'inventaire (Phase 4)…");
  const openingBalances = [
    { sku: "ART-0001", warehouseCode: "WH-000001", quantity: 12, unitCost: 350000 },
    { sku: "ART-0002", warehouseCode: "WH-000001", quantity: 3, unitCost: 620000 },
    { sku: "ART-0003", warehouseCode: "WH-000001", quantity: 1500, unitCost: 900 },
    { sku: "ART-0003", warehouseCode: "WH-000002", quantity: 900, unitCost: 920 },
    { sku: "ART-0004", warehouseCode: "WH-000001", quantity: 2, unitCost: 2700000 },
    { sku: "ART-0005", warehouseCode: "WH-000001", quantity: 120, unitCost: 6500 },
    { sku: "ART-0005", warehouseCode: "WH-000002", quantity: 60, unitCost: 6800 },
  ];
  for (const [index, balance] of openingBalances.entries()) {
    const number = `MOV-${String(index + 1).padStart(6, "0")}`;
    await prisma.inventoryMovement.create({
      data: {
        number,
        type: "OPENING_BALANCE",
        companyId: mainCompany.id,
        productId: productRecords[balance.sku],
        warehouseId: warehouseRecords[balance.warehouseCode],
        quantity: balance.quantity,
        unitCost: balance.unitCost,
        occurredAt: new Date(),
      },
    });
  }

  // Keep Phase 4 series counters past the seeded demo codes.
  await prisma.documentSeries.updateMany({
    where: { companyId: mainCompany.id, docType: "PRODUCT" },
    data: { nextValue: BigInt(6) },
  });
  await prisma.documentSeries.updateMany({
    where: { companyId: mainCompany.id, docType: "WAREHOUSE" },
    data: { nextValue: BigInt(3) },
  });
  await prisma.documentSeries.updateMany({
    where: { companyId: mainCompany.id, docType: "INVENTORY_MOVEMENT" },
    data: { nextValue: BigInt(openingBalances.length + 1) },
  });

  const counts = {
    companies: await prisma.company.count(),
    userCompanies: await prisma.userCompany.count(),
    roleAssignments: await prisma.roleAssignment.count(),
    branches: await prisma.branch.count(),
    users: await prisma.user.count(),
    roles: await prisma.role.count(),
    permissions: await prisma.permission.count(),
    customers: await prisma.customer.count(),
    suppliers: await prisma.supplier.count(),
    products: await prisma.product.count(),
    productCategories: await prisma.productCategory.count(),
    brands: await prisma.brand.count(),
    manufacturers: await prisma.manufacturer.count(),
    units: await prisma.unit.count(),
    vatCategories: await prisma.vatCategory.count(),
    warehouses: await prisma.warehouse.count(),
    inventoryMovements: await prisma.inventoryMovement.count(),
    wilayas: await prisma.wilaya.count(),
    communes: await prisma.commune.count(),
    countries: await prisma.country.count(),
    legalForms: await prisma.legalForm.count(),
    sectors: await prisma.businessSector.count(),
    paymentMethods: await prisma.paymentMethod.count(),
    banks: await prisma.bank.count(),
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
