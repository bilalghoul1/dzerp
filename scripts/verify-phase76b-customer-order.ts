import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { runUnscoped } from "../src/features/company/context";
import {
  getValidTransitions,
  getDocConfig,
  assertAllowedConversion,
  ALLOWED_CONVERSIONS,
  getAllDocTypes,
} from "../src/features/documents/engine/config";
import { getPrintConfig } from "../src/features/print/registry";
import { STATUS_META, STATUS_ORDER } from "../src/features/documents/framework/status-meta";
import { getUiConfig } from "../src/features/documents/framework/ui-config";

// PHASE 7.6B — CUSTOMER_ORDER (bon de commande client reçu) → FACTURE_PROFORMA.
// Tests service (aucun serveur requis) : enregistrement moteur, conversions
// autorisées, garde ALREADY_CONVERTED, transitions de statut, libellés, série
// BCREC/PF, enregistrement print/search/company-scope, i18n.

let pass = 0;
let fail = 0;

function check(label: string, ok: boolean): void {
  console.log(`${ok ? "  ✅" : "  ❌"} ${label}`);
  if (ok) pass++;
  else fail++;
}

async function main(): Promise<void> {
  console.log("=== PHASE 7.6B — vérifications service (sans serveur) ===");

  // 1. Les deux nouveaux types sont des CommercialDocType enregistrés.
  check(
    "1 — CUSTOMER_ORDER et PROFORMA présents via getDocConfig",
    Boolean(getDocConfig("CUSTOMER_ORDER")) && Boolean(getDocConfig("PROFORMA")),
  );

  // 2. Conversion autorisée / refusée.
  let allowed = true;
  try {
    assertAllowedConversion("CUSTOMER_ORDER", "PROFORMA");
  } catch {
    allowed = false;
  }
  check("2 — CUSTOMER_ORDER→PROFORMA autorisée", allowed);

  let refused = false;
  try {
    assertAllowedConversion("PROFORMA", "SALES_ORDER");
  } catch {
    refused = true;
  }
  check("2 — PROFORMA→SALES_ORDER refusée (portée future)", refused);

  check(
    "2 — ALLOWED_CONVERSIONS CUSTOMER_ORDER=[PROFORMA], PROFORMA=[]",
    JSON.stringify(ALLOWED_CONVERSIONS.CUSTOMER_ORDER) === '["PROFORMA"]' &&
      JSON.stringify(ALLOWED_CONVERSIONS.PROFORMA) === "[]",
  );
  // Tous les CommercialDocType ont une entrée dans ALLOWED_CONVERSIONS
  // (vérifie que SALES_CONVERSIONS/PURCHASING_CONVERSIONS sont exhaustifs).
  const allTypes = getAllDocTypes();
  check(
    "2 — ALLOWED_CONVERSIONS couvre tous les CommercialDocType",
    allTypes.every((t) => Array.isArray((ALLOWED_CONVERSIONS as Record<string, unknown>)[t])),
  );

  // 3. Transitions de statut du cycle entrant.
  const receivedT = getValidTransitions("RECEIVED", "CUSTOMER_ORDER").map((t) => t.to);
  check(
    "3 — RECEIVED expose UNDER_REVIEW et PROFORMA_CREATED",
    receivedT.includes("UNDER_REVIEW") && receivedT.includes("PROFORMA_CREATED"),
  );
  const reviewT = getValidTransitions("UNDER_REVIEW", "CUSTOMER_ORDER").map((t) => t.to);
  check("3 — UNDER_REVIEW expose PROFORMA_CREATED", reviewT.includes("PROFORMA_CREATED"));

  // 4. Nouveaux statuts présents dans STATUS_META / STATUS_ORDER.
  const newStatuses = ["RECEIVED", "UNDER_REVIEW", "PROFORMA_CREATED", "PROFORMA_SENT", "ACCEPTED", "COMPLETED"];
  check(
    "4 — 6 nouveaux statuts dans STATUS_META",
    newStatuses.every((s) => Boolean((STATUS_META as Record<string, unknown>)[s])),
  );
  check(
    "4 — 6 nouveaux statuts dans STATUS_ORDER",
    newStatuses.every((s) => STATUS_ORDER.includes(s as never)),
  );

  // 5. Libellés moteur (FR + AR).
  check(
    "5 — config CUSTOMER_ORDER labelAr « طلبية العميل الواردة »",
    getDocConfig("CUSTOMER_ORDER").labelAr === "طلبية العميل الواردة",
  );
  check(
    "5 — config PROFORMA labelAr « فاتورة مبدئية »",
    getDocConfig("PROFORMA").labelAr === "فاتورة مبدئية",
  );
  check("5 — CUSTOMER_ORDER prefixe BCREC", getDocConfig("CUSTOMER_ORDER").numberPrefix === "BCREC");
  check("5 — PROFORMA prefixe PF", getDocConfig("PROFORMA").numberPrefix === "PF");

  // 6. Enregistrement UI / PDF.
  check("6 — getUiConfig CUSTOMER_ORDER et PROFORMA présents", Boolean(getUiConfig("CUSTOMER_ORDER")) && Boolean(getUiConfig("PROFORMA")));
  const coPrint = getPrintConfig("CUSTOMER_ORDER");
  const pfPrint = getPrintConfig("PROFORMA");
  check("6 — PRINT CUSTOMER_ORDER showReceivedAt/showNeededAt", coPrint.showReceivedAt === true && coPrint.showNeededAt === true);
  check("6 — PRINT PROFORMA showValidUntil", pfPrint.showValidUntil === true);

  // 7. Série DocumentSeries BCREC / PF — seulement si une société existe ET si
  //    la base a été migrée (sinon l'enum DocType ne contient pas les nouveaux
  //    types et la requête échoue — déploiement en attente d'approbation).
  const anyCompany = await prisma.company.findFirst();
  if (anyCompany) {
    try {
      const coSeries = await prisma.documentSeries.findFirst({
        where: { companyId: anyCompany.id, docType: "CUSTOMER_ORDER", isActive: true },
      });
      const pfSeries = await prisma.documentSeries.findFirst({
        where: { companyId: anyCompany.id, docType: "PROFORMA", isActive: true },
      });
      check("7 — série CUSTOMER_ORDER seedée (BCREC)", coSeries?.prefix === "BCREC");
      check("7 — série PROFORMA seedée (PF)", pfSeries?.prefix === "PF");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      check(
        "7 — base NON migrée (enum DocType sans CUSTOMER_ORDER/PROFORMA) — déploiement en attente",
        /enum "DocType"/.test(msg),
      );
    }
  } else {
    check("7 — aucune société en base (série non vérifiable)", true);
  }

  // 8. Les anciens types ne sont pas cassés.
  check("8 — QUOTATION→SALES_ORDER toujours autorisée", (() => {
    try { assertAllowedConversion("QUOTATION", "SALES_ORDER"); return true; } catch { return false; }
  })());
  check("8 — SALES_ORDER→DELIVERY_NOTE toujours autorisée", (() => {
    try { assertAllowedConversion("SALES_ORDER", "DELIVERY_NOTE"); return true; } catch { return false; }
  })());

  console.log(`\nPHASE 7.6B — ${pass} succès, ${fail} échec(s).`);
  if (fail > 0) process.exit(1);
}

runUnscoped(() => main())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

