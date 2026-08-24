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
  computeAllLines,
  getValidTransitions,
  getDocConfig,
} from "../src/features/documents/engine";
import { assertAllowedConversion } from "../src/features/documents/engine/config";
import { nextDocumentNumber } from "../src/features/documents/series";

// PHASE 7.3 — BON DE COMMANDE CLIENT (SALES_ORDER) : vérification de bout en bout.
//  - Tests service (aucun serveur requis) : calculs serveur, numérotation CAS,
//    conversions autorisées, libellés arabes des séries.
//  - Tests HTTP (serveur dev :3000 requis) : auth, rôles, workflow complet
//    DRAFT→…→CONFIRMED, conversion → livraison, tampering des totaux,
//    isolation multi-société, PDF, pages de navigation.
//  - Crée des données temporaires puis les SUPPRIME entièrement.

const BASE = "http://127.0.0.1:3000";
const secret = process.env.SESSION_SECRET!;

const PREFIX = `ph73_${Date.now()}`;
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

    // Acteur MAIN : rôle MANAGER (tous documents.*). Repli : tout rôle avec convert.
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

    // Acteur DIF (isolation) : utilisateur TEMPORAIRE dédié au script, avec un
    // rôle documents.* (lecture + conversion), supprimé intégralement au
    // nettoyage. Aucun membre DIF existant ne porte documents.* — l'isolation
    // testée doit l'être avec un acteur QUI A le droit, pour prouver le
    // cloisonnement par société et non un simple refus RBAC.
    const difPermIds = await prisma.permission.findMany({
      where: { key: { in: ["documents.read", "documents.convert"] } },
      select: { id: true, key: true },
    });
    if (difPermIds.length !== 2) throw new Error("Permissions documents.read/convert introuvables.");
    const difRole = await prisma.role.create({
      data: {
        key: `${PREFIX}-DIFROLE`,
        name: `PH73 DIF ${PREFIX}`,
        isSystem: false,
        permissions: {
          create: difPermIds.map((p) => ({ permissionId: p.id })),
        },
      },
    });
    const difUser = await prisma.user.create({
      data: {
        username: `${PREFIX}-dif`,
        email: `${PREFIX}-dif@dzerp.dz`,
        passwordHash: reader.passwordHash,
        fullName: "PH73 DIF",
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
      data: {
        code: `${PREFIX}-C`,
        name: `PH73 DIF ${PREFIX}`,
        type: "COMPANY",
        companyId: difCompany.id,
      },
    });
    tempDif = { roleId: difRole.id, userId: difUser.id, membershipId: difMembership.id, customerId: difCustomer.id };

    const mainCustomer = await prisma.customer.findFirstOrThrow({ where: { companyId: mainCompany.id } });
    const mainBranch = await prisma.branch.findFirstOrThrow({ where: { companyId: mainCompany.id } });
    const mainProduct = await prisma.product.findFirstOrThrow({ where: { companyId: mainCompany.id } });

    const lines = [
      { kind: "PRODUCT" as const, productId: mainProduct.id, label: `${PREFIX} ligne 1`, unit: "u", quantity: 2, unitPrice: 100, discountPct: 10, taxPct: 19 },
    ];
    const expectedTotals = computeAllLines(lines);

    console.log("=== A. Tests service — calculs, numérotation, conversions ===");

    // A1. Calcul serveur : 2 × 100 − 10% = 180 HT ; TVA 19 % = 34,20 ; TTC = 214,20.
    check(
      "computeAllLines — HT 180 / TVA 34.2 / TTC 214.2",
      expectedTotals.totalHt === 180 && Math.abs(expectedTotals.totalTva - 34.2) < 1e-9 && Math.abs(expectedTotals.totalTtc - 214.2) < 1e-9,
    );

    // A2. Numérotation CAS : deux appels ⇒ deux numéros distincts, préfixe BC.
    const n1 = await nextDocumentNumber("SALES_ORDER");
    const n2 = await nextDocumentNumber("SALES_ORDER");
    check("nextDocumentNumber — numéros distincts (CAS)", n1.number !== n2.number);
    const cfg = getDocConfig("SALES_ORDER");
    check("nextDocumentNumber — préfixe " + cfg.numberPrefix, n1.number.startsWith(cfg.numberPrefix) && n2.number.startsWith(cfg.numberPrefix));

    // A3. Conversions autorisées.
    assertAllowedConversion("QUOTATION", "SALES_ORDER");
    check("assertAllowedConversion — QUOTATION→SALES_ORDER autorisée", true);
    assertAllowedConversion("SALES_ORDER", "DELIVERY_NOTE");
    check("assertAllowedConversion — SALES_ORDER→DELIVERY_NOTE autorisée", true);
    let rejected = false;
    try {
      assertAllowedConversion("SALES_ORDER", "PURCHASE_ORDER");
    } catch {
      rejected = true;
    }
    check("assertAllowedConversion — SALES_ORDER→PURCHASE_ORDER refusée", rejected);

    // A4. Transitions DRAFT d'une commande client.
    const draftTransitions = getValidTransitions("DRAFT", "SALES_ORDER");
    const targets = draftTransitions.map((t) => t.to);
    check(
      "getValidTransitions — DRAFT → [PENDING_APPROVAL, CANCELLED]",
      targets.includes("PENDING_APPROVAL") && targets.includes("CANCELLED") && targets.length === 2,
    );

    // A5. Libellé arabe des séries (fix de données appliqué).
    const series = await prisma.documentSeries.findFirstOrThrow({ where: { docType: "SALES_ORDER", isActive: true } });
    check("DocumentSeries SALES_ORDER — labelAr « أمر بيع »", series.labelAr === "أمر بيع");

    console.log("=== B. Tests HTTP — serveur dev :3000 ===");

    // B1. Non authentifié → 401.
    await expectStatus("B1 — /api/documents non authentifié → 401", 401, () =>
      fetch(`${BASE}/api/documents?type=SALES_ORDER`),
    );

    const actor = await makeCookie(actorMainId, mainCompany.id);
    sessionIds.push(actor.sessionId);

    // B2. Création (tampering des totaux) : les totaux sont recalculés côté serveur.
    const createRes = await expectStatus("B2 — création commande client → 2xx", 201, () =>
      fetch(`${BASE}/api/documents?type=SALES_ORDER`, {
        method: "POST",
        headers: { Cookie: actor.cookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: mainBranch.id,
          customerId: mainCustomer.id,
          currency: "DZD",
          notes: "PHASE 7.3 — vérification",
          totalHt: 1,
          totalTva: 2,
          totalTtc: 999999,
          lines,
        }),
      }),
    );
    const created = (await jsonBody(createRes)).data as Record<string, unknown>;
    const soId = track(created.id as string) ?? "";
    const soNumber = created.number as string;
    check("B2 — numéro commence par BC", typeof soNumber === "string" && soNumber.startsWith("BC"));
    check(
      "B2 — totaux recalculés (TTC 214.20, pas 999999)",
      Number(created.totalHt) === expectedTotals.totalHt &&
        Number(created.totalTtc) === expectedTotals.totalTtc &&
        Number(created.totalTtc) !== 999999,
    );
    check("B2 — statut initial DRAFT", created.status === "DRAFT");

    // B3. Détail (lecture par l'acteur) : bon client / succursale.
    const detailRes = await expectStatus("B3 — GET détail → 200", 200, () =>
      fetch(`${BASE}/api/documents/${soId}?type=SALES_ORDER`, { headers: { Cookie: actor.cookie } }),
    );
    const detail = (await jsonBody(detailRes)).data as Record<string, unknown>;
    check("B3 — client correct", (detail.customer as { name?: string })?.name === mainCustomer.name);

    // B4. Deux créations ⇒ numéros différents (série).
    const createRes2 = await fetch(`${BASE}/api/documents?type=SALES_ORDER`, {
      method: "POST",
      headers: { Cookie: actor.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ branchId: mainBranch.id, customerId: mainCustomer.id, currency: "DZD", lines }),
    });
    const created2 = (await jsonBody(createRes2)).data as Record<string, unknown>;
    track(created2.id as string);
    check("B4 — numéros distincts sur deux créations", created2.number !== soNumber);

    // B5. Soumission → PENDING_APPROVAL (documents.update).
    const subRes = await expectStatus("B5 — soumission → 200", 200, () =>
      fetch(`${BASE}/api/documents/${soId}/status?type=SALES_ORDER`, {
        method: "PATCH",
        headers: { Cookie: actor.cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus: "PENDING_APPROVAL" }),
      }),
    );
    void subRes;

    // B6. Approbation (?action=approve → documents.approve).
    await expectStatus("B6 — approbation → 200", 200, () =>
      fetch(`${BASE}/api/documents/${soId}/status?type=SALES_ORDER&action=approve`, {
        method: "PATCH",
        headers: { Cookie: actor.cookie },
      }),
    );

    // B7. Confirmation → CONFIRMED.
    await expectStatus("B7 — confirmation → 200", 200, () =>
      fetch(`${BASE}/api/documents/${soId}/status?type=SALES_ORDER`, {
        method: "PATCH",
        headers: { Cookie: actor.cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus: "CONFIRMED" }),
      }),
    );

    // B8. Transition invalide depuis CONFIRMED → 422.
    const badTransition = await fetch(`${BASE}/api/documents/${soId}/status?type=SALES_ORDER`, {
      method: "PATCH",
      headers: { Cookie: actor.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ targetStatus: "PENDING_APPROVAL" }),
    });
    const badBody = await jsonBody(badTransition);
    check(
      "B8 — transition invalide → 422 INVALID_STATUS_TRANSITION",
      badTransition.status === 422 && badBody.error?.code === "INVALID_STATUS_TRANSITION",
    );

    // B9. Transitions autorisées actuelles (GET /status).
    const transitionsRes = await fetch(`${BASE}/api/documents/${soId}/status?type=SALES_ORDER`, {
      headers: { Cookie: actor.cookie },
    });
    const transitionsBody = await jsonBody(transitionsRes);
    check(
      "B9 — GET /status expose les transitions de CONFIRMED",
      transitionsRes.status === 200 &&
        Array.isArray((transitionsBody.data as { transitions?: unknown[] })?.transitions) &&
        ((transitionsBody.data as { transitions?: string[] }).transitions ?? []).length >= 2,
    );

    // B10. Conversion commande → bon de livraison (documents.convert).
    const convRes = await expectStatus("B10 — conversion SALES_ORDER→DELIVERY_NOTE → 201", 201, () =>
      fetch(`${BASE}/api/documents/convert`, {
        method: "POST",
        headers: { Cookie: actor.cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ sourceDocType: "SALES_ORDER", sourceDocId: soId, targetDocType: "DELIVERY_NOTE" }),
      }),
    );
    const conv = (await jsonBody(convRes)).data as { relationId?: string; sourceNumber?: string };
    check("B10 — relation de conversion créée", typeof conv.relationId === "string" && conv.sourceNumber === soNumber);
    const convRelation = await prisma.documentRelation.findFirstOrThrow({
      where: { sourceDocType: "SALES_ORDER", sourceDocId: soId, targetDocType: "DELIVERY_NOTE" },
    });
    const dnId = track(convRelation.targetDocId) ?? "";
    const dnDetailRes = await fetch(`${BASE}/api/documents/${dnId}?type=DELIVERY_NOTE`, {
      headers: { Cookie: actor.cookie },
    });
    const dnDetail = (await jsonBody(dnDetailRes)).data as Record<string, unknown>;
    check("B10 — livraison créée en brouillon, même client", dnDetailRes.status === 200 && dnDetail.status === "DRAFT" && (dnDetail.customer as { name?: string })?.name === mainCustomer.name);

    // B11. PDF (documents.print) → application/pdf.
    const pdfRes = await expectStatus("B11 — PDF → 200", 200, () =>
      fetch(`${BASE}/api/documents/${soId}/pdf?type=SALES_ORDER`, { headers: { Cookie: actor.cookie } }),
    );
    check("B11 — content-type application/pdf", (pdfRes.headers.get("content-type") ?? "").includes("application/pdf"));

    // B12. Liste + recherche par numéro.
    const listRes = await fetch(`${BASE}/api/documents?type=SALES_ORDER&search=${encodeURIComponent(soNumber)}&pageSize=10`, {
      headers: { Cookie: actor.cookie },
    });
    const listBody = await jsonBody(listRes);
    const items = (listBody.data as { items?: Array<{ number: string }> })?.items ?? [];
    check("B12 — liste filtrée retrouve la commande", listRes.status === 200 && items.some((i) => i.number === soNumber));

    // B13. Pages de navigation (acteur).
    const listPage = await fetch(`${BASE}/documents/sales_order`, { headers: { Cookie: actor.cookie } });
    check("B13 — page /documents/sales_order → 200", listPage.status === 200);

    console.log("=== C. Tests RBAC — lecteur (READER @ MAIN) ===");

    const readCookie = await makeCookie(reader.id, mainCompany.id);
    sessionIds.push(readCookie.sessionId);

    await expectStatus("C1 — lecteur liste → 200", 200, () =>
      fetch(`${BASE}/api/documents?type=SALES_ORDER`, { headers: { Cookie: readCookie.cookie } }),
    );
    await expectStatus("C2 — lecteur détail → 200", 200, () =>
      fetch(`${BASE}/api/documents/${soId}?type=SALES_ORDER`, { headers: { Cookie: readCookie.cookie } }),
    );
    await expectStatus("C3 — lecteur création → 403", 403, () =>
      fetch(`${BASE}/api/documents?type=SALES_ORDER`, {
        method: "POST",
        headers: { Cookie: readCookie.cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: mainBranch.id, customerId: mainCustomer.id, currency: "DZD", lines }),
      }),
    );
    await expectStatus("C4 — lecteur transition de statut → 403", 403, () =>
      fetch(`${BASE}/api/documents/${soId}/status?type=SALES_ORDER`, {
        method: "PATCH",
        headers: { Cookie: readCookie.cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus: "PENDING_APPROVAL" }),
      }),
    );
    await expectStatus("C5 — lecteur conversion → 403", 403, () =>
      fetch(`${BASE}/api/documents/convert`, {
        method: "POST",
        headers: { Cookie: readCookie.cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ sourceDocType: "SALES_ORDER", sourceDocId: soId, targetDocType: "DELIVERY_NOTE" }),
      }),
    );
    await expectStatus("C6 — lecteur PDF → 200 (documents.print)", 200, () =>
      fetch(`${BASE}/api/documents/${soId}/pdf?type=SALES_ORDER`, { headers: { Cookie: readCookie.cookie } }),
    );
    await expectStatus("C7 — lecteur page liste → 200", 200, () =>
      fetch(`${BASE}/documents/sales_order`, { headers: { Cookie: readCookie.cookie } }),
    );
    await expectStatus("C8 — lecteur page création → 404 (pas documents.create)", 404, () =>
      fetch(`${BASE}/documents/sales_order/nouveau`, { headers: { Cookie: readCookie.cookie } }),
    );

    console.log("=== D. Isolation multi-société ===");

    // D1. Client d'une autre société → 422 (fail-closed).
    const isoRes = await fetch(`${BASE}/api/documents?type=SALES_ORDER`, {
      method: "POST",
      headers: { Cookie: actor.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ branchId: mainBranch.id, customerId: difCustomer.id, currency: "DZD", lines }),
    });
    const isoBody = await jsonBody(isoRes);
    check(
      "D1 — client DIF en contexte MAIN → 422 VALIDATION",
      isoRes.status === 422 && isoBody.error?.code === "VALIDATION",
    );

    // D2. Lecture d'une commande MAIN par un acteur DIF → 404.
    const difCookie = await makeCookie(actorDifId, difCompany.id);
    sessionIds.push(difCookie.sessionId);
    await expectStatus("D2 — acteur DIF lit commande MAIN → 404", 404, () =>
      fetch(`${BASE}/api/documents/${soId}?type=SALES_ORDER`, { headers: { Cookie: difCookie.cookie } }),
    );
    await expectStatus("D3 — acteur DIF convertit commande MAIN → 404", 404, () =>
      fetch(`${BASE}/api/documents/convert`, {
        method: "POST",
        headers: { Cookie: difCookie.cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ sourceDocType: "SALES_ORDER", sourceDocId: soId, targetDocType: "DELIVERY_NOTE" }),
      }),
    );

    console.log("=== E. Conversion devis → commande client ===");

    // E1. Créer un devis puis le convertir en commande.
    const quoRes = await fetch(`${BASE}/api/documents?type=QUOTATION`, {
      method: "POST",
      headers: { Cookie: actor.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ branchId: mainBranch.id, customerId: mainCustomer.id, currency: "DZD", lines }),
    });
    const quotation = (await jsonBody(quoRes)).data as Record<string, unknown>;
    const quoId = track(quotation.id as string) ?? "";
    check("E1 — devis créé", quoRes.status === 201 && typeof quotation.id === "string");

    const convSoRes = await fetch(`${BASE}/api/documents/convert`, {
      method: "POST",
      headers: { Cookie: actor.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ sourceDocType: "QUOTATION", sourceDocId: quoId, targetDocType: "SALES_ORDER" }),
    });
    check("E2 — devis → commande client (201)", convSoRes.status === 201);
    const convSoRelation = await prisma.documentRelation.findFirstOrThrow({
      where: { sourceDocType: "QUOTATION", sourceDocId: quoId, targetDocType: "SALES_ORDER" },
    });
    const convSoId = track(convSoRelation.targetDocId) ?? "";
    const convSoDetailRes = await fetch(`${BASE}/api/documents/${convSoId}?type=SALES_ORDER`, {
      headers: { Cookie: actor.cookie },
    });
    const convSo = (await jsonBody(convSoDetailRes)).data as Record<string, unknown>;
    check("E3 — commande issue du devis : préfixe BC + même client", typeof convSo.number === "string" && convSo.number.startsWith("BC") && (convSo.customer as { name?: string })?.name === mainCustomer.name);

    console.log(`\n=== Résultat : ${pass} ✅ / ${fail} ❌ ===`);
    if (fail > 0) process.exitCode = 1;

    } finally {
      // ------------------------------------------------------------ Nettoyage
      const allIds = createdIds.filter(Boolean);
      await prisma.documentRelation.deleteMany({
        where: { OR: [{ sourceDocId: { in: allIds } }, { targetDocId: { in: allIds } }] },
      });
      await prisma.salesOrderLine.deleteMany({ where: { salesOrderId: { in: allIds } } });
      await prisma.quotationLine.deleteMany({ where: { quotationId: { in: allIds } } });
      await prisma.deliveryNoteLine.deleteMany({ where: { deliveryNoteId: { in: allIds } } });
      await prisma.salesOrder.deleteMany({ where: { id: { in: allIds } } });
      await prisma.quotation.deleteMany({ where: { id: { in: allIds } } });
      await prisma.deliveryNote.deleteMany({ where: { id: { in: allIds } } });
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
