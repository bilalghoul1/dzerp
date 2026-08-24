import "dotenv/config";
import { createHmac } from "node:crypto";
import { existsSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma, prismaBase } from "../src/lib/prisma";
import { runUnscoped } from "../src/features/company/unscoped";
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from "../src/lib/constants";
import { uploadRoot } from "../src/features/upload/storage";

// PHASE SUPER-ADMIN — SUPPRESSION DÉFINITIVE DE SOCIÉTÉ.
//  - Tests HTTP (serveur dev :3000 requis) : autorisation (401/403/200),
//    confirmation (422/200), soft delete historique sans corps, purge complète,
//    double suppression concurrente (200/404).
//  - Tests de données : société cible entièrement purgée (documents 9 types +
//    lignes, relations, approbations, stocks, produits, branches, fichiers,
//    adhésions, rôles, audit/activité), comptes utilisateurs préservés,
//    sessions révoquées (sauf celle du SUPER_ADMIN), sociétés B/C intactes,
//    audit plateforme (companyId null), fichiers physiques supprimés.
//  - Crée des données temporaires puis les SUPPRIME entièrement.

const BASE = "http://127.0.0.1:3000";
const secret = process.env.SESSION_SECRET!;

const PREFIX = `phsup_${Date.now()}`;
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
  if (!ok) {
    console.log("    BODY:", (await res.text().catch(() => "")).slice(0, 800));
  }
  return res;
}

function signSession(sid: string, uid: string): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const data = Buffer.from(JSON.stringify({ sid, uid, exp }), "utf8").toString("base64url");
  const mac = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${mac}`;
}

async function makeCookie(userId: string, companyId: string | null): Promise<{
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
  const cookie = companyId
    ? `${SESSION_COOKIE}=${signSession(session.id, userId)}; dzerp.company=${companyId}`
    : `${SESSION_COOKIE}=${signSession(session.id, userId)}`;
  return { cookie, sessionId: session.id };
}

const DOC_MODELS: string[] = [
  "quotation",
  "salesOrder",
  "deliveryNote",
  "invoice",
  "creditNote",
  "purchaseRequest",
  "purchaseOrder",
  "goodsReceipt",
  "supplierInvoice",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function countBy(anyModel: any, model: string, companyId: string): Promise<number> {
  if (model === "productSupplier") {
    return anyModel.count({ where: { product: { companyId } } });
  }
  if (model === "roleAssignment") {
    return anyModel.count({ where: { userCompany: { companyId } } });
  }
  if (model === "warehouseLocation") {
    return anyModel.count({ where: { warehouse: { companyId } } });
  }
  return anyModel.count({ where: { companyId } });
}

async function main(): Promise<void> {
  await runUnscoped(async () => {
    const filesOnDisk: string[] = [];
    const cleanupFiles = async (): Promise<void> => {
      for (const f of filesOnDisk) {
        await rm(path.join(uploadRoot, f), { force: true }).catch(() => undefined);
      }
    };
    const touchFile = async (key: string): Promise<void> => {
      await writeFile(path.join(uploadRoot, key), "x");
      filesOnDisk.push(key);
    };

    try {
      // ------------------------------------------------------------ Données
      const superAdmin = await prisma.user.findFirst({
        where: { roles: { some: { role: { key: "SUPER_ADMIN" } } } },
      });
      if (!superAdmin) throw new Error("Aucun SUPER_ADMIN — lancez bootstrap-super-admin.ts.");
      const pwHash = superAdmin.passwordHash;
      if (!pwHash) throw new Error("Le SUPER_ADMIN n'a pas de passwordHash.");

      const companyAdminRole = await prisma.role.findFirstOrThrow({ where: { key: "COMPANY_ADMIN" } });

      const saSession = await makeCookie(superAdmin.id, null);
      const sa = saSession.cookie;

      const companyA = await prisma.company.create({
        data: { code: `${PREFIX}-A`, name: `Société Cible ${PREFIX}`, isActive: true },
      });
      const companyB = await prisma.company.create({
        data: { code: `${PREFIX}-B`, name: `Société Contrôle B ${PREFIX}`, isActive: true },
      });
      const companyC = await prisma.company.create({
        data: { code: `${PREFIX}-C`, name: `Société Contrôle C ${PREFIX}`, isActive: true },
      });
      const companyD = await prisma.company.create({
        data: { code: `${PREFIX}-D`, name: `Société Défaut ${PREFIX}`, isActive: true, isDefault: true },
      });
      const companyE = await prisma.company.create({
        data: { code: `${PREFIX}-E`, name: `Société SoftDelete ${PREFIX}`, isActive: true },
      });
      const companyF = await prisma.company.create({
        data: { code: `${PREFIX}-F`, name: `Société Concurrence ${PREFIX}`, isActive: true },
      });

      // Société A : jeu de données complet.
      const branchHq = await prisma.branch.create({
        data: { code: `${PREFIX}-HQ`, name: "Siège", type: "HEADQUARTER", companyId: companyA.id },
      });
      const branchAg = await prisma.branch.create({
        data: { code: `${PREFIX}-AG`, name: "Agence", type: "AGENCY", companyId: companyA.id },
      });
      await prisma.company.update({
        where: { id: companyA.id },
        data: { defaultBranchId: branchHq.id },
      });
      await prisma.documentSeries.create({
        data: {
          key: `${PREFIX}-INV`,
          docType: "INVOICE",
          label: `Série ${PREFIX}`,
          prefix: PREFIX,
          companyId: companyA.id,
        },
      });
      const customer = await prisma.customer.create({
        data: { code: `${PREFIX}-CUST`, name: "Client Cible", type: "COMPANY", companyId: companyA.id },
      });
      const supplier = await prisma.supplier.create({
        data: { code: `${PREFIX}-SUP`, name: "Fournisseur Cible", type: "COMPANY", companyId: companyA.id },
      });
      const brand = await prisma.brand.create({
        data: { code: `${PREFIX}-BR`, name: "Marque", companyId: companyA.id },
      });
      const manufacturer = await prisma.manufacturer.create({
        data: { code: `${PREFIX}-MF`, name: "Fabricant", companyId: companyA.id },
      });
      const category = await prisma.productCategory.create({
        data: { code: `${PREFIX}-CAT`, name: "Catégorie", companyId: companyA.id },
      });
      const product = await prisma.product.create({
        data: {
          sku: `${PREFIX}-SKU`,
          code: `${PREFIX}-PRD`,
          name: "Produit Cible",
          companyId: companyA.id,
          brandId: brand.id,
          manufacturerId: manufacturer.id,
          categoryId: category.id,
          preferredSupplierId: supplier.id,
        },
      });
      await prisma.productSupplier.create({
        data: { productId: product.id, supplierId: supplier.id, supplierSku: `${PREFIX}-SSKU` },
      });
      const warehouse = await prisma.warehouse.create({
        data: { code: `${PREFIX}-WH`, name: "Entrepôt", companyId: companyA.id, branchId: branchHq.id },
      });
      await prisma.warehouseLocation.create({
        data: { code: `${PREFIX}-LOC`, name: "Emplacement", warehouseId: warehouse.id },
      });
      await prisma.inventoryMovement.create({
        data: {
          number: `${PREFIX}-MV`,
          type: "OPENING_BALANCE",
          productId: product.id,
          warehouseId: warehouse.id,
          quantity: 10,
          companyId: companyA.id,
        },
      });

      // Les 9 types de documents + une ligne chacun (contraintes RESTRICT Branch).
      const line = {
        create: [
          { label: `Ligne ${PREFIX}`, quantity: 2, unitPrice: 100, productId: product.id },
        ],
      };
      const quotation = await prisma.quotation.create({
        data: { number: `${PREFIX}-Q`, branchId: branchHq.id, customerId: customer.id, companyId: companyA.id, lines: line },
      });
      const salesOrder = await prisma.salesOrder.create({
        data: { number: `${PREFIX}-SO`, branchId: branchHq.id, customerId: customer.id, companyId: companyA.id, quotationId: quotation.id, lines: line },
      });
      await prisma.deliveryNote.create({
        data: { number: `${PREFIX}-DN`, branchId: branchHq.id, customerId: customer.id, companyId: companyA.id, salesOrderId: salesOrder.id, lines: line },
      });
      await prisma.invoice.create({
        data: { number: `${PREFIX}-IN`, branchId: branchHq.id, customerId: customer.id, companyId: companyA.id, lines: line },
      });
      await prisma.creditNote.create({
        data: { number: `${PREFIX}-CN`, branchId: branchHq.id, customerId: customer.id, companyId: companyA.id, lines: line },
      });
      await prisma.purchaseRequest.create({
        data: { number: `${PREFIX}-PR`, branchId: branchHq.id, supplierId: supplier.id, companyId: companyA.id, lines: line },
      });
      await prisma.purchaseOrder.create({
        data: { number: `${PREFIX}-PO`, branchId: branchHq.id, supplierId: supplier.id, companyId: companyA.id, lines: line },
      });
      await prisma.goodsReceipt.create({
        data: {
          number: `${PREFIX}-GR`,
          branchId: branchHq.id,
          supplierId: supplier.id,
          companyId: companyA.id,
          purchaseOrderId: (await prisma.purchaseOrder.findFirstOrThrow({ where: { companyId: companyA.id } })).id,
          lines: line,
        },
      });
      await prisma.supplierInvoice.create({
        data: { number: `${PREFIX}-SI`, branchId: branchHq.id, supplierId: supplier.id, companyId: companyA.id, lines: line },
      });
      await prisma.documentRelation.create({
        data: {
          companyId: companyA.id,
          sourceDocId: quotation.id,
          targetDocId: salesOrder.id,
          sourceDocType: "QUOTATION",
          targetDocType: "SALES_ORDER",
          relationType: "CONVERSION",
        },
      });
      await prisma.documentApproval.create({
        data: { docType: "QUOTATION", docId: quotation.id, companyId: companyA.id, status: "APPROVED" },
      });

      // Fichiers : FileAsset + logo/stamp/signature de société (nettoyage physique).
      const fileKey = `${PREFIX}-asset.bin`;
      const logoKey = `${PREFIX}-logo.bin`;
      const stampKey = `${PREFIX}-stamp.bin`;
      const signatureKey = `${PREFIX}-signature.bin`;
      await touchFile(fileKey);
      await touchFile(logoKey);
      await touchFile(stampKey);
      await touchFile(signatureKey);
      await prisma.fileAsset.create({
        data: {
          originalName: "piece.bin",
          storageKey: fileKey,
          mimeType: "application/octet-stream",
          size: 1,
          kind: "ATTACHMENT",
          entity: "company",
          entityId: companyA.id,
          companyId: companyA.id,
        },
      });
      await prisma.company.update({
        where: { id: companyA.id },
        data: { logoKey, stampKey, signatureKey },
      });

      // Membres de A : adhésions + rôles + sessions (révocation attendue).
      const userM1 = await prisma.user.create({
        data: { username: `${PREFIX}-m1`, email: `${PREFIX}-m1@dzerp.dz`, passwordHash: pwHash, fullName: "Membre 1" },
      });
      const userM2 = await prisma.user.create({
        data: { username: `${PREFIX}-m2`, email: `${PREFIX}-m2@dzerp.dz`, passwordHash: pwHash, fullName: "Membre 2" },
      });
      const ucM1 = await prisma.userCompany.create({
        data: { userId: userM1.id, companyId: companyA.id, active: true, isDefault: true },
      });
      const ucM2 = await prisma.userCompany.create({
        data: { userId: userM2.id, companyId: companyA.id, active: true, isDefault: false },
      });
      await prisma.roleAssignment.createMany({
        data: [
          { userCompanyId: ucM1.id, roleId: companyAdminRole.id, active: true, assignedBy: superAdmin.id },
          { userCompanyId: ucM2.id, roleId: companyAdminRole.id, active: true, assignedBy: superAdmin.id },
        ],
      });
      const sessionM2 = await makeCookie(userM2.id, companyA.id);

      await prisma.auditLog.create({
        data: { action: "CREATE", entity: "Customer", entityId: customer.id, companyId: companyA.id },
      });
      await prisma.activityEvent.create({
        data: { type: "CREATE", entity: "Customer", entityId: customer.id, companyId: companyA.id, title: "Test" },
      });

      // Sociétés B et C : données de contrôle + rôles (Company Admin / Manager / Reader).
      const seedControl = async (
        company: { id: string },
        label: string,
        roles: { roleId: string; key: string }[],
      ): Promise<string> => {
        await prisma.branch.create({
          data: { code: `${PREFIX}-${label}B`, name: `Succursale ${label}`, companyId: company.id },
        });
        await prisma.customer.create({
          data: { code: `${PREFIX}-${label}CC`, name: `Client ${label}`, type: "COMPANY", companyId: company.id },
        });
        const u = await prisma.user.create({
          data: { username: `${PREFIX}-${label}u`, email: `${PREFIX}-${label}u@dzerp.dz`, passwordHash: pwHash, fullName: `User ${label}` },
        });
        const uc = await prisma.userCompany.create({
          data: { userId: u.id, companyId: company.id, active: true, isDefault: true },
        });
        await prisma.roleAssignment.createMany({
          data: roles.map((r) => ({ userCompanyId: uc.id, roleId: r.roleId, active: true, assignedBy: superAdmin.id })),
        });
        const sess = await makeCookie(u.id, company.id);
        const k = `${PREFIX}-${label}file.bin`;
        await touchFile(k);
        await prisma.fileAsset.create({
          data: {
            originalName: "piece.bin",
            storageKey: k,
            mimeType: "application/octet-stream",
            size: 1,
            kind: "ATTACHMENT",
            entity: "company",
            entityId: company.id,
            companyId: company.id,
          },
        });
        return sess.cookie;
      };
      const memberB = await seedControl(companyB, "B", [{ roleId: companyAdminRole.id, key: "COMPANY_ADMIN" }]);
      const managerB = await seedControl(companyB, "M", [{ roleId: companyAdminRole.id, key: "COMPANY_ADMIN" }]);
      const readerB = await seedControl(companyC, "R", [{ roleId: companyAdminRole.id, key: "COMPANY_ADMIN" }]);

      // ------------------------------------------------------------- Tests
      console.log(`\n[${PREFIX}] Suppression définitive de société — vérification\n`);

      // 1. Session SUPER_ADMIN valide.
      const listRes = await fetch(`${BASE}/api/admin/companies`, {
        headers: { Cookie: sa },
      });
      check("Session SUPER_ADMIN opérationnelle (GET /api/admin/companies 200)", listRes.status === 200);

      // 2. Autorisation : 401 / 403 / SUPER_ADMIN.
      await expectStatus("DELETE A sans authentification → 401", 401, () =>
        fetch(`${BASE}/api/admin/companies/${companyA.id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmation: companyA.name }),
        }),
      );
      await expectStatus("DELETE B par Company Admin → 403", 403, () =>
        fetch(`${BASE}/api/admin/companies/${companyB.id}`, {
          method: "DELETE",
          headers: { Cookie: memberB, "Content-Type": "application/json" },
          body: JSON.stringify({ confirmation: companyB.name }),
        }),
      );
      await expectStatus("DELETE B par Manager → 403", 403, () =>
        fetch(`${BASE}/api/admin/companies/${companyB.id}`, {
          method: "DELETE",
          headers: { Cookie: managerB, "Content-Type": "application/json" },
          body: JSON.stringify({ confirmation: companyB.name }),
        }),
      );
      await expectStatus("DELETE C par Reader → 403", 403, () =>
        fetch(`${BASE}/api/admin/companies/${companyC.id}`, {
          method: "DELETE",
          headers: { Cookie: readerB, "Content-Type": "application/json" },
          body: JSON.stringify({ confirmation: companyC.name }),
        }),
      );
      check(
        "403 reçu AVANT validation (aucun effet sur B/C)",
        (await prisma.company.findUnique({ where: { id: companyB.id } })) !== null &&
          (await prisma.company.findUnique({ where: { id: companyC.id } })) !== null,
      );

      // 3. Confirmation : absente / booléenne / erronée → 422.
      await expectStatus("DELETE A corps {} → 422", 422, () =>
        fetch(`${BASE}/api/admin/companies/${companyA.id}`, {
          method: "DELETE",
          headers: { Cookie: sa, "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }),
      );
      await expectStatus("DELETE A corps { confirm: true } → 422", 422, () =>
        fetch(`${BASE}/api/admin/companies/${companyA.id}`, {
          method: "DELETE",
          headers: { Cookie: sa, "Content-Type": "application/json" },
          body: JSON.stringify({ confirm: true }),
        }),
      );
      await expectStatus("DELETE A confirmation erronée → 422", 422, () =>
        fetch(`${BASE}/api/admin/companies/${companyA.id}`, {
          method: "DELETE",
          headers: { Cookie: sa, "Content-Type": "application/json" },
          body: JSON.stringify({ confirmation: "Mauvais nom" }),
        }),
      );
      check(
        "A inchangée après toutes les tentatives de validation",
        (await prisma.company.findUnique({ where: { id: companyA.id } })) !== null,
      );

      // 4. Société par défaut → 409.
      await expectStatus("DELETE D (défaut) confirmation valide → 409", 409, () =>
        fetch(`${BASE}/api/admin/companies/${companyD.id}`, {
          method: "DELETE",
          headers: { Cookie: sa, "Content-Type": "application/json" },
          body: JSON.stringify({ confirmation: companyD.name }),
        }),
      );
      check("D toujours présente", (await prisma.company.findUnique({ where: { id: companyD.id } })) !== null);

      // 5. Soft delete historique : sans corps = comportement inchangé.
      await expectStatus("DELETE A sans corps (données) → 409 COMPANY_HAS_DATA", 409, () =>
        fetch(`${BASE}/api/admin/companies/${companyA.id}`, { method: "DELETE", headers: { Cookie: sa } }),
      );
      check("A toujours présente après soft delete bloqué", (await prisma.company.findUnique({ where: { id: companyA.id } })) !== null);
      await expectStatus("DELETE E sans corps (vide) → soft delete 200", 200, () =>
        fetch(`${BASE}/api/admin/companies/${companyE.id}`, { method: "DELETE", headers: { Cookie: sa } }),
      );
      const softE = await prismaBase.company.findUnique({ where: { id: companyE.id } });
      check("E marquée en suppression logique", softE !== null && softE.deletedAt !== null);

      // 6. Purge définitive (E préalablement soft-déléguée, A complète).
      await expectStatus("DELETE E avec confirmation → purge 200", 200, () =>
        fetch(`${BASE}/api/admin/companies/${companyE.id}`, {
          method: "DELETE",
          headers: { Cookie: sa, "Content-Type": "application/json" },
          body: JSON.stringify({ confirmation: companyE.name }),
        }),
      );
      check("E entièrement purgée", (await prisma.company.findUnique({ where: { id: companyE.id } })) === null);

      await expectStatus("DELETE A avec confirmation exacte → 200", 200, () =>
        fetch(`${BASE}/api/admin/companies/${companyA.id}`, {
          method: "DELETE",
          headers: { Cookie: sa, "Content-Type": "application/json" },
          body: JSON.stringify({ confirmation: companyA.name }),
        }),
      );

      // 7. Société A : tout est purgé.
      check("A supprimée", (await prisma.company.findUnique({ where: { id: companyA.id } })) === null);
      check("Branches A purgées", (await prisma.branch.count({ where: { companyId: companyA.id } })) === 0);
      check("Branche AG A purgée", (await prisma.branch.count({ where: { id: branchAg.id } })) === 0);
      check("Séries A purgées", (await prisma.documentSeries.count({ where: { companyId: companyA.id } })) === 0);
      check("Clients A purgés", (await prisma.customer.count({ where: { companyId: companyA.id } })) === 0);
      check("Fournisseurs A purgés", (await prisma.supplier.count({ where: { companyId: companyA.id } })) === 0);
      check("Produits A purgés", (await prisma.product.count({ where: { companyId: companyA.id } })) === 0);
      check("Catégories A purgées", (await prisma.productCategory.count({ where: { companyId: companyA.id } })) === 0);
      check("Marques A purgées", (await prisma.brand.count({ where: { companyId: companyA.id } })) === 0);
      check("Fabricants A purgés", (await prisma.manufacturer.count({ where: { companyId: companyA.id } })) === 0);
      check("Entrepôts A purgés", (await prisma.warehouse.count({ where: { companyId: companyA.id } })) === 0);
      check("Emplacements A purgés", (await countBy((prisma as any).warehouseLocation, "warehouseLocation", companyA.id)) === 0); // eslint-disable-line @typescript-eslint/no-explicit-any
      check("Mouvements de stock A purgés", (await prisma.inventoryMovement.count({ where: { companyId: companyA.id } })) === 0);
      check("Relations produit/fournisseur A purgées", (await countBy((prisma as any).productSupplier, "productSupplier", companyA.id)) === 0); // eslint-disable-line @typescript-eslint/no-explicit-any
      check("Fichiers A purgés", (await prisma.fileAsset.count({ where: { companyId: companyA.id } })) === 0);
      check("Adhésions A purgées", (await prisma.userCompany.count({ where: { companyId: companyA.id } })) === 0);
      check("Attributions A purgées", (await countBy((prisma as any).roleAssignment, "roleAssignment", companyA.id)) === 0); // eslint-disable-line @typescript-eslint/no-explicit-any
      check("Audit A purgé", (await prisma.auditLog.count({ where: { companyId: companyA.id } })) === 0);
      check("Activité A purgée", (await prisma.activityEvent.count({ where: { companyId: companyA.id } })) === 0);
      check("Relations doc A purgées", (await prisma.documentRelation.count({ where: { companyId: companyA.id } })) === 0);
      check("Approbations A purgées", (await prisma.documentApproval.count({ where: { companyId: companyA.id } })) === 0);
      for (const model of DOC_MODELS) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const count = await countBy((prisma as any)[model], model, companyA.id);
        check(`Documents ${model} purgés`, count === 0);
      }
      check(
        "Lignes de documents A purgées (cascade des en-têtes)",
        (await prisma.quotationLine.count({ where: { quotation: { companyId: companyA.id } } })) === 0 &&
          (await prisma.invoiceLine.count({ where: { invoice: { companyId: companyA.id } } })) === 0 &&
          (await prisma.salesOrderLine.count({ where: { salesOrder: { companyId: companyA.id } } })) === 0,
      );

      // 8. API / pages : A introuvable.
      await expectStatus("GET API A → 404", 404, () =>
        fetch(`${BASE}/api/admin/companies/${companyA.id}`, { headers: { Cookie: sa } }),
      );
      const listAfter = await (await fetch(`${BASE}/api/admin/companies`, { headers: { Cookie: sa } })).json().catch(() => null);
      const listRows = (listAfter?.data as Array<{ id: string }> | undefined) ?? [];
      check("A absente de la liste Super Admin", !listRows.some((r) => r.id === companyA.id));
      const pageRes = await fetch(`${BASE}/admin/companies/${companyA.id}`, { headers: { Cookie: sa } });
      check("Page /admin/companies/A → 404", pageRes.status === 404);

      // 9. Comptes utilisateurs préservés (jamais supprimés).
      check("Utilisateur M1 préservé", (await prisma.user.findUnique({ where: { id: userM1.id } })) !== null);
      check("Utilisateur M2 préservé", (await prisma.user.findUnique({ where: { id: userM2.id } })) !== null);
      check("SUPER_ADMIN utilisateur préservé", (await prisma.user.findUnique({ where: { id: superAdmin.id } })) !== null);

      // 10. Sessions de A révoquées ; session SUPER_ADMIN toujours valide.
      const revokedM2 = await prisma.session.findUnique({ where: { id: sessionM2.sessionId } });
      check("Session M2 (société A) révoquée", revokedM2 !== null && revokedM2.revokedAt !== null);
      const saAfter = await fetch(`${BASE}/api/admin/companies`, { headers: { Cookie: sa } });
      check("Session SUPER_ADMIN toujours valide après purge", saAfter.status === 200);

      // 11. Sociétés B et C intactes (isolation multi-tenant).
      check("B présente", (await prisma.company.findUnique({ where: { id: companyB.id } })) !== null);
      check("C présente", (await prisma.company.findUnique({ where: { id: companyC.id } })) !== null);
      check("Branches B présentes", (await prisma.branch.count({ where: { companyId: companyB.id } })) === 2);
      check("Client C présent", (await prisma.customer.count({ where: { companyId: companyC.id } })) === 1);
      check("Membre B présent", (await prisma.userCompany.count({ where: { companyId: companyB.id } })) === 2);
      check("Attributions B présentes", (await prisma.roleAssignment.count({ where: { userCompany: { companyId: companyB.id } } })) === 2);
      check("Fichier B sur disque", existsSync(path.join(uploadRoot, `${PREFIX}-Bfile.bin`)));
      check("Fichier C sur disque", existsSync(path.join(uploadRoot, `${PREFIX}-Rfile.bin`)));
      const bUserCompanyIds = await prisma.userCompany.findMany({
        where: { companyId: companyB.id },
        select: { id: true },
      });
      const bSessions = await prisma.session.findMany({
        where: { userId: { in: (await prisma.userCompany.findMany({ where: { companyId: companyB.id }, select: { userId: true } })).map((r) => r.userId) } },
      });
      check(
        "Sessions de B NON révoquées",
        bSessions.length > 0 && bSessions.every((s) => s.revokedAt === null && s.activeCompanyId === companyB.id),
      );
      void bUserCompanyIds;

      // 12. Fichiers de A physiquement supprimés (garanti best-effort).
      check("Fichier FileAsset A supprimé du disque", !existsSync(path.join(uploadRoot, fileKey)));
      check("Fichier logo A supprimé du disque", !existsSync(path.join(uploadRoot, logoKey)));
      check("Fichier cachet A supprimé du disque", !existsSync(path.join(uploadRoot, stampKey)));
      check("Fichier signature A supprimé du disque", !existsSync(path.join(uploadRoot, signatureKey)));

      // 13. Audit plateforme (companyId null) conservé après purge.
      const auditEvent = await prisma.auditLog.findFirst({
        where: { entity: "Company", entityId: companyA.id, action: "DELETE" },
        orderBy: { createdAt: "desc" },
      });
      check("Audit plateforme de la purge conservé", auditEvent !== null && auditEvent.companyId === null);

      // 14. Double suppression concurrente → un 200, un 404, aucune corruption.
      const runBoth = await Promise.all([
        fetch(`${BASE}/api/admin/companies/${companyF.id}`, {
          method: "DELETE",
          headers: { Cookie: sa, "Content-Type": "application/json" },
          body: JSON.stringify({ confirmation: companyF.name }),
        }),
        fetch(`${BASE}/api/admin/companies/${companyF.id}`, {
          method: "DELETE",
          headers: { Cookie: sa, "Content-Type": "application/json" },
          body: JSON.stringify({ confirmation: companyF.name }),
        }),
      ]);
      const statuses = runBoth.map((r) => r.status).sort();
      check(`Double suppression F → 200 + 404 (reçu ${statuses.join(",")})`, statuses[0] === 200 && statuses[1] === 404);
      check("F purgée après course", (await prisma.company.findUnique({ where: { id: companyF.id } })) === null);

      console.log(`\nRésultat : ${pass} ✅ / ${fail} ❌`);
    } finally {
      // ----------------------------------------------------------- Nettoyage
      await runUnscoped(async () => {
        // Suppression PHYSIQUE (prismaBase : sans l'extension softDelete) pour
        // ne laisser aucune ligne résiduelle du préfixe temporaire.
        const companyRows = await prismaBase.company.findMany({
          where: { code: { startsWith: `${PREFIX}-` } },
          select: { id: true },
        });
        for (const c of companyRows) {
          await prismaBase.documentRelation.deleteMany({ where: { companyId: c.id } });
          await prismaBase.documentApproval.deleteMany({ where: { companyId: c.id } });
          await prismaBase.inventoryMovement.deleteMany({ where: { companyId: c.id } });
          await prismaBase.quotation.deleteMany({ where: { companyId: c.id } });
          await prismaBase.salesOrder.deleteMany({ where: { companyId: c.id } });
          await prismaBase.deliveryNote.deleteMany({ where: { companyId: c.id } });
          await prismaBase.invoice.deleteMany({ where: { companyId: c.id } });
          await prismaBase.creditNote.deleteMany({ where: { companyId: c.id } });
          await prismaBase.purchaseRequest.deleteMany({ where: { companyId: c.id } });
          await prismaBase.purchaseOrder.deleteMany({ where: { companyId: c.id } });
          await prismaBase.goodsReceipt.deleteMany({ where: { companyId: c.id } });
          await prismaBase.supplierInvoice.deleteMany({ where: { companyId: c.id } });
          await prismaBase.productSupplier.deleteMany({ where: { product: { companyId: c.id } } });
          await prismaBase.roleAssignment.deleteMany({ where: { userCompany: { companyId: c.id } } });
          await prismaBase.userCompany.deleteMany({ where: { companyId: c.id } });
          await prismaBase.fileAsset.deleteMany({ where: { companyId: c.id } });
          await prismaBase.documentSeries.deleteMany({ where: { companyId: c.id } });
          await prismaBase.auditLog.deleteMany({ where: { companyId: c.id } });
          await prismaBase.activityEvent.deleteMany({ where: { companyId: c.id } });
          await prismaBase.auditLog.deleteMany({ where: { entityId: c.id } });
          await prismaBase.activityEvent.deleteMany({ where: { entityId: c.id } });
          await prismaBase.warehouseLocation.deleteMany({ where: { warehouse: { companyId: c.id } } });
          await prismaBase.warehouse.deleteMany({ where: { companyId: c.id } });
          await prismaBase.branch.deleteMany({ where: { companyId: c.id } });
          await prismaBase.product.deleteMany({ where: { companyId: c.id } });
          await prismaBase.productCategory.deleteMany({ where: { companyId: c.id } });
          await prismaBase.brand.deleteMany({ where: { companyId: c.id } });
          await prismaBase.manufacturer.deleteMany({ where: { companyId: c.id } });
          await prismaBase.customer.deleteMany({ where: { companyId: c.id } });
          await prismaBase.supplier.deleteMany({ where: { companyId: c.id } });
          await prismaBase.company.deleteMany({ where: { id: c.id } });
        }
        await prismaBase.session.deleteMany({ where: { token: { startsWith: PREFIX } } });
        await prismaBase.user.deleteMany({ where: { username: { startsWith: `${PREFIX}-` } } });
        await cleanupFiles();
      });
    }

    if (fail > 0) {
      console.error(`\nÉCHEC : ${fail} test(s) en échec.`);
      process.exitCode = 1;
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
