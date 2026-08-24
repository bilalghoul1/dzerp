import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { runUnscoped } from "../src/features/company/context";

// PHASE 7.3 — Corrige le libellé arabe des séries SALES_ORDER déjà semées
// ("طلب شراء" → "أمر بيع"). Sûr et idempotent : ne touche que les lignes dont
// le labelAr est encore l'ancienne valeur erronée.

async function main(): Promise<void> {
  await runUnscoped(async () => {
    const wrong = await prisma.documentSeries.count({
      where: { docType: "SALES_ORDER", labelAr: "طلب شراء" },
    });
    const updated = await prisma.documentSeries.updateMany({
      where: { docType: "SALES_ORDER", labelAr: "طلب شراء" },
      data: { labelAr: "أمر بيع" },
    });
    const remaining = await prisma.documentSeries.findMany({
      where: { docType: "SALES_ORDER" },
      select: { label: true, labelAr: true, prefix: true },
    });
    console.log(`DocumentSeries SALES_ORDER : ${wrong} ligne(s) erronée(s) → ${updated.count} corrigée(s).`);
    for (const row of remaining) {
      console.log(`  - ${row.label} / ${row.labelAr} (${row.prefix})`);
    }
  });
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
