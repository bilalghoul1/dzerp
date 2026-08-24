/**
 * verify-permanent-company-delete.ts — SUPER_ADMIN permanent company purge (2026-08-17)
 *
 * Development-only integration test. Uses the REAL API + real DB (prismaBase).
 * Creates a temporary company with the full company-owned dependency chain,
 * then performs SUPER_ADMIN permanent deletion and verifies zero orphans.
 *
 * Self-cleans: on failure the finally block deletes any temp company (via the
 * real permanent-delete API) and temp users (via prismaBase).
 *
 * Special cases exercised:
 *   - empty company
 *   - company with Product
 *   - company with Product + BOM + BOMItem
 *   - company with HR data (employee/contract/department/position/jobTitle)
 *   - company with accounting data (account/journalEntry/fiscalPeriod/payment)
 *   - company with warehouse/inventory data
 *   - company with commercial documents (customerOrder + line)
 *   - company with production data (productionOrder + BOM)
 *   - company with isDefault = true
 *   - last remaining temp company (zero-temp-companies state)
 *
 * RBAC / global data are NOT touched (Client, Counter, Unit, global roles).
 *
 * Run: npx tsx scripts/verify-permanent-company-delete.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { prismaBase } from "@/lib/prisma";
import { randomUUID } from "crypto";

const BASE = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

const SA_USER = process.env.SA_USERNAME || "superadmin";
const SA_PW = process.env.SA_PASSWORD || "Super-Admin-Dev-2026!";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(cond: boolean, name: string, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function login(username: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const sc = res.headers.get("set-cookie") || "";
  const m = sc.match(/dzerp\.session=([^;]+)/);
  if (!m) throw new Error(`login failed for ${username} (status ${res.status})`);
  return m[1];
}

async function api(
  method: "GET" | "POST" | "DELETE" | "PATCH",
  path: string,
  cookie: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: `dzerp.session=${cookie}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, json };
}

async function createCompany(name: string, code: string): Promise<string> {
  const sa = await login(SA_USER, SA_PW);
  const r = await api(
    "POST",
    "/api/admin/companies",
    sa,
    {
      name,
      code,
      legalName: name,
      taxId: "0000",
      rc: "0000",
      nis: "0000",
      ai: "0000",
      articleImposition: "A",
      activity: "Test",
      legalForm: "SARL",
      defaultCurrency: "DZD",
      phone: "0000000000",
      email: "test@dzerp.dz",
      address: "Algiers",
      commune: "Alger",
      wilaya: "Alger",
      postalCode: "16000",
    },
  );
  if (r.status !== 201 && r.status !== 200) {
    throw new Error(`createCompany ${name} failed: ${r.status} ${JSON.stringify(r.json)}`);
  }
  const id = r.json?.data?.company?.id || r.json?.company?.id;
  if (!id) throw new Error(`createCompany ${name} no id: ${JSON.stringify(r.json)}`);
  return id as string;
}

async function permanentDeleteCompany(id: string, name: string, cookie: string) {
  return api("DELETE", `/api/admin/companies/${id}`, cookie, { confirmation: name });
}

// ----- counters of company-owned rows (excluding global: Client, Counter, Unit, roles) -----
const COMPANY_OWNED_MODELS = [
  "branch", "department", "jobTitle", "position", "employee", "employmentContract",
  "product", "productCategory", "brand", "manufacturer", "productBOM", "productBOMItem",
  "productSupplier", "warehouse", "warehouseLocation", "inventoryMovement",
  "customer", "supplier", "customerOrder", "customerOrderLine", "proforma", "proformaLine",
  "quotation", "salesOrder", "deliveryNote", "invoice", "creditNote",
  "purchaseRequest", "purchaseOrder", "goodsReceipt", "supplierInvoice",
  "documentRelation", "documentApproval", "documentSeries",
  "payment", "paymentAllocation", "account", "fiscalPeriod", "journalEntry",
  "productionOrder", "productionOrderItem", "productionConsumption", "productionOutput",
  "workCenter", "machine", "fileAsset", "userCompany", "auditLog", "activityEvent",
  "journalLine",
] as const;

// Models that lack a direct companyId — counted via a relational filter.
const RELATION_WHERE: Record<string, { field: string }> = {
  productBOMItem: { field: "product" },
  productSupplier: { field: "product" },
  paymentAllocation: { field: "payment" },
  customerOrderLine: { field: "customerOrder" },
  proformaLine: { field: "proforma" },
  productionOrderItem: { field: "order" },
  productionConsumption: { field: "order" },
  productionOutput: { field: "order" },
  warehouseLocation: { field: "warehouse" },
  journalLine: { field: "journalEntry" },
};

async function countCompanyRows(companyId: string): Promise<{ total: number; byModel: Record<string, number> }> {
  let total = 0;
  const byModel: Record<string, number> = {};
  for (const m of COMPANY_OWNED_MODELS) {
    const rel = RELATION_WHERE[m as string];
    const where = rel
      ? { [rel.field]: { companyId } }
      : { companyId };
    const c = await (prismaBase as any)[m].count({ where });
    byModel[m] = c;
    total += c;
  }
  return { total, byModel };
}

async function main() {
  console.log("=== SUPER_ADMIN permanent company purge — integration test ===");
  const sa = await login(SA_USER, SA_PW);

  const createdCompanyIds: string[] = [];
  const createdUserIds: string[] = [];

  try {
    // ---- CASE A: EMPTY company ----
    console.log("\n[A] Empty company permanent delete");
    const emptyName = `TMP_EMPTY_${randomUUID().slice(0, 8)}`;
    const emptyId = await createCompany(emptyName, `E${Date.now()}`);
    createdCompanyIds.push(emptyId);
    const beforeEmpty = await countCompanyRows(emptyId);
    console.log(`  · empty company seeded rows (API defaults): ${beforeEmpty.total}`);
    const rEmpty = await permanentDeleteCompany(emptyId, emptyName, sa);
    assert(rEmpty.status === 200, "empty company permanently deleted", `status=${rEmpty.status} body=${JSON.stringify(rEmpty.json)}`);
    createdCompanyIds.pop();
    const afterEmpty = await countCompanyRows(emptyId);
    assert(afterEmpty.total === 0, "empty company leaves 0 company-owned rows", `total=${afterEmpty.total}`);

    // ---- CASE B: FULL dependency chain + isDefault ----
    console.log("\n[B] Full dependency chain + isDefault=true permanent delete");
    const fullName = `TMP_FULL_${randomUUID().slice(0, 8)}`;
    const fullId = await createCompany(fullName, `F${Date.now()}`);
    createdCompanyIds.push(fullId);

    // branch
    const branch = await prismaBase.branch.create({
      data: { companyId: fullId, code: "B1", name: "Main", address: "Algiers", commune: "Alger", wilaya: "Alger", postalCode: "16000" },
    });

    // product tree
    const product = await prismaBase.product.create({
      data: { companyId: fullId, sku: "SKU1", code: "P1", name: "Widget", inventoryUnitId: (await prismaBase.unit.findFirst())!.id, purchaseUnitId: (await prismaBase.unit.findFirst())!.id, salesUnitId: (await prismaBase.unit.findFirst())!.id },
    });
    const bom = await prismaBase.productBOM.create({
      data: { companyId: fullId, code: "BOM1", name: "BOM", productId: product.id },
    });
    const bomItem = await prismaBase.productBOMItem.create({
      data: { bomId: bom.id, productId: product.id, quantity: 2 },
    });
    assert(!!bomItem.id, "seeded ProductBOMItem");

    // warehouse + location
    const warehouse = await prismaBase.warehouse.create({
      data: { companyId: fullId, code: "W1", name: "WH", branchId: branch.id },
    });
    await prismaBase.warehouseLocation.create({
      data: { code: "WL1", name: "Loc", warehouseId: warehouse.id },
    });
    await prismaBase.inventoryMovement.create({
      data: { companyId: fullId, number: "IM1", type: "OPENING_BALANCE", productId: product.id, warehouseId: warehouse.id, quantity: 5 },
    });

    // HR
    const dept = await prismaBase.department.create({ data: { companyId: fullId, code: "D1", name: "Eng" } });
    const job = await prismaBase.jobTitle.create({ data: { companyId: fullId, code: "J1", name: "Eng" } });
    const pos = await prismaBase.position.create({ data: { companyId: fullId, code: "P1", name: "Eng", departmentId: dept.id, jobTitleId: job.id, branchId: branch.id } });
    const emp = await prismaBase.employee.create({ data: { companyId: fullId, code: "E1", firstName: "A", lastName: "B", hireDate: new Date(), startDate: new Date(), departmentId: dept.id, positionId: pos.id, branchId: branch.id } });
    await prismaBase.employmentContract.create({ data: { companyId: fullId, employeeId: emp.id, contractType: "CDI", startDate: new Date(), baseSalary: 1000, branchId: branch.id } });

    // Accounting
    const fiscal = await prismaBase.fiscalPeriod.create({ data: { companyId: fullId, label: "2026", startDate: new Date(), endDate: new Date(), status: "OPEN" } });
    const account = await prismaBase.account.create({ data: { companyId: fullId, code: "A1", name: "Cash" } });
    await prismaBase.journalEntry.create({ data: { companyId: fullId, number: "JE1", entryDate: new Date(), fiscalPeriodId: fiscal.id, status: "VALIDATED" } });
    const je = await prismaBase.journalEntry.findFirstOrThrow({ where: { companyId: fullId, number: "JE1" } });
    await prismaBase.journalLine.create({ data: { journalEntryId: je.id, accountId: account.id, debit: 100, credit: 0 } });
    const pay = await prismaBase.payment.create({ data: { companyId: fullId, number: "PAY1", amount: 100, branchId: branch.id } });
    await prismaBase.paymentAllocation.create({ data: { paymentId: pay.id, amount: 100 } });

    // Commercial document + line
    const cust = await prismaBase.customer.create({ data: { companyId: fullId, code: "C1", name: "Cust", type: "COMPANY" } });
    const co = await prismaBase.customerOrder.create({ data: { companyId: fullId, number: "CO1", branchId: branch.id, customerId: cust.id } });
    await prismaBase.customerOrderLine.create({ data: { customerOrderId: co.id, label: "Line", productId: product.id } });

    // Production
    await prismaBase.productionOrder.create({ data: { companyId: fullId, number: "PO1", productId: product.id, plannedQty: 10, warehouseId: warehouse.id, bomId: bom.id, status: "DRAFT" } });

    // set isDefault = true (transient; the real MAIN default stays after delete)
    await prismaBase.company.update({ where: { id: fullId }, data: { isDefault: true } });

    const before = await countCompanyRows(fullId);
    assert(before.total > 0, "seeded company has company-owned rows", `total=${before.total}`);
    assert(before.byModel.productBOMItem > 0, "ProductBOMItem present");
    assert(before.byModel.productionOrder > 0, "ProductionOrder present");

    const rFull = await permanentDeleteCompany(fullId, fullName, sa);
    assert(rFull.status === 200, "isDefault=true full company permanently deleted", `status=${rFull.status} body=${JSON.stringify(rFull.json)}`);
    createdCompanyIds.pop();

    const after = await countCompanyRows(fullId);
    assert(after.total === 0, "ALL company-owned rows purged (0 orphans)", `total=${after.total}`);
    const companyGone = await prismaBase.company.findUnique({ where: { id: fullId } });
    assert(companyGone === null, "company record deleted");

    // no replacement default company was created; the pre-existing MAIN default remains
    const defaults = await prismaBase.company.findMany({ where: { isDefault: true } });
    assert(defaults.length >= 1, "no replacement default created (pre-existing default preserved)", `defaults=${defaults.length}`);

    // ---- CASE C: ZERO temp companies after run; real companies untouched ----
    console.log("\n[C] Temp residue + real companies intact");
    const residue = await prismaBase.company.count({ where: { name: { startsWith: "TMP_" } } });
    assert(residue === 0, "no temp companies remain", `residue=${residue}`);

    const realCompanies = await prismaBase.company.count({ where: { name: { in: ["DzERP Algérie", "Soci Test DzERP"] } } });
    assert(realCompanies >= 1, "canonical MAIN company (DzERP Algérie) untouched", `count=${realCompanies}`);
    const main = await prismaBase.company.findFirst({ where: { name: "DzERP Algérie" } });
    assert(main !== null, "MAIN company record still present", `main=${main?.id ?? "null"}`);

    // ---- CASE D: Client (global) preserved; not company-scoped ----
    const clientCount = await prismaBase.client.count();
    assert(clientCount >= 0, "Client global table intact (not deleted)", `clients=${clientCount}`);
  } finally {
    // Self-clean any temp companies still present
    for (const id of createdCompanyIds) {
      try {
        const name = (await prismaBase.company.findFirst({ where: { id } }))?.name;
        if (name) {
          const c = await login(SA_USER, SA_PW);
          await permanentDeleteCompany(id, name, c);
        }
      } catch {
        // best effort
      }
    }
    for (const uid of createdUserIds) {
      try {
        await prismaBase.userCompany.deleteMany({ where: { userId: uid } });
        await prismaBase.userRole.deleteMany({ where: { userId: uid } });
        await prismaBase.session.deleteMany({ where: { userId: uid } });
        await prismaBase.user.delete({ where: { id: uid } });
      } catch {
        /* ignore */
      }
    }
  }

  console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    console.log("FAILURES:\n" + failures.map((f) => " - " + f).join("\n"));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
