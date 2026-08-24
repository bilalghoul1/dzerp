/**
 * Seed du barème IRG (Impôt sur le Revenu Global) algérien.
 *
 * Barème mensuel net imposable (Loi de finances en vigueur) :
 *   0 %      : 0 ............. 20 000 DZD
 *   23 %     : 20 001 ......... 40 000 DZD
 *   27 %     : 40 001 ......... 80 000 DZD
 *   30 %     : 80 001 ........ 160 000 DZD
 *   33 %     : 160 001 ....... 320 000 DZD
 *   35 %     : > 320 000 DZD
 *
 * Abattement forfaitaire légal : 40 % du salaire brut imposable,
 * plafonné entre 1 000 DZD (minimum) et 1 500 DZD (maximum).
 * (Le surplus d'abattement pour personnes handicapées se gère par employé
 *  via un champ dédié côté SalarySlip si besoin.)
 *
 * Usage :
 *   npm run db:seed:irg
 *   COMPANY_ID=xxx npm run db:seed:irg
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://localhost:5432/dzerp";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

type Bracket = {
  min: number;
  max: number | null;
  rate: number;
  deductible: number;
  label: string;
  labelAr: string;
};

const BAREME: Bracket[] = [
  { min: 0, max: 20000, rate: 0, deductible: 1500, label: "Exonéré", labelAr: "معفى" },
  { min: 20001, max: 40000, rate: 0.23, deductible: 1500, label: "23 %", labelAr: "23 %" },
  { min: 40001, max: 80000, rate: 0.27, deductible: 1500, label: "27 %", labelAr: "27 %" },
  { min: 80001, max: 160000, rate: 0.3, deductible: 1500, label: "30 %", labelAr: "30 %" },
  { min: 160001, max: 320000, rate: 0.33, deductible: 1500, label: "33 %", labelAr: "33 %" },
  { min: 320001, max: null, rate: 0.35, deductible: 1500, label: "35 %", labelAr: "35 %" },
];

async function main() {
  const companyId = process.env.COMPANY_ID;
  const company = companyId
    ? await prisma.company.findUnique({ where: { id: companyId } })
    : await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });

  if (!company) {
    throw new Error("Aucune société trouvée. Créez une société puis relancez le seed IRG.");
  }

  console.log(`→ Seed barème IRG pour la société : ${company.id}`);

  // Nettoyage idempotent des tranches existantes pour cette société.
  await prisma.irgBracket.deleteMany({ where: { companyId: company.id } });

  for (const b of BAREME) {
    await prisma.irgBracket.create({
      data: {
        companyId: company.id,
        min: b.min,
        max: b.max,
        rate: b.rate,
        deductible: b.deductible,
        label: b.label,
        labelAr: b.labelAr,
      },
    });
  }

  console.log(`✓ ${BAREME.length} tranches IRG insérées.`);
}

main()
  .catch((e) => {
    console.error("✗ Erreur seed IRG :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
