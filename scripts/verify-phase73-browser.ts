import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { runUnscoped } from "../src/features/company/context";

// PHASE 7.3 — Vérification « navigateur » (HTTP comme un vrai client) :
//  1. Connexion réelle via /api/auth/login (identifiants du seed).
//  2. Pages de navigation sales_order (liste FR / AR, création).
//  3. Bouton « Nouvelle commande » sur la fiche client (CRM).
//  4. Série SALES_ORDER affichée dans /parametres/numbering (FR + AR).
//  5. PDF de commande client en FR et en AR (locale forcée).
//  6. Régression : pages devis (liste + création) toujours opérationnelles.
//  Nettoie uniquement la commande cliente créée ; aucune autre modification.

const BASE = "http://127.0.0.1:3000";
let pass = 0;
let fail = 0;

function check(label: string, ok: boolean): void {
  console.log(`${ok ? "  ✅" : "  ❌"} ${label}`);
  if (ok) pass++;
  else fail++;
}

async function expectStatus(label: string, expected: number, res: Response): Promise<string> {
  const text = await res.text();
  const ok = res.status === expected;
  check(`${label} — ${ok ? res.status : `${res.status} (attendu ${expected})`}`, ok);
  return text;
}

function parseCookies(res: Response): string {
  const set = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  return set.map((c) => c.split(";")[0]).join("; ");
}

async function main(): Promise<void> {
  // ------------------------------------------------------------- Connexion réelle
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "directeur.oran", password: "DzERP-Demo-2026" }),
    redirect: "manual",
  });
  const loginText = await loginRes.text();
  check("Connexion /api/auth/login → 200", loginRes.status === 200);
  if (loginRes.status !== 200) {
    console.log("   réponse :", loginText);
    return;
  }
  const cookie = parseCookies(loginRes);
  check("Cookie de session posé", cookie.length > 0);

  const withLang = (lang: string): string => `${cookie}; dzerp.lang=${lang}`;

  // ----------------------------------------------------- Pages de navigation
  const listFr = await fetch(`${BASE}/documents/sales_order`, { headers: { Cookie: cookie } });
  const listFrText = await expectStatus("Page /documents/sales_order (FR) → 200", 200, listFr);
  check("Liste FR affiche le titre « Commande »", listFrText.includes("Commande"));

  const listAr = await fetch(`${BASE}/documents/sales_order`, { headers: { Cookie: withLang("ar") } });
  const listArText = await expectStatus("Page /documents/sales_order (AR) → 200", 200, listAr);
  check("Liste AR affiche le titre « أمر بيع »", listArText.includes("أمر بيع"));

  const nouveau = await fetch(`${BASE}/documents/sales_order/nouveau`, { headers: { Cookie: cookie } });
  await expectStatus("Page /documents/sales_order/nouveau → 200", 200, nouveau);

  // ------------------------------------------------------- Bouton CRM (commande)
  const customersRes = await fetch(`${BASE}/api/customers?pageSize=5`, { headers: { Cookie: cookie } });
  const customers = (await customersRes.json()) as { data?: Array<{ id: string; name: string }> };
  const first = customers.data?.[0];
  check("Récupération d'un client via /api/customers", customersRes.status === 200 && !!first);
  if (first) {
    const custPage = await fetch(`${BASE}/crm/customers/${first.id}`, { headers: { Cookie: cookie } });
    const custText = await expectStatus(`Fiche client ${first.name} → 200`, 200, custPage);
    check("Fiche client : bouton « Nouvelle commande » présent", custText.includes("Nouvelle commande"));
  }

  // --------------------------------- Série dans le paramétrage (via lecteur @ DIF :
  // COMPANY_ADMIN → parametres.view ; la série SALES_ORDER de DIF est corrigée).
  const readerLogin = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "lecteur", password: "DzERP-Demo-2026" }),
    redirect: "manual",
  });
  check("Connexion lecteur /api/auth/login → 200", readerLogin.status === 200);
  if (readerLogin.status === 200) {
    let readerCookie = parseCookies(readerLogin);
    const difCompanyId = await runUnscoped(async () => {
      const c = await prisma.company.findFirstOrThrow({ where: { code: "DIF" } });
      return c.id;
    });
    const switchRes = await fetch(`${BASE}/api/session/company`, {
      method: "POST",
      headers: { Cookie: readerCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: difCompanyId }),
    });
    check("Lecteur → passage en société DIF (200)", switchRes.status === 200);
    const switchCookies = parseCookies(switchRes);
    readerCookie = `${switchCookies}; ${readerCookie
      .split("; ")
      .filter((c) => !c.startsWith("dzerp.company=") && !c.startsWith("dzerp.branch="))
      .join("; ")}`;
    const numberingFr = await fetch(`${BASE}/parametres/numbering`, { headers: { Cookie: readerCookie } });
    await expectStatus("Page /parametres/numbering (FR, DIF) → 200", 200, numberingFr);
    const numberingAr = await fetch(`${BASE}/parametres/numbering`, { headers: { Cookie: `${readerCookie}; dzerp.lang=ar` } });
    const numberingArText = await expectStatus("Page /parametres/numbering (AR, DIF) → 200", 200, numberingAr);
    check("Numérotation AR affiche « أمر بيع » pour la commande", numberingArText.includes("أمر بيع"));
  }

  // ---------------------------------------------------- PDF FR et AR d'une commande
  await runUnscoped(async () => {
    const company = await prisma.company.findFirstOrThrow({ where: { code: "MAIN" } });
    const customer = await prisma.customer.findFirstOrThrow({ where: { companyId: company.id } });
    const branch = await prisma.branch.findFirstOrThrow({ where: { companyId: company.id } });
    const product = await prisma.product.findFirstOrThrow({ where: { companyId: company.id } });

    const createRes = await fetch(`${BASE}/api/documents?type=SALES_ORDER`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        branchId: branch.id,
        customerId: customer.id,
        currency: "DZD",
        notes: "PHASE 7.3 — vérification navigateur",
        lines: [
          { kind: "PRODUCT", productId: product.id, label: "Vérif navigateur", unit: "u", quantity: 1, unitPrice: 50, discountPct: 0, taxPct: 19 },
        ],
      }),
    });
    const created = ((await createRes.json()).data ?? {}) as { id?: string };
    check("Création d'une commande via l'API (2xx)", createRes.status === 201 && !!created.id);
    if (!created.id) return;

    try {
      const pdfFr = await fetch(`${BASE}/api/documents/${created.id}/pdf?type=SALES_ORDER`, { headers: { Cookie: cookie } });
      check("PDF FR → 200 application/pdf", pdfFr.status === 200 && (pdfFr.headers.get("content-type") ?? "").includes("application/pdf"));
      const pdfAr = await fetch(`${BASE}/api/documents/${created.id}/pdf?type=SALES_ORDER&locale=ar`, { headers: { Cookie: cookie } });
      check("PDF AR → 200 application/pdf", pdfAr.status === 200 && (pdfAr.headers.get("content-type") ?? "").includes("application/pdf"));
    } finally {
      await prisma.salesOrderLine.deleteMany({ where: { salesOrderId: created.id } });
      await prisma.salesOrder.deleteMany({ where: { id: created.id } });
    }
  });

  // ------------------------------------------------------------ Régression devis
  const quoList = await fetch(`${BASE}/documents/quotation`, { headers: { Cookie: cookie } });
  await expectStatus("Régression : /documents/quotation → 200", 200, quoList);
  const quoNew = await fetch(`${BASE}/documents/quotation/nouveau`, { headers: { Cookie: cookie } });
  await expectStatus("Régression : /documents/quotation/nouveau → 200", 200, quoNew);

  console.log(`\n=== Résultat : ${pass} ✅ / ${fail} ❌ ===`);
  if (fail > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
