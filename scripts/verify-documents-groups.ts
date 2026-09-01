import "dotenv/config";
import { prismaBase } from "../src/lib/prisma";
import { runWithCompanyContext } from "../src/features/company/context";
import type { CompanyContext } from "../src/features/company/types";
import {
  createDocument,
  deleteDocument,
  deleteDocumentsBulk,
  duplicateDocument,
  duplicateDocumentsBulk,
  listDocumentsOverview,
} from "../src/features/documents/engine/service";
import { getAllDocTypes } from "../src/features/documents/engine/config";
import type { CommercialDocType, InputDocument } from "../src/features/documents/engine/types";

// ---------------------------------------------------------------------------
// Vérification de la vue « documents par client » : regroupement, groupe sans
// client (client supprimé), suppressions/suppressions en lots, duplication,
// isolation société, nettoyage DocumentRelation/DocumentApproval/lignes.
// Aucun serveur requis — exécution directe des services sous contexte ALS.
// ---------------------------------------------------------------------------

const results: Array<{ ok: boolean; label: string; detail: string }> = [];

function record(ok: boolean, label: string, detail = ""): void {
  results.push({ ok, label, detail });
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
}

const contextFor = (company: {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
  currency: string;
}) => ({ company }) as unknown as CompanyContext;

const DOC_TYPES = getAllDocTypes();

// Tables d'en-tête + lignes (suppression SQL par société, ordre FKs).
const DOC_TABLES: string[] = [
  "Quotation", "SalesOrder", "DeliveryNote", "Invoice", "CreditNote",
  "PurchaseRequest", "PurchaseOrder", "GoodsReceipt", "SupplierInvoice",
  "CustomerOrder", "Proforma",
];
const DOC_LINE_DELETES: Array<{ line: string; parent: string; fk: string }> = [
  { line: "QuotationLine", parent: "Quotation", fk: "quotationId" },
  { line: "SalesOrderLine", parent: "SalesOrder", fk: "salesOrderId" },
  { line: "DeliveryNoteLine", parent: "DeliveryNote", fk: "deliveryNoteId" },
  { line: "InvoiceLine", parent: "Invoice", fk: "invoiceId" },
  { line: "CreditNoteLine", parent: "CreditNote", fk: "creditNoteId" },
  { line: "PurchaseRequestLine", parent: "PurchaseRequest", fk: "purchaseRequestId" },
  { line: "PurchaseOrderLine", parent: "PurchaseOrder", fk: "purchaseOrderId" },
  { line: "GoodsReceiptLine", parent: "GoodsReceipt", fk: "goodsReceiptId" },
  { line: "SupplierInvoiceLine", parent: "SupplierInvoice", fk: "supplierInvoiceId" },
  { line: "CustomerOrderLine", parent: "CustomerOrder", fk: "customerOrderId" },
  { line: "ProformaLine", parent: "Proforma", fk: "proformaId" },
];

async function cleanupCompany(companyId: string): Promise<void> {
  for (const { line, parent, fk } of DOC_LINE_DELETES) {
    await prismaBase.$executeRawUnsafe(
      `DELETE FROM "${line}" l USING "${parent}" p
       WHERE l."${fk}" = p.id AND p."companyId" = $1`,
      companyId,
    );
  }
  for (const parent of DOC_TABLES) {
    await prismaBase.$executeRawUnsafe(`DELETE FROM "${parent}" WHERE "companyId" = $1`, companyId);
  }
  await prismaBase.$executeRawUnsafe(`DELETE FROM "DocumentApproval" WHERE "companyId" = $1`, companyId);
  await prismaBase.$executeRawUnsafe(`DELETE FROM "DocumentRelation" WHERE "companyId" = $1`, companyId);
  await prismaBase.$executeRawUnsafe(`DELETE FROM "DocumentSeries" WHERE "companyId" = $1`, companyId);
  await prismaBase.$executeRawUnsafe(`DELETE FROM "Customer" WHERE "companyId" = $1`, companyId);
  await prismaBase.$executeRawUnsafe(`DELETE FROM "Supplier" WHERE "companyId" = $1`, companyId);
  await prismaBase.$executeRawUnsafe(`DELETE FROM "Branch" WHERE "companyId" = $1`, companyId);
  await prismaBase.$executeRawUnsafe(`DELETE FROM "Company" WHERE "id" = $1`, companyId);
}

function inputDoc(branchId: string, party: { customerId?: string; supplierId?: string }): InputDocument {
  return {
    branchId,
    currency: "DZD",
    exchangeRate: 1,
    lines: [
      { label: "Article vérification", quantity: 2, unitPrice: 1000, taxPct: 19 },
      { label: "Prestation vérification", quantity: 1, unitPrice: 500, taxPct: 0 },
    ],
    ...party,
  };
}

async function main(): Promise<void> {
  console.log("=== VÉRIF : documents par client (groupes, sans-client, lots, duplication, isolation) ===");

  const stamp = String(Date.now());
  const codes = {
    a: `VGRPA-${stamp}`,
    b: `VGRPB-${stamp}`,
  };

  // ---- Sociétés/succursales/parties de semis (prismaBase : sans extensions) ----
  const companyA = await prismaBase.company.create({
    data: { code: codes.a, name: "Vérif Groupes A", currency: "DZD" },
  });
  const companyB = await prismaBase.company.create({
    data: { code: codes.b, name: "Vérif Groupes B", currency: "DZD" },
  });
  const branchA = await prismaBase.branch.create({
    data: { code: `BR-A-${stamp}`, name: "Siège A", companyId: companyA.id },
  });
  const branchB = await prismaBase.branch.create({
    data: { code: `BR-B-${stamp}`, name: "Siège B", companyId: companyB.id },
  });

  const customerX = await prismaBase.customer.create({
    data: { code: `X-${stamp}`, name: "MultiDocs", companyId: companyA.id },
  });
  const customerY = await prismaBase.customer.create({
    data: { code: `Y-${stamp}`, name: "AutreClient", companyId: companyA.id },
  });
  const supplierZ = await prismaBase.supplier.create({
    data: { code: `Z-${stamp}`, name: "FournisseurZ", companyId: companyA.id },
  });
  const customerB = await prismaBase.customer.create({
    data: { code: `B-${stamp}`, name: "Client B", companyId: companyB.id },
  });

  // ---- Séries actives par société (le moteur lève une erreur sans série) ----
  for (const companyId of [companyA.id, companyB.id]) {
    for (const t of DOC_TYPES) {
      await prismaBase.documentSeries.create({
        data: {
          key: t,
          docType: t as never,
          label: t,
          labelAr: t,
          prefix: t.slice(0, 4),
          padLength: 4,
          withYear: false,
          nextValue: BigInt(1),
          step: 1,
          isActive: true,
          companyId,
        },
      });
    }
  }

  const ctxA = contextFor(companyA);
  const ctxDoc = (companyId: string) => ({
    companyId,
    userId: "verify-documents-groups",
    ip: "127.0.0.1",
    userAgent: "verify",
  });

  try {
    await runWithCompanyContext(ctxA, async () => {
      // 1. Création de documents (2 lignes chacune) via le moteur réel.
      const d1 = (await createDocument("QUOTATION", inputDoc(branchA.id, { customerId: customerX.id }), ctxDoc(companyA.id))) as { id: string; number: string };
      const d2 = (await createDocument("PROFORMA", inputDoc(branchA.id, { customerId: customerX.id }), ctxDoc(companyA.id))) as { id: string; number: string };
      const d3 = (await createDocument("SALES_ORDER", inputDoc(branchA.id, { customerId: customerX.id }), ctxDoc(companyA.id))) as { id: string; number: string };
      const d4 = (await createDocument("QUOTATION", inputDoc(branchA.id, { customerId: customerY.id }), ctxDoc(companyA.id))) as { id: string; number: string };
      const dY2 = (await createDocument("QUOTATION", inputDoc(branchA.id, { customerId: customerY.id }), ctxDoc(companyA.id))) as { id: string; number: string };
      const dY3 = (await createDocument("INVOICE", inputDoc(branchA.id, { customerId: customerY.id }), ctxDoc(companyA.id))) as { id: string; number: string };
      const s1 = (await createDocument("PURCHASE_ORDER", inputDoc(branchA.id, { supplierId: supplierZ.id }), ctxDoc(companyA.id))) as { id: string; number: string };
      const s2 = (await createDocument("PURCHASE_ORDER", inputDoc(branchA.id, { supplierId: supplierZ.id }), ctxDoc(companyA.id))) as { id: string; number: string };
      const co = (await createDocument(
        "CUSTOMER_ORDER",
        { ...inputDoc(branchA.id, { customerId: customerX.id }), customerOrderNumber: "PO-99", conditions: "livraison rapide" },
        ctxDoc(companyA.id),
      )) as { id: string; number: string };

      // 1. Vue d'ensemble : tous présents, groupés par partie, états actifs.
      const overview = await listDocumentsOverview(companyA.id);
      const xRows = overview.filter((r) => r.partyId === customerX.id);
      const yRows = overview.filter((r) => r.partyId === customerY.id);
      const zRows = overview.filter((r) => r.partyId === supplierZ.id);
      record(
        overview.length === 9 && xRows.length === 4 && yRows.length === 3 && zRows.length === 2,
        "1 — Vue d'ensemble : 9 docs A, 4 MultiDocs + 3 AutreClient + 2 FournisseurZ",
        `overview=${overview.length}`,
      );
      record(
        xRows.every((r) => r.partyStatus === "active" && r.partyName === "MultiDocs") &&
          zRows.every((r) => r.partyStatus === "active" && r.partyName === "FournisseurZ"),
        "1 — États partie actifs + noms propagés (groupes client & fournisseur)",
      );

      // 2. Duplication (unitaire + en lot) : nouveau id, nouveau numéro, lignes copiées.
      const dupQ = (await duplicateDocument("QUOTATION", d1.id, ctxDoc(companyA.id))) as { id: string; number: string };
      const srcQ = await prismaBase.quotation.findUnique({ where: { id: d1.id } });
      const newQ = await prismaBase.quotation.findUnique({ where: { id: dupQ.id } });
      record(
        dupQ.id !== d1.id && dupQ.number !== (srcQ?.number ?? "") && newQ?.customerId === customerX.id && newQ?.status === "DRAFT",
        "2 — Duplication QUOTATION : nouveau id + numéro, même client, brouillon",
        `${srcQ?.number} → ${dupQ.number}`,
      );
      const dupQLineCount = await prismaBase.quotationLine.count({ where: { quotationId: dupQ.id } });
      record(dupQLineCount === 2, "2 — Lignes copiées (2/2)", `lines=${dupQLineCount}`);

      const dupCo = (await duplicateDocument("CUSTOMER_ORDER", co.id, ctxDoc(companyA.id))) as { id: string; number: string };
      const newCo = await prismaBase.customerOrder.findUnique({ where: { id: dupCo.id } });
      record(
        newCo?.customerOrderNumber === "PO-99" && newCo?.conditions === "livraison rapide" && newCo?.status === "RECEIVED",
        "2 — Duplication CUSTOMER_ORDER : champs spécifiques copiés (n° client + conditions), statut RECEIVED",
      );

      const bulk = await duplicateDocumentsBulk(
        [
          { docType: "SALES_ORDER" as CommercialDocType, id: d3.id },
          { docType: "QUOTATION" as CommercialDocType, id: d4.id },
          { docType: "PURCHASE_ORDER" as CommercialDocType, id: s2.id },
        ],
        ctxDoc(companyA.id),
      );
      record(
        bulk.duplicated.length === 3 && bulk.failed.length === 0,
        "2 — Duplication en lot : 3/3 réussies",
        `duplicated=${bulk.duplicated.length}, failed=${bulk.failed.length}`,
      );
      const dupD4 = bulk.duplicated.find((r) => r.docType === "QUOTATION");
      const srcD4 = await prismaBase.quotation.findUnique({ where: { id: d4.id } });
      record(
        dupD4 ? dupD4.newId !== d4.id && dupD4.newNumber !== (srcD4?.number ?? "") : false,
        "2 — Chaque copie reçoit un numéro indépendant (série avancée)",
        dupD4 ? `${srcD4?.number} → ${dupD4.newNumber}` : "introuvable",
      );
      const dupD4Id = dupD4?.newId ?? "";

      // 3. Suppression unique (brouillon).
      const del = await deleteDocument("QUOTATION", d4.id, ctxDoc(companyA.id));
      record(del.id === d4.id, "3 — Suppression unique (brouillon) OK", `number=${del.number}`);

      // 4. Suppression en lot multi-types (2 lignes par doc) — brouillons seulement.
      const bulkDel = await deleteDocumentsBulk(
        [
          { docType: "QUOTATION" as CommercialDocType, id: d1.id },
          { docType: "PROFORMA" as CommercialDocType, id: d2.id },
          { docType: "SALES_ORDER" as CommercialDocType, id: d3.id },
        ],
        ctxDoc(companyA.id),
      );
      record(
        bulkDel.deleted.length === 3 && bulkDel.failed.length === 0,
        "4 — Suppression en lot multi-types : 3/3 supprimés",
        `deleted=${bulkDel.deleted.length}, failed=${bulkDel.failed.length}`,
      );

      // 4bis. Un document non-brouillon (RECEIVED) est refusé par le lot.
      const bulkNonDraft = await deleteDocumentsBulk(
        [{ docType: "CUSTOMER_ORDER" as CommercialDocType, id: co.id }],
        ctxDoc(companyA.id),
      );
      record(
        bulkNonDraft.deleted.length === 0 && bulkNonDraft.failed.length === 1,
        "4 — Un RECEIVED est refusé par le lot (motif rapporté)",
        bulkNonDraft.failed[0]?.reason ?? "",
      );

      // 5. Autres parties intactes après les suppressions.
      const afterDel = await listDocumentsOverview(companyA.id);
      const xRowsAfter = afterDel.filter((r) => r.partyId === customerX.id);
      const zRowsAfter = afterDel.filter((r) => r.partyId === supplierZ.id);
      record(
        xRowsAfter.length === 4 && xRowsAfter.filter((r) => r.status === "RECEIVED").length === 2,
        "5 — Client MultiDocs : 2 RECEIVED + 2 brouillons restants (statuts sauvegardés)",
        `X=${xRowsAfter.length}`,
      );
      record(
        zRowsAfter.length === 3,
        "5 — FournisseurZ intact (3 docs, dont la copie en lot)",
        `Z=${zRowsAfter.length}`,
      );

      // 6. Groupe « sans client » : suppression logicielle d'un client…
      await prismaBase.customer.update({ where: { id: customerY.id }, data: { deletedAt: new Date() } });
      const afterSoft = await listDocumentsOverview(companyA.id);
      const yOrphan = afterSoft.filter((r) => r.partyId === customerY.id);
      record(
        yOrphan.length === 3 && yOrphan.every((r) => r.partyStatus === "deleted" && r.partyName === "AutreClient"),
        "6 — Groupe sans client : docs du client supprimé marqués deleted (jamais masqués)",
        `deleted=${yOrphan.length}`,
      );

      // … puis on duplique et on supprime ces documents sans auto-supprimer le client.
      let dupRefused = false;
      try {
        await duplicateDocument("QUOTATION", dY2.id, ctxDoc(companyA.id));
      } catch (e) {
        dupRefused = /client invalide|ne faisant pas partie|invalide/i.test((e as Error).message);
      }
      record(
        dupRefused,
        "6 — Duplication d'un doc sans client refusée par le moteur (validation parties)",
      );
      const delOrphan = await deleteDocumentsBulk(
        [
          { docType: "QUOTATION" as CommercialDocType, id: dY2.id },
          { docType: "INVOICE" as CommercialDocType, id: dY3.id },
          ...(dupD4Id ? [{ docType: "QUOTATION" as CommercialDocType, id: dupD4Id }] : []),
        ],
        ctxDoc(companyA.id),
      );
      record(
        delOrphan.deleted.length === 3 && delOrphan.failed.length === 0,
        "6 — Les docs sans client (brouillons) restent supprimables — aucune auto-suppression du client",
      );
      const yAfter = await listDocumentsOverview(companyA.id);
      record(
        yAfter.filter((r) => r.partyId === customerY.id).length === 0,
        "6 — Tous les docs du client supprimé retirés de la vue (groupe vidé)",
      );

      // 8. Isolation société B (depuis le contexte A).
      const ctxB2 = contextFor(companyB);
      const dBB = await runWithCompanyContext(
        ctxB2,
        () =>
          createDocument(
            "QUOTATION",
            inputDoc(branchB.id, { customerId: customerB.id }),
            ctxDoc(companyB.id),
          ) as Promise<{ id: string; number: string }>,
      );
      const overviewA = await listDocumentsOverview(companyA.id);
      record(
        !overviewA.some((r) => r.id === dBB.id),
        "8 — listDocumentsOverview(A) n'inclut aucune doc de la société B",
      );

      const crossDel = await deleteDocumentsBulk(
        [{ docType: "QUOTATION" as CommercialDocType, id: dBB.id }],
        ctxDoc(companyA.id),
      );
      record(
        crossDel.deleted.length === 0 && /403|refus/i.test(crossDel.failed[0]?.reason ?? ""),
        "8 — Suppression croisée refusée (403 dans failed)",
        crossDel.failed[0]?.reason ?? "",
      );
      const crossDup = await duplicateDocumentsBulk(
        [{ docType: "QUOTATION" as CommercialDocType, id: dBB.id }],
        ctxDoc(companyA.id),
      );
      record(
        crossDup.duplicated.length === 0 && /403|refus/i.test(crossDup.failed[0]?.reason ?? ""),
        "8 — Duplication croisée refusée (403 dans failed)",
        crossDup.failed[0]?.reason ?? "",
      );
      const bDocs = await listDocumentsOverview(companyB.id);
      record(
        bDocs.some((r) => r.id === dBB.id) && bDocs[0]?.partyStatus === "active",
        "8 — La société B conserve son document (mesures bloquées par le contexte A)",
      );

      // 9. Suppression propre : lignes + DocumentApproval + DocumentRelation.
      const dR = (await createDocument("PROFORMA", inputDoc(branchA.id, { customerId: customerX.id }), ctxDoc(companyA.id))) as { id: string; number: string };
      await prismaBase.documentApproval.create({
        data: { companyId: companyA.id, docType: "PROFORMA", docId: dR.id, requestedById: "verify-documents-groups", status: "PENDING" },
      });
      await prismaBase.documentRelation.create({
        data: {
          companyId: companyA.id,
          sourceDocId: dR.id,
          sourceDocType: "PROFORMA",
          targetDocId: dR.id,
          targetDocType: "PROFORMA",
          relationType: "REFERENCE",
          createdById: "verify-documents-groups",
        },
      });
      await deleteDocument("PROFORMA", dR.id, ctxDoc(companyA.id));
      const orphanLines = await prismaBase.proformaLine.count({ where: { proformaId: dR.id } });
      const orphanApprovals = await prismaBase.documentApproval.count({ where: { docId: dR.id } });
      const orphanRelations = await prismaBase.documentRelation.count({
        where: { OR: [{ sourceDocId: dR.id }, { targetDocId: dR.id }] },
      });
      record(
        orphanLines === 0 && orphanApprovals === 0 && orphanRelations === 0,
        "9 — Suppression atomique : 0 ligne, 0 approbation, 0 relation orpheline",
        `lines=${orphanLines}, approvals=${orphanApprovals}, relations=${orphanRelations}`,
      );
    });

    // Récapitulatif.
    console.log("\n=== RÉSUMÉ ===");
    const pass = results.filter((r) => r.ok).length;
    const fail = results.filter((r) => !r.ok).length;
    console.log(`  ${pass} réussies, ${fail} échecs sur ${results.length}`);
    for (const r of results.filter((x) => !x.ok)) console.log(`  ÉCHEC : ${r.label} — ${r.detail}`);
    if (fail > 0) process.exitCode = 1;
  } finally {
    await cleanupCompany(companyA.id);
    await cleanupCompany(companyB.id);
    await prismaBase.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});