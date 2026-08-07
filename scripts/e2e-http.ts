import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { createHmac } from "node:crypto";
import { getDocument } from "pdfjs-dist";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { SESSION_COOKIE, COMPANY_COOKIE, SESSION_TTL_SECONDS } from "../src/lib/constants";
import { sanitizeStorageKey, uploadRoot } from "../src/features/upload/storage";
import { shapeArabicForRender } from "../src/features/print/fonts";

const PORT = Number(process.env.E2E_PORT ?? 3199);
const BASE = `http://127.0.0.1:${PORT}`;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const TXT_PNG_1PX =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const results: Array<{ ok: boolean; label: string; detail: string }> = [];

function record(ok: boolean, label: string, detail = ""): void {
  results.push({ ok, label, detail });
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function signSession(sid: string, uid: string, secret: string): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const data = Buffer.from(JSON.stringify({ sid, uid, exp }), "utf8").toString("base64url");
  const mac = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${mac}`;
}

async function validatePdf(bytes: Uint8Array): Promise<number> {
  const doc = await getDocument({ data: new Uint8Array(bytes) }).promise;
  let pages = 0;
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    await page.getOperatorList();
    pages += 1;
  }
  await doc.destroy();
  return pages;
}

async function extractText(bytes: Uint8Array): Promise<string> {
  const doc = await getDocument({ data: new Uint8Array(bytes) }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    for (const item of content.items) parts.push((item as { str: string }).str);
  }
  await doc.destroy();
  return parts.join(" ");
}

const normWs = (s: string) => s.replace(/\s+/g, " ").trim();

function hasShaped(text: string, phrase: string): boolean {
  const norm = normWs(text);
  return shapeArabicForRender(phrase)
    .split(" ")
    .map((w) => w.trim())
    .filter(Boolean)
    .every((word) => norm.includes(word));
}

// ---------------------------------------------------------------------------
// Données de test
// ---------------------------------------------------------------------------

const ARABIC_NAME = "مؤسسة الاختبار";

async function makeCompany(code: string, opts: { name: string }) {
  const company = await prisma.company.create({
    data: {
      code,
      name: ARABIC_NAME,
      nameAr: ARABIC_NAME,
      legalName: opts.name + " SARL",
      legalForm: "SARL",
      rc: "42-E2E-RC",
      taxId: "999999999999999",
      nis: "999999999999999",
      ai: "999999999999999",
      address: "Rue E2E",
      commune: "Alger",
      wilaya: "Alger",
      postalCode: "16000",
      currency: "DZD",
      printFormat: "A4",
      primaryColor: "#1e4e79",
      invoiceFooter: "Merci de votre confiance E2E.",
      paymentTerms: "Paiement à réception.",
    },
  });
  const branch = await prisma.branch.create({
    data: {
      companyId: company.id,
      code: "BR-" + code,
      name: "Succursale " + opts.name,
      address: "Av. Centrale",
    },
  });
  const customer = await prisma.customer.create({
    data: {
      companyId: company.id,
      code: "CU-" + code,
      name: "Client " + opts.name,
      taxId: "00" + code,
    },
  });
  const invoice = await prisma.invoice.create({
    data: {
      companyId: company.id,
      branchId: branch.id,
      customerId: customer.id,
      number: "FAC-E2E-" + code + "-001",
      status: "APPROVED",
      totalHt: 30000,
      totalTva: 5700,
      totalTtc: 35700,
      paidAmount: 0,
      paymentStatus: "UNPAID",
      lines: {
        create: Array.from({ length: 3 }, (_, i) => ({
          lineNumber: i + 1,
          label: "Prestation E2E lot " + (i + 1),
          quantity: 1,
          unitPrice: 10000,
          discountPct: 0,
          taxPct: 19,
          amountHt: 10000,
          amountTva: 1900,
          amountTtc: 11900,
          kind: "PRODUCT" as const,
        })),
      },
    },
    include: { lines: true },
  });
  return { company, branch, customer, invoice };
}

async function makeLogo(companyId: string) {
  const storageKey = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-logo.png`;
  fs.writeFileSync(path.join(uploadRoot, storageKey), Buffer.from(TXT_PNG_1PX, "base64"));
  await prisma.fileAsset.create({
    data: {
      companyId,
      originalName: "logo.png",
      storageKey,
      mimeType: "image/png",
      size: Buffer.from(TXT_PNG_1PX, "base64").length,
      kind: "DOCUMENT",
      entity: "Company",
      entityId: companyId,
    },
  });
  await prisma.company.update({ where: { id: companyId }, data: { logoKey: storageKey } });
  return storageKey;
}

async function makeUser(username: string) {
  return prisma.user.create({
    data: {
      username,
      email: username + "@e2e.test",
      passwordHash: "e2e-not-used",
      status: "ACTIVE",
    },
  });
}

async function grantPermission(user: { id: string }, companyId: string, keys: string[]) {
  const role = await prisma.role.create({
    data: { key: `e2e-role-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: "E2E role", isSystem: false },
  });
  for (const key of keys) {
    const perm = await prisma.permission.upsert({
      where: { key },
      create: { key, module: "documents", name: key },
      update: {},
    });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
      create: { roleId: role.id, permissionId: perm.id },
      update: {},
    });
  }
  const uc = await prisma.userCompany.create({
    data: { userId: user.id, companyId, active: true, isDefault: true },
  });
  await prisma.roleAssignment.create({
    data: { userCompanyId: uc.id, roleId: role.id, active: true },
  });
  return role;
}

async function mintSession(user: { id: string }, activeCompanyId: string) {
  const session = await prisma.session.create({
    data: {
      token: `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
      activeCompanyId,
    },
  });
  const secret = process.env.SESSION_SECRET!;
  return signSession(session.id, user.id, secret);
}

// ---------------------------------------------------------------------------
// Serveur
// ---------------------------------------------------------------------------

async function startServer(): Promise<ChildProcess & { logs: string[] }> {
  const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "start", "-p", String(PORT)], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const logs: string[] = [];
  child.stdout?.on("data", (d) => logs.push(String(d)));
  child.stderr?.on("data", (d) => logs.push(String(d)));
  (child as ChildProcess & { logs: string[] }).logs = logs;
  return child as ChildProcess & { logs: string[] };
}

async function waitReady(child: ChildProcess & { logs: string[] }, timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error("Le serveur s'est arrêté prématurément.\n" + child.logs.slice(-15).join(""));
    }
    try {
      const res = await fetch(`${BASE}/api/auth/sessions`);
      if (res.status === 401 || res.status === 200) return;
    } catch {
      // pas encore prêt
    }
    await sleep(500);
  }
  throw new Error("Serveur non prêt dans le délai imparti.\n" + child.logs.slice(-15).join(""));
}

async function get(pathAndQuery: string, cookies: string | null) {
  const headers: Record<string, string> = {};
  if (cookies) headers.Cookie = cookies;
  return fetch(`${BASE}${pathAndQuery}`, { headers, redirect: "manual" });
}

// ---------------------------------------------------------------------------
// Cas de test
// ---------------------------------------------------------------------------

async function runHttpTests(ctx: {
  docA: { id: string };
  cookieA: string;
  cookieB: string;
  cookieC: string;
}) {
  // 1. Aperçu inline (FR), utilisateur autorisé.
  const p1 = await get(`/api/documents/${ctx.docA.id}/preview?type=invoice&locale=fr`, ctx.cookieA);
  const p1Bytes = new Uint8Array(await p1.arrayBuffer());
  const p1Text = await extractText(p1Bytes);
  record(p1.status === 200, "prévisualisation FR → HTTP 200", `status ${p1.status}`);
  record(p1.headers.get("content-type")?.startsWith("application/pdf") ?? false, "prévisualisation → Content-Type application/pdf");
  record(
    (p1.headers.get("content-disposition") ?? "").includes("inline"),
    "prévisualisation → Content-Disposition inline",
  );
  const p1Pages = await validatePdf(p1Bytes);
  record(p1Pages >= 1, "prévisualisation → PDF valide (pdf.js)", `${p1Pages} page(s)`);
  record(p1Text.includes("FAC-E2E"), "prévisualisation → numéro du document présent");
  record(p1Text.includes("confiance E2E"), "prévisualisation → pied de page société présent");

  // 2. Aperçu arabe : contenu arabe composé dans le PDF.
  const p2 = await get(`/api/documents/${ctx.docA.id}/preview?type=invoice&locale=ar`, ctx.cookieA);
  const p2Bytes = new Uint8Array(await p2.arrayBuffer());
  const p2Text = await extractText(p2Bytes);
  const arabicRe = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  record(p2.status === 200 && arabicRe.test(p2Text), "aperçu AR → contenu arabe dans le PDF");
  record(hasShaped(p2Text, "مؤسسة الاختبار"), "aperçu AR → forme arabe composée extraite");

  // 3. Résolution auto du type (sans ?type=).
  const p3 = await get(`/api/documents/${ctx.docA.id}/preview?locale=fr`, ctx.cookieA);
  record(p3.status === 200, "résolution automatique du type (sans ?type=)", `status ${p3.status}`);

  // 4. Téléchargement.
  const d1 = await get(`/api/documents/${ctx.docA.id}/pdf?type=invoice&locale=fr`, ctx.cookieA);
  const d1Bytes = new Uint8Array(await d1.arrayBuffer());
  record(d1.status === 200, "téléchargement → HTTP 200", `status ${d1.status}`);
  record((d1.headers.get("content-disposition") ?? "").includes("attachment"), "téléchargement → Content-Disposition attachment");
  record((await validatePdf(d1Bytes)) >= 1, "téléchargement → PDF valide");

  // 5. Non authentifié → 401.
  const u1 = await get(`/api/documents/${ctx.docA.id}/preview?type=invoice&locale=fr`, null);
  record(u1.status === 401, "non authentifié → 401", `status ${u1.status}`);

  // 6. Societe B accédant au document de A → refus (hors société).
  const x1 = await get(`/api/documents/${ctx.docA.id}/pdf?type=invoice&locale=fr`, ctx.cookieB);
  record(x1.status === 404 || x1.status === 403, "autre société → document refusé", `status ${x1.status}`);

  // 7. Utilisateur membre de A sans permission documents.read → 403.
  const x2 = await get(`/api/documents/${ctx.docA.id}/preview?type=invoice&locale=fr`, ctx.cookieC);
  record(x2.status === 403, "membre sans permission → 403", `status ${x2.status}`);
}

// ---------------------------------------------------------------------------

async function main() {
  const ts = Date.now();
  const codeA = `E2E${ts % 100000}`;
  const codeB = `E2X${(ts + 7) % 100000}`;

  console.log("Préparation des données de test…");
  const a = await makeCompany(codeA, { name: "E2E Impression" });
  const b = await makeCompany(codeB, { name: "E2E Beta" });
  await makeLogo(a.company.id);

  const userA = await makeUser("e2e-" + codeA);
  const userB = await makeUser("e2e-" + codeB);
  const userC = await makeUser("e2e-noperm-" + codeA);
  await grantPermission(userA, a.company.id, ["documents.read"]);
  await grantPermission(userB, b.company.id, ["documents.read"]);
  await grantPermission(userC, a.company.id, []);

  const cookieA = await mintSession(userA, a.company.id);
  const cookieB = await mintSession(userB, b.company.id);
  const cookieC = await mintSession(userC, a.company.id);

  const cookieAHeader = `${SESSION_COOKIE}=${cookieA}; ${COMPANY_COOKIE}=${a.company.id}`;
  const cookieBHeader = `${SESSION_COOKIE}=${cookieB}; ${COMPANY_COOKIE}=${b.company.id}`;
  const cookieCHeader = `${SESSION_COOKIE}=${cookieC}; ${COMPANY_COOKIE}=${a.company.id}`;

  const child = await startServer();
  try {
    console.log(`Démarrage du serveur sur ${BASE}…`);
    await waitReady(child);
    console.log("Serveur prêt.\n");

    const t0 = Date.now();
    await runHttpTests({
      docA: a.invoice,
      cookieA: cookieAHeader,
      cookieB: cookieBHeader,
      cookieC: cookieCHeader,
    });
    console.log(`\nTotal : ${results.length} vérifications en ${Math.round((Date.now() - t0) / 1000)}s`);
  } finally {
    child.kill();
    if (child.exitCode === null) {
      await Promise.race([
        new Promise<void>((resolve) => child.once("exit", () => resolve())),
        sleep(5000),
      ]);
    }

    const users = [userA.id, userB.id, userC.id];
    await prisma.session.deleteMany({ where: { userId: { in: users } } });
    await prisma.userCompany.deleteMany({ where: { userId: { in: users } } });
    const roles = await prisma.role.findMany({
      where: { assignments: { some: { userCompany: { userId: { in: users } } } } },
      select: { id: true },
    });
    const roleIds = roles.map((r) => r.id);
    await prisma.rolePermission.deleteMany({ where: { roleId: { in: roleIds } } });
    await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });

    const keys = await prisma.fileAsset.findMany({
      where: { companyId: { in: [a.company.id, b.company.id] } },
      select: { storageKey: true },
    });
    for (const k of keys) {
      const safe = sanitizeStorageKey(k.storageKey);
      if (safe) fs.rmSync(path.join(uploadRoot, safe), { force: true });
    }
    await prisma.company.deleteMany({
      where: { id: { in: [a.company.id, b.company.id] } },
    });
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.log(`\nÉCHEC : ${failed.length} vérification(s) en erreur.`);
    process.exitCode = 1;
  } else {
    console.log(`\nOK : ${results.length} vérifications passent.`);
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
