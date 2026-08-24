import "dotenv/config";
import { createHmac } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { runUnscoped } from "../src/features/company/context";
import {
  SESSION_COOKIE,
  COMPANY_COOKIE,
  SESSION_TTL_SECONDS,
} from "../src/lib/constants";
import {
  getValidTransitions,
  getDocConfig,
} from "../src/features/documents/engine";
import { assertAllowedConversion } from "../src/features/documents/engine/config";

// PHASE 7.4 — BON DE LIVRAISON (DELIVERY_NOTE) : livraisons partielles et
// multiples, suivi commandé/déjà livré/restant/à livrer.
//  - Tests service (aucun serveur requis) : conversions autorisées, transitions
//    de statut, libellé arabe « وصل التسليم », numérotation BL.
//  - Tests HTTP (serveur dev :3000 requis) : livraison partielle, livraison
//    complémentaire, sur-livraison refusée, conversion multiple, course
//    concurrente, bon manuel, RBAC, isolation, PDF.
//  - Crée des données temporaires puis les SUPPRIME entièrement.

const BASE = "http://127.0.0.1:3000";
const secret = process.env.SESSION_SECRET!;

const PREFIX = `ph74_${Date.now()}`;
let pass = 0;
let fail = 0;

function check(label: string, ok: boolean): void {
  console.log(`${ok ? "  ✅" : "  ❌"} ${label}`);
  if (ok) pass++;
  else fail++;
}

async function expectStatus(
  label: string,
  expected: number,
  fn: () => Promise<Response>,
): Promise<Response> {
  const res = await fn();
  const ok = res.status === expected;
  check(`${label} — ${ok ? res.status : `${res.status} (attendu ${expected})`}`, ok);
  return res;
}

function signSession(sid: string, uid: string): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const data = Buffer.from(JSON.stringify({ sid, uid, exp }), "utf8").toString("base64url");
  const mac = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${mac}`;
}

async function makeCookie(userId: string, companyId: string): Promise<{
  cookie: string;
  sessionId: string;
}> {
  const session = await prisma.session.create({
    data: {
      token: `${PREFIX}-${Math.random().toString(36).slice(2)}`,
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
      activeCompanyId: companyId,
    },
  });
  const cookie = [`${SESSION_COOKIE}=${signSession(session.id, userId)}`, `${COMPANY_COOKIE}=${companyId}`].join("; ");
  return { cookie, sessionId: session.id };
}

async function jsonBody(res: Response): Promise<{ data?: Record<string, unknown>; error?: { message?: string; code?: string } }> {
  return res.json().catch(() => ({}));
}

async function main(): Promise<void> {
  await runUnscoped(async () => {
    const createdIds: string[] = [];
    const sessionIds: string[] = [];
    const track = (id: string | undefined): string | undefined => {
      if (id) createdIds.push(id);
      return id;
    };
    let tempDif: { roleId: string; userId: string; membershipId: string; customerId: string } | null = null;

    try {
      // ------------------------------------------------------------------ Données
      const mainCompany = await prisma.company.findFirstOrThrow({ where: { code: "MAIN" } });
      const difCompany = await prisma.company.findFirstOrThrow({ where: { code: "DIF" } });
      const reader = await prisma.user.findUniqueOrThrow({ where: { username: "lecteur" } });

      // Acteur MAIN : rôle MANAGER (tous documents.*).
      const requiredDocs = ["documents.create", "documents.update", "documents.approve", "documents.convert", "documents.print", "documents.read"];
      const managerAssign = await prisma.roleAssignment.findFirst({
        where: { active: true, role: { key: "COMPANY_ADMIN" }, userCompany: { companyId: mainCompany.id, active: true } },
        include: { userCompany: { include: { user: true } } },
      });
      let actorMain: { id: string } | null = managerAssign?.userCompany.user ?? null;
      if (actorMain) {
        const mgrPerms = await prisma.permission.count({
          where: { key: { in: requiredDocs }, roles: { some: { role: { key: "COMPANY_ADMIN" } } } },
        });
        if (mgrPerms !== requiredDocs.length) {
          throw new Error("Le rôle COMPANY_ADMIN ne couvre pas tous les droits documents.* requis.");
        }
      }
      if (!actorMain) {
        const fallback = await prisma.userCompany.findFirst({
          where: {
            companyId: mainCompany.id,
            active: true,
            AND: requiredDocs.map((key) => ({
              roleAssignments: { some: { active: true, role: { permissions: { some: { permission: { key } } } } } },
            })),
          },
          include: { user: true },
        });
        actorMain = fallback?.user ?? null;
      }
      if (!actorMain) throw new Error("Aucun acteur MAIN avec tous les droits documents.* trouvé.");
      const actorMainId = actorMain.id;

      // Acteur DIF temporaire (isolation).
      const difPermIds = await prisma.permission.findMany({
        where: { key: { in: ["documents.read", "documents.convert"] } },
        select: { id: true, key: true },
      });
      if (difPermIds.length !== 2) throw new Error("Permissions documents.read/convert introuvables.");
      const difRole = await prisma.role.create({
        data: {
          key: `${PREFIX}-DIFROLE`,
          name: `PH74 DIF ${PREFIX}`,
          isSystem: false,
          permissions: { create: difPermIds.map((p) => ({ permissionId: p.id })) },
        },
      });
      const difUser = await prisma.user.create({
        data: {
          username: `${PREFIX}-dif`,
          email: `${PREFIX}-dif@dzerp.dz`,
          passwordHash: reader.passwordHash,
          fullName: "PH74 DIF",
        },
      });
      const difMembership = await prisma.userCompany.create({
        data: { userId: difUser.id, companyId: difCompany.id, active: true, isDefault: false },
      });
      await prisma.roleAssignment.create({
        data: { userCompanyId: difMembership.id, roleId: difRole.id, active: true, assignedBy: difUser.id },
      });
      const actorDifId = difUser.id;
      const difCustomer = await prisma.customer.create({
        data: { code: `${PREFIX}-C`, name: `PH74 DIF ${PREFIX}`, type: "COMPANY", companyId: difCompany.id },
      });
      tempDif = { roleId: difRole.id, userId: difUser.id, membershipId: difMembership.id, customerId: difCustomer.id };

      const mainCustomer = await prisma.customer.findFirstOrThrow({ where: { companyId: mainCompany.id } });
      const mainBranch = await prisma.branch.findFirstOrThrow({ where: { companyId: mainCompany.id } });
      const mainProduct = await prisma.product.findFirstOrThrow({ where: { companyId: mainCompany.id } });

      const actor = await makeCookie(actorMainId, mainCompany.id);
      sessionIds.push(actor.sessionId);

      const createSo = async (quantity: number) => {
        const res = await fetch(`${BASE}/api/documents?type=SALES_ORDER`, {
          method: "POST",
          headers: { Cookie: actor.cookie, "Content-Type": "application/json" },
          body: JSON.stringify({
            branchId: mainBranch.id,
            customerId: mainCustomer.id,
            currency: "DZD",
            lines: [
              { kind: "PRODUCT", productId: mainProduct.id, label: `${PREFIX} ligne`, unit: "u", quantity, unitPrice: 100, discountPct: 0, taxPct: 19 },
            ],
          }),
        });
        const body = await jsonBody(res);
        const doc = body.data as Record<string, unknown>;
        const soId = track(doc.id as string) ?? "";
        const soLine = (doc.lines as Array<{ id: string }>)[0];
        return { soId, soNumber: doc.number as string, soLineId: soLine?.id ?? "", res, doc };
      };

      const confirmSo = async (soId: string) => {
        await fetch(`${BASE}/api/documents/${soId}/status?type=SALES_ORDER`, {
          method: "PATCH",
          headers: { Cookie: actor.cookie, "Content-Type": "application/json" },
          body: JSON.stringify({ targetStatus: "PENDING_APPROVAL" }),
        });
        await fetch(`${BASE}/api/documents/${soId}/status?type=SALES_ORDER&action=approve`, {
          method: "PATCH",
          headers: { Cookie: actor.cookie },
        });
        await fetch(`${BASE}/api/documents/${soId}/status?type=SALES_ORDER`, {
          method: "PATCH",
          headers: { Cookie: actor.cookie, "Content-Type": "application/json" },
          body: JSON.stringify({ targetStatus: "CONFIRMED" }),
        });
      };

      const convert = async (soId: string, deliveries?: Array<{ lineId: string; quantity: number }>) => {
        return fetch(`${BASE}/api/documents/convert`, {
          method: "POST",
          headers: { Cookie: actor.cookie, "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceDocType: "SALES_ORDER",
            sourceDocId: soId,
            targetDocType: "DELIVERY_NOTE",
            ...(deliveries ? { deliveries } : {}),
          }),
        });
      };

      console.log("=== A. Tests service — conversions, transitions, série ===");

      // A1. Conversions autorisées.
      assertAllowedConversion("SALES_ORDER", "DELIVERY_NOTE");
      assertAllowedConversion("DELIVERY_NOTE", "INVOICE");
      check("A1 — SALES_ORDER→DELIVERY_NOTE et DELIVERY_NOTE→INVOICE autorisées", true);
      let rejected = false;
      try {
        assertAllowedConversion("DELIVERY_NOTE", "SALES_ORDER");
      } catch {
        rejected = true;
      }
      check("A1 — DELIVERY_NOTE→SALES_ORDER refusée", rejected);

      // A2. Transitions : CONFIRMED → [PARTIALLY_PROCESSED, PROCESSED], PARTIALLY_PROCESSED → PROCESSED.
      const confirmedT = getValidTransitions("CONFIRMED", "SALES_ORDER").map((t) => t.to);
      const partialT = getValidTransitions("PARTIALLY_PROCESSED", "SALES_ORDER").map((t) => t.to);
      check(
        "A2 — CONFIRMED expose PARTIALLY_PROCESSED et PROCESSED",
        confirmedT.includes("PARTIALLY_PROCESSED") && confirmedT.includes("PROCESSED"),
      );
      check("A2 — PARTIALLY_PROCESSED expose PROCESSED", partialT.includes("PROCESSED"));

      // A3. Libellé arabe de la série DELIVERY_NOTE (fix de données).
      const blSeries = await prisma.documentSeries.findFirstOrThrow({
        where: { companyId: mainCompany.id, docType: "DELIVERY_NOTE", isActive: true },
      });
      check("A3 — série DELIVERY_NOTE labelAr « وصل التسليم »", blSeries.labelAr === "وصل التسليم");

      // A4. Libellé moteur.
      check("A4 — config DELIVERY_NOTE labelAr « وصل التسليم »", getDocConfig("DELIVERY_NOTE").labelAr === "وصل التسليم");

      console.log("=== B. Livraisons partielles et multiples (HTTP) ===");

      // B1. Création + confirmation commande (qty 10).
      const so = await createSo(10);
      check("B1 — commande créée (BC, DRAFT)", so.res.status === 201 && so.soNumber.startsWith("BC") && so.doc.status === "DRAFT");
      await confirmSo(so.soId);
      const soDetail = await fetch(`${BASE}/api/documents/${so.soId}?type=SALES_ORDER`, { headers: { Cookie: actor.cookie } });
      const soDetailBody = await jsonBody(soDetail);
      const soLineRemainingAfterConfirm = (soDetailBody.data?.lines as Array<{ remainingQty: unknown }>)[0]?.remainingQty;
      check("B1 — ligne commande remainingQty = 10 après confirmation", Number(soLineRemainingAfterConfirm) === 10);

      // B2. Livraison partielle : 4/10.
      const conv1 = await expectStatus("B2 — livraison partielle 4/10 → 201", 201, () =>
        convert(so.soId, [{ lineId: so.soLineId, quantity: 4 }]),
      );
      const conv1Body = await jsonBody(conv1);
      check("B2 — relation de conversion créée", typeof conv1Body.data?.relationId === "string");
      const rel1 = await prisma.documentRelation.findFirstOrThrow({
        where: { sourceDocType: "SALES_ORDER", sourceDocId: so.soId, targetDocType: "DELIVERY_NOTE" },
      });
      const bl1Id = track(rel1.targetDocId) ?? "";

      // B3. Le bon de livraison est lié à la commande (salesOrderId) et porte 4 unités.
      const bl1DetailRes = await fetch(`${BASE}/api/documents/${bl1Id}?type=DELIVERY_NOTE`, { headers: { Cookie: actor.cookie } });
      const bl1Detail = (await jsonBody(bl1DetailRes)).data as Record<string, unknown>;
      const bl1Line = (bl1Detail.lines as Array<{ quantity: unknown; amountHt: unknown; amountTva: unknown; amountTtc: unknown }>)[0];
      check(
        "B3 — BL lié à la commande, quantité 4, totaux 400/76/476",
        bl1DetailRes.status === 200 &&
          bl1Detail.salesOrderId === so.soId &&
          Number(bl1Line.quantity) === 4 &&
          Number(bl1Line.amountHt) === 400 &&
          Number(bl1Line.amountTva) === 76 &&
          Number(bl1Line.amountTtc) === 476 &&
          Number(bl1Detail.totalTtc) === 476,
      );

      // B4. Commande : restant 6, statut PARTIALLY_PROCESSED.
      const soAfter1Res = await fetch(`${BASE}/api/documents/${so.soId}?type=SALES_ORDER`, { headers: { Cookie: actor.cookie } });
      const soAfter1 = (await jsonBody(soAfter1Res)).data as Record<string, unknown>;
      const remAfter1 = (soAfter1.lines as Array<{ remainingQty: unknown }>)[0]?.remainingQty;
      check("B4 — restant 6 et statut PARTIALLY_PROCESSED", soAfter1Res.status === 200 && Number(remAfter1) === 6 && soAfter1.status === "PARTIALLY_PROCESSED");

      // B5. Livraison complémentaire : le restant (6/6) → PROCESSED.
      const conv2 = await expectStatus("B5 — livraison complémentaire 6/6 → 201", 201, () => convert(so.soId));
      void conv2;
      const soAfter2Res = await fetch(`${BASE}/api/documents/${so.soId}?type=SALES_ORDER`, { headers: { Cookie: actor.cookie } });
      const soAfter2 = (await jsonBody(soAfter2Res)).data as Record<string, unknown>;
      const remAfter2 = (soAfter2.lines as Array<{ remainingQty: unknown }>)[0]?.remainingQty;
      check("B5 — restant 0 et statut PROCESSED", Number(remAfter2) === 0 && soAfter2.status === "PROCESSED");

      // B6. Troisième livraison (rien ne reste) → 422 NO_QUANTITY_TO_DELIVER.
      const conv3 = await convert(so.soId);
      const conv3Body = await jsonBody(conv3);
      check("B6 — sur-livraison refusée → 422 NO_QUANTITY_TO_DELIVER", conv3.status === 422 && conv3Body.error?.code === "NO_QUANTITY_TO_DELIVER");

      // B7. Sur-livraison (qty > restant) sur une nouvelle commande → 422 OVER_DELIVERY.
      const so2 = await createSo(5);
      await confirmSo(so2.soId);
      const convBad = await convert(so2.soId, [{ lineId: so2.soLineId, quantity: 6 }]);
      const convBadBody = await jsonBody(convBad);
      check("B7 — quantité > restant → 422 OVER_DELIVERY", convBad.status === 422 && convBadBody.error?.code === "OVER_DELIVERY");

      // B8. Ligne inconnue → 422 INVALID_DELIVERY_LINE.
      const convBadLine = await convert(so2.soId, [{ lineId: "00000000-0000-0000-0000-000000000000", quantity: 1 }]);
      const convBadLineBody = await jsonBody(convBadLine);
      check("B8 — ligne inconnue → 422 INVALID_DELIVERY_LINE", convBadLine.status === 422 && convBadLineBody.error?.code === "INVALID_DELIVERY_LINE");

      // B9. Quantités toutes nulles → 422 NO_QUANTITY_TO_DELIVER.
      const convZero = await convert(so2.soId, [{ lineId: so2.soLineId, quantity: 0 }]);
      const convZeroBody = await jsonBody(convZero);
      check("B9 — quantités nulles → 422 NO_QUANTITY_TO_DELIVER", convZero.status === 422 && convZeroBody.error?.code === "NO_QUANTITY_TO_DELIVER");

      // B10. Course concurrente : deux conversions simultanées de 6/10 → exactement 1 succès.
      const so3 = await createSo(10);
      await confirmSo(so3.soId);
      const [rA, rB] = await Promise.all([
        convert(so3.soId, [{ lineId: so3.soLineId, quantity: 6 }]),
        convert(so3.soId, [{ lineId: so3.soLineId, quantity: 6 }]),
      ]);
      const successCount = [rA.status, rB.status].filter((s) => s === 201).length;
      const soAfterRaceRes = await fetch(`${BASE}/api/documents/${so3.soId}?type=SALES_ORDER`, { headers: { Cookie: actor.cookie } });
      const soAfterRace = (await jsonBody(soAfterRaceRes)).data as Record<string, unknown>;
      const remAfterRace = (soAfterRace.lines as Array<{ remainingQty: unknown }>)[0]?.remainingQty;
      check(
        "B10 — course : 1 seul succès, restant 4 ou 6 (jamais négatif)",
        successCount === 1 && (Number(remAfterRace) === 4 || Number(remAfterRace) === 6),
      );

      // B11. Bon de livraison manuel (sans commande source) → 201.
      const manualBlRes = await expectStatus("B11 — BL manuel → 201", 201, () =>
        fetch(`${BASE}/api/documents?type=DELIVERY_NOTE`, {
          method: "POST",
          headers: { Cookie: actor.cookie, "Content-Type": "application/json" },
          body: JSON.stringify({
            branchId: mainBranch.id,
            customerId: mainCustomer.id,
            currency: "DZD",
            lines: [{ kind: "PRODUCT", productId: mainProduct.id, label: `${PREFIX} BL manuel`, unit: "u", quantity: 2, unitPrice: 100, discountPct: 0, taxPct: 19 }],
          }),
        }),
      );
      const manualBl = (await jsonBody(manualBlRes)).data as Record<string, unknown>;
      track(manualBl.id as string);
      check("B11 — BL manuel : préfixe BL, non lié à une commande", typeof manualBl.number === "string" && manualBl.number.startsWith("BL") && manualBl.salesOrderId == null);

      // B12. PDF du BL (FR + AR) → application/pdf.
      const pdfFr = await expectStatus("B12 — PDF BL FR → 200", 200, () =>
        fetch(`${BASE}/api/documents/${bl1Id}/pdf?type=DELIVERY_NOTE`, { headers: { Cookie: actor.cookie } }),
      );
      check("B12 — content-type PDF FR", (pdfFr.headers.get("content-type") ?? "").includes("application/pdf"));
      const pdfAr = await expectStatus("B12 — PDF BL AR → 200", 200, () =>
        fetch(`${BASE}/api/documents/${bl1Id}/pdf?type=DELIVERY_NOTE&locale=ar`, { headers: { Cookie: actor.cookie } }),
      );
      check("B12 — content-type PDF AR", (pdfAr.headers.get("content-type") ?? "").includes("application/pdf"));

      // B13. Conversion commande → facture : 201 puis 409 (garde « déjà converti » conservée).
      const so4 = await createSo(3);
      await confirmSo(so4.soId);
      const inv1 = await expectStatus("B13 — SO→INVOICE 1 → 201", 201, () =>
        fetch(`${BASE}/api/documents/convert`, {
          method: "POST",
          headers: { Cookie: actor.cookie, "Content-Type": "application/json" },
          body: JSON.stringify({ sourceDocType: "SALES_ORDER", sourceDocId: so4.soId, targetDocType: "INVOICE" }),
        }),
      );
      void (await jsonBody(inv1));
      const inv1Relation = await prisma.documentRelation.findFirstOrThrow({
        where: { sourceDocType: "SALES_ORDER", sourceDocId: so4.soId, targetDocType: "INVOICE" },
      });
      track(inv1Relation.targetDocId);
      const inv2Real = await fetch(`${BASE}/api/documents/convert`, {
        method: "POST",
        headers: { Cookie: actor.cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ sourceDocType: "SALES_ORDER", sourceDocId: so4.soId, targetDocType: "INVOICE" }),
      });
      const inv2RealBody = await jsonBody(inv2Real);
      check(
        "B13 — SO→INVOICE 2 → 409 ALREADY_CONVERTED",
        inv2Real.status === 409 && inv2RealBody.error?.code === "ALREADY_CONVERTED",
      );

      console.log("=== C. RBAC — lecteur (READER @ MAIN) ===");

      const readCookie = await makeCookie(reader.id, mainCompany.id);
      sessionIds.push(readCookie.sessionId);
      await expectStatus("C1 — lecteur conversion → 403", 403, () =>
        fetch(`${BASE}/api/documents/convert`, {
          method: "POST",
          headers: { Cookie: readCookie.cookie, "Content-Type": "application/json" },
          body: JSON.stringify({ sourceDocType: "SALES_ORDER", sourceDocId: so.soId, targetDocType: "DELIVERY_NOTE" }),
        }),
      );
      await expectStatus("C2 — lecteur page BL → 200", 200, () =>
        fetch(`${BASE}/documents/delivery_note`, { headers: { Cookie: readCookie.cookie } }),
      );

      console.log("=== D. Isolation multi-société ===");

      const difCookie = await makeCookie(actorDifId, difCompany.id);
      sessionIds.push(difCookie.sessionId);
      await expectStatus("D1 — acteur DIF convertit commande MAIN → 404", 404, () =>
        fetch(`${BASE}/api/documents/convert`, {
          method: "POST",
          headers: { Cookie: difCookie.cookie, "Content-Type": "application/json" },
          body: JSON.stringify({ sourceDocType: "SALES_ORDER", sourceDocId: so.soId, targetDocType: "DELIVERY_NOTE" }),
        }),
      );

      console.log(`\n=== Résultat : ${pass} ✅ / ${fail} ❌ ===`);
      if (fail > 0) process.exitCode = 1;
    } finally {
      // ------------------------------------------------------------ Nettoyage
      const allIds = createdIds.filter(Boolean);
      await prisma.documentRelation.deleteMany({
        where: { OR: [{ sourceDocId: { in: allIds } }, { targetDocId: { in: allIds } }] },
      });
      await prisma.salesOrderLine.deleteMany({ where: { salesOrderId: { in: allIds } } });
      await prisma.deliveryNoteLine.deleteMany({ where: { deliveryNoteId: { in: allIds } } });
      await prisma.salesOrder.deleteMany({ where: { id: { in: allIds } } });
      await prisma.deliveryNote.deleteMany({ where: { id: { in: allIds } } });
      await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: allIds } } });
      await prisma.invoice.deleteMany({ where: { id: { in: allIds } } });
      await prisma.session.deleteMany({ where: { id: { in: sessionIds } } });
      if (tempDif) {
        await prisma.roleAssignment.deleteMany({ where: { userCompanyId: tempDif.membershipId } });
        await prisma.userCompany.deleteMany({ where: { id: tempDif.membershipId } });
        await prisma.user.deleteMany({ where: { id: tempDif.userId } });
        await prisma.role.deleteMany({ where: { id: tempDif.roleId } });
        await prisma.customer.deleteMany({ where: { id: tempDif.customerId } });
      }
    }
  });
}

main()
  .catch(async (e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
