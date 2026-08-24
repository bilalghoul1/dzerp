/**
 * Seed du Plan Comptable Financier (PCF / SCF) algérien.
 *
 * Peuple la table `Account` (par société) avec l'arborescence nationale
 * des classes 1 à 7 (le compte 8 "Hors bilan" et 9 "Comptes de résultat
 * analytique" sont omis volontairement pour rester aligné sur le SCF de base).
 *
 * Usage :
 *   npx tsx prisma/seed-scf.ts            # pour la 1re société trouvée
 *   COMPANY_ID=xxx npx tsx prisma/seed-scf.ts
 *
 * Idempotent : recrée proprement la racine SCF pour la société cible.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://localhost:5432/dzerp";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

type Acc = {
  code: string;
  name: string;
  nameAr: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  parent?: string;
};

// Arborescence SCF (extrait normalisé des classes 1→7).
const SCF: Acc[] = [
  // Classe 1 — Comptes de financement permanent
  { code: "1", name: "Capitaux permanents", nameAr: "رؤوس الأموال الدائمة", type: "EQUITY" },
  { code: "101", name: "Capital émis", nameAr: "رأس المال المصدر", type: "EQUITY", parent: "1" },
  { code: "106", name: "Réserves", nameAr: "الاحتياطيات", type: "EQUITY", parent: "1" },
  { code: "108", name: "Compte de résultat (bénéfice ou perte)", nameAr: "حساب النتيجة (ربح أو خسارة)", type: "EQUITY", parent: "1" },
  { code: "14", name: "Comptes d'affectation du résultat", nameAr: "حسابات توزيع النتيجة", type: "EQUITY", parent: "1" },
  { code: "15", name: "Provisions réglementées", nameAr: "المخصصات التنظيمية", type: "LIABILITY", parent: "1" },
  { code: "16", name: "Emprunts et dettes financières", nameAr: "القروض والديون المالية", type: "LIABILITY", parent: "1" },
  { code: "18", name: "Comptes de liaison des établissements", nameAr: "حسابات ربط المنشآت", type: "EQUITY", parent: "1" },

  // Classe 2 — Immobilisations
  { code: "2", name: "Immobilisations", nameAr: "الأصول الثابتة", type: "ASSET" },
  { code: "21", name: "Immobilisations incorporelles", nameAr: "أصول معنوية", type: "ASSET", parent: "2" },
  { code: "22", name: "Immobilisations corporelles", nameAr: "أصول مادية", type: "ASSET", parent: "2" },
  { code: "23", name: "Immobilisations en cours", nameAr: "أصول قيد الإنجاز", type: "ASSET", parent: "2" },

  // Classe 3 — Stocks
  { code: "3", name: "Stocks", nameAr: "المخزونات", type: "ASSET" },
  { code: "31", name: "Matières premières", nameAr: "المواد الأولية", type: "ASSET", parent: "3" },
  { code: "32", name: "Autres approvisionnements", nameAr: "تموينات أخرى", type: "ASSET", parent: "3" },
  { code: "33", name: "En-cours de production", nameAr: "أعمال تحت الإنتاج", type: "ASSET", parent: "3" },
  { code: "34", name: "Produits intermédiaires et finis", nameAr: "منتجات وسيطة وتامة", type: "ASSET", parent: "3" },
  { code: "35", name: "Marchandises", nameAr: "بضائع", type: "ASSET", parent: "3" },

  // Classe 4 — Tiers
  { code: "4", name: "Comptes de tiers", nameAr: "حسابات الأطراف", type: "ASSET" },
  { code: "41", name: "Clients", nameAr: "العملاء", type: "ASSET", parent: "4" },
  { code: "42", name: "Clients — effets à recevoir", nameAr: "عملاء — كمبيالات قبض", type: "ASSET", parent: "4" },
  { code: "43", name: "Fournisseurs", nameAr: "الموردون", type: "LIABILITY", parent: "4" },
  { code: "44", name: "Fournisseurs — effets à payer", nameAr: "موردون — كمبيالات دفع", type: "LIABILITY", parent: "4" },
  { code: "45", name: "Personnel", nameAr: "الموظفون", type: "LIABILITY", parent: "4" },
  { code: "46", name: "Organismes sociaux et fiscaux", nameAr: "الهيئات الاجتماعية والضريبية", type: "LIABILITY", parent: "4" },
  { code: "47", name: "Comptes d'attente", nameAr: "حسابات انتظار", type: "ASSET", parent: "4" },
  { code: "48", name: "Créances et dettes hors exploitation", nameAr: "ديون ومطلوبات خارج النشاط", type: "ASSET", parent: "4" },
  { code: "49", name: "Participations et comptes en participation", nameAr: "مساهمات وحسابات مشاركة", type: "ASSET", parent: "4" },

  // Classe 5 — Trésorerie
  { code: "5", name: "Comptes financiers", nameAr: "الحسابات المالية", type: "ASSET" },
  { code: "51", name: "Valeurs à encaisser", nameAr: "قيم قابلة للتحصيل", type: "ASSET", parent: "5" },
  { code: "52", name: "Banques", nameAr: "البنوك", type: "ASSET", parent: "5" },
  { code: "53", name: "Établissements et chèques postaux", nameAr: "المؤسسات والشيكات البريدية", type: "ASSET", parent: "5" },
  { code: "54", name: "Régimes d'espèces", nameAr: "أنظمة النقد", type: "ASSET", parent: "5" },
  { code: "58", name: "Virements internes", nameAr: "التحويلات الداخلية", type: "ASSET", parent: "5" },

  // Classe 6 — Charges
  { code: "6", name: "Comptes de charges", nameAr: "حسابات الأعباء", type: "EXPENSE" },
  { code: "61", name: "Charges de personnel", nameAr: "أعباء الموظفين", type: "EXPENSE", parent: "6" },
  { code: "62", name: "Autres charges externes", nameAr: "أعباء خارجية أخرى", type: "EXPENSE", parent: "6" },
  { code: "63", name: "Impôts, taxes et versements assimilés", nameAr: "الضرائب والرسوم والمدفوعات المماثلة", type: "EXPENSE", parent: "6" },
  { code: "64", name: "Charges financières", nameAr: "الأعباء المالية", type: "EXPENSE", parent: "6" },
  { code: "65", name: " Pertes de change", nameAr: "خسائر الصرف", type: "EXPENSE", parent: "6" },
  { code: "66", name: "Charges exceptionnelles", nameAr: "الأعباء الاستثنائية", type: "EXPENSE", parent: "6" },
  { code: "67", name: "Charges sur répartitions", nameAr: "أعباء التوزيع", type: "EXPENSE", parent: "6" },

  // Classe 7 — Produits
  { code: "7", name: "Comptes de produits", nameAr: "حسابات الإيرادات", type: "REVENUE" },
  { code: "71", name: "Ventes de produits finis", nameAr: "مبيعات منتجات تامة", type: "REVENUE", parent: "7" },
  { code: "72", name: "Ventes de produits intermédiaires", nameAr: "مبيعات منتجات وسيطة", type: "REVENUE", parent: "7" },
  { code: "73", name: "Ventes de marchandises", nameAr: "مبيعات البضائع", type: "REVENUE", parent: "7" },
  { code: "74", name: "Travaux et services vendus", nameAr: "أشغال وخدمات مباعة", type: "REVENUE", parent: "7" },
  { code: "75", name: "Produits des activités annexes", nameAr: "إيرادات أنشطة ثانوية", type: "REVENUE", parent: "7" },
  { code: "76", name: "Produits financiers", nameAr: "الإيرادات المالية", type: "REVENUE", parent: "7" },
  { code: "77", name: "Reprises, transferts, quotes-parts", nameAr: "استرجاعات وتحويلات وحصص", type: "REVENUE", parent: "7" },
  { code: "78", name: "Produits exceptionnels", nameAr: "الإيرادات الاستثنائية", type: "REVENUE", parent: "7" },
];

async function main() {
  const companyId = process.env.COMPANY_ID;

  const company = companyId
    ? await prisma.company.findUnique({ where: { id: companyId } })
    : await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });

  if (!company) {
    throw new Error("Aucune société trouvée. Créez une société puis relancez le seed SCF.");
  }

  console.log(`→ Seed SCF pour la société : ${company.id}`);

  // Nettoyage idempotent de l'ancien SCF de cette société.
  await prisma.account.deleteMany({ where: { companyId: company.id } });

  for (const acc of SCF) {
    await prisma.account.create({
      data: {
        companyId: company.id,
        code: acc.code,
        name: acc.name,
        nameAr: acc.nameAr,
        type: acc.type,
        parentId: acc.parent
          ? (
              await prisma.account.findFirst({
                where: { companyId: company.id, code: acc.parent },
                select: { id: true },
              })
            )?.id ?? null
          : null,
        isSystem: true,
      },
    });
  }

  console.log(`✓ ${SCF.length} comptes SCF insérés (classes 1→7).`);
}

main()
  .catch((e) => {
    console.error("✗ Erreur seed SCF :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
