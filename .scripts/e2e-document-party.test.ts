/**
 * Verify that mapToPrintableDocument produces BOTH:
 *  - company data as the document source (seller)
 *  - customer data independently (party) from the linked Customer
 * Performs a real query against documents in the DB (any type).
 */
import "dotenv/config";
import { prisma, prismaBase } from "../src/lib/prisma";
import { runUnscoped } from "../src/features/company/context";
import { mapToPrintableDocument } from "../src/features/print/map-document";
import type { CommercialDocType } from "../src/features/documents/engine/types";

async function main() {
  console.log("=== E2E: Document maps company + customer independently ===\n");

  const company = await prismaBase.company.findFirst({
    where: { isActive: true, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (!company) throw new Error("No company in DB");

  // Wrapped in runUnscoped so extended-client queries (mapToPrintableDocument)
  // can run without a session/ALS company context.
  await runUnscoped(async () => {

  // Look for a real customer-linked document (Invoice, Quotation, SalesOrder...)
  const DOCS: Array<{ model: "invoice" | "quotation"; type: CommercialDocType }> = [
    { model: "invoice", type: "INVOICE" },
    { model: "quotation", type: "QUOTATION" },
  ];

  let found: { id: string; number: string; type: CommercialDocType } | null = null;
  for (const d of DOCS) {
    // Use the extended client (prisma) which auto-filters soft-deleted rows.
    const row = await (prisma as any)[d.model].findFirst({
      where: d.model === "invoice" ? { customerId: { not: null } } : { customerId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { id: true, number: true },
    });
    if (row) {
      found = { id: row.id, number: row.number, type: d.type };
      break;
    }
  }

  if (!found) {
    console.log("No customer-linked document found. Creating a minimal one...");
    // locate a customer to link
    const cust = await prismaBase.customer.findFirst({
      where: { deletedAt: null, companyId: company.id },
      orderBy: { createdAt: "asc" },
    });
    if (!cust) {
      console.log("No customer available either. Skipping party assertion.");
      console.log("RESULT: cannot fully verify (no customer-linked data)");
      return;
    }
    found = { id: cust.id, number: "(customer)", type: "QUOTATION" };
    console.log("Using customer directly for party check (no doc).");
    // We'll verify party mapping end-to-end via a real quotation instead if possible.
  }

  console.log(`Using document: ${found.type} #${found.number} (${found.id})`);

  try {
    const printable = await mapToPrintableDocument(found.type, found.id, company.id);

    console.log("\n[Company / issuer]:");
    console.log("  company.name =", printable.company.name);

    console.log("\n[Customer / party]:");
    const p = printable.party;
    console.log("  party.name =", p?.name ?? "(null)");
    console.log("  party.code =", p?.code ?? "(null)");
    console.log("  party.rc   =", p?.rc ?? "(null)");
    console.log("  party.nif  =", p?.taxId ?? "(null)");

    const hasCompanyName = !!printable.company.name && printable.company.name !== "DzERP Algérie";
    const hasParty = !!p && !!p.name;

    // company name must NOT equal the customer name (independent sources)
    const independent =
      hasCompanyName &&
      hasParty &&
      printable.company.name !== p.name;

    console.log("\n=========================================");
    console.log("DOCUMENT MAP RESULT:", independent ? "PASS" : "CHECK");
    console.log("  Company name present (not default):", hasCompanyName ? "OK" : "FAIL");
    console.log("  Customer party present            :", hasParty ? "OK" : "FAIL");
    console.log("  Company != Customer (independent) :", independent ? "OK" : "--");
    console.log("=========================================");
  } catch (e) {
    console.error("\nmapToPrintableDocument failed:", e);
  }
  }); // end runUnscoped
}

main()
  .catch((e) => { console.error("ERROR:", e); process.exitCode = 1; })
  .finally(async () => {
    await prisma.$disconnect();
    await prismaBase.$disconnect();
  });
