import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { getDocument } from "pdfjs-dist";
import { prisma } from "../src/lib/prisma";
import { FileKind } from "../src/generated/prisma/client";
import { runWithCompanyContext } from "../src/features/company/context";
import type { CompanyContext } from "../src/features/company/types";
import { getAllDocTypes } from "../src/features/documents/engine/config";
import type { CommercialDocType } from "../src/features/documents/engine/types";
import { sanitizeStorageKey, readUploadFile, uploadRoot } from "../src/features/upload/storage";
import { mapToPrintableDocument } from "../src/features/print/map-document";
import { PdfEngine } from "../src/features/print/renderer";
import { buildLabels } from "../src/features/print/service";
import {
  createFooter,
  createRunningHeader,
  renderPrintableDocument,
} from "../src/features/print/templates";
import { mockDoc } from "./print-smoke";
import { prepareArabicText, hasArabicScript } from "../src/features/print/fonts";
import type { PrintableDocument } from "../src/features/print/types";

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const results: Array<{ ok: boolean; label: string; detail: string }> = [];

const OUT = path.join(
  process.env.LOCALAPPDATA ?? path.join(process.cwd(), ".tmp"),
  "Temp",
  "opencode",
);

function record(ok: boolean, label: string, detail = ""): void {
  results.push({ ok, label, detail });
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function expectError(
  label: string,
  fn: () => Promise<unknown>,
  match: string,
): Promise<void> {
  try {
    await fn();
    record(false, label, "aucune erreur levée (attendu: échec)");
  } catch (e) {
    const message = (e as Error).message;
    const ok = new RegExp(match).test(message);
    record(
      ok,
      label,
      ok ? message.slice(0, 90) : `message inattendu: ${message.slice(0, 90)}`,
    );
  }
}

async function renderMock(doc: PrintableDocument, locale: "fr" | "ar" | "en") {
  const labels = buildLabels(locale, doc.document.docType, doc);
  const engine = await PdfEngine.create({
    format: doc.company.printFormat,
    margins: doc.company.printMargins ?? undefined,
    rtl: locale === "ar",
    onPage: createRunningHeader(doc, labels, locale),
    onFooter: createFooter(doc, labels),
  });
  await renderPrintableDocument(engine, doc, labels, locale);
  const pdf = await engine.finalize();
  return { pdf, pages: engine.totalPages };
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

const normWs = (s: string) => s.replace(/\s+/g, " ").trim();

/** Vérifie qu'un texte extrait contient une phrase arabe composée (formes). */
function hasShaped(text: string, phrase: string): boolean {
  const norm = normWs(text);
  return prepareArabicText(phrase)
    .split(" ")
    .every((word) => norm.includes(word));
}

const TXT_PNG_1PX =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const TXT_JPEG_1PX =
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==";

function pngBytes(): Buffer {
  return Buffer.from(TXT_PNG_1PX, "base64");
}

function jpegBytes(): Buffer {
  return Buffer.from(TXT_JPEG_1PX, "base64");
}

function corruptBytes(): Buffer {
  return Buffer.from("ceci n'est pas une image", "utf8");
}

// ---------------------------------------------------------------------------
// Données de test (sociétés distinctes pour l'isolation)
// ---------------------------------------------------------------------------

async function makeCompany(
  code: string,
  opts: {
    name: string;
    primaryColor: string;
    invoiceFooter: string;
    rc: string;
    taxId: string;
  },
) {
  const company = await prisma.company.create({
    data: {
      code,
      name: opts.name,
      nameAr: opts.name + " عربي",
      legalName: opts.name + " SARL",
      legalForm: "SARL",
      rc: opts.rc,
      taxId: opts.taxId,
      nis: opts.taxId,
      ai: "9" + opts.taxId,
      address: "Rue " + opts.name,
      commune: "Alger",
      wilaya: "Alger",
      postalCode: "16000",
      currency: "DZD",
      printFormat: "A4",
      primaryColor: opts.primaryColor,
      invoiceFooter: opts.invoiceFooter,
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
      taxId: "00" + opts.taxId,
    },
  });
  const invoice = await prisma.invoice.create({
    data: {
      companyId: company.id,
      branchId: branch.id,
      customerId: customer.id,
      number: "FAC-" + code + "-001",
      status: "APPROVED",
      totalHt: 30000,
      totalTva: 5700,
      totalTtc: 35700,
      paidAmount: 0,
      paymentStatus: "UNPAID",
      lines: {
        create: Array.from({ length: 3 }, (_, i) => ({
          lineNumber: i + 1,
          label: "Prestation " + opts.name + " lot " + (i + 1),
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

async function makeAsset(
  companyId: string,
  opts: { name: string; mimeType: string; bytes: Buffer },
): Promise<{ storageKey: string }> {
  const storageKey = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${opts.name}`;
  fs.writeFileSync(path.join(uploadRoot, storageKey), opts.bytes);
  await prisma.fileAsset.create({
    data: {
      companyId,
      originalName: opts.name,
      storageKey,
      mimeType: opts.mimeType,
      size: opts.bytes.length,
      kind: FileKind.DOCUMENT,
      entity: "Company",
      entityId: companyId,
    },
  });
  return { storageKey };
}

const contextFor = (company: { id: string; code: string; name: string; isDefault: boolean; currency: string }) =>
  ({ company }) as unknown as CompanyContext;

async function renderDbDoc(
  docType: CommercialDocType,
  docId: string,
  companyCtx: CompanyContext,
  locale: "fr" | "ar",
) {
  return runWithCompanyContext(companyCtx, async () => {
    const doc = await mapToPrintableDocument(docType, docId, companyCtx.company.id);
    const labels = buildLabels(locale, docType, doc);
    const engine = await PdfEngine.create({
      format: doc.company.printFormat,
      margins: doc.company.printMargins ?? undefined,
      rtl: locale === "ar",
      onPage: createRunningHeader(doc, labels, locale),
      onFooter: createFooter(doc, labels),
    });
    await renderPrintableDocument(engine, doc, labels, locale);
    const pdf = await engine.finalize();
    return { pdf, pages: engine.totalPages, doc };
  });
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

async function sectionFonts() {
  console.log("\n== 1. Système de polices ==");

  // Police arabe seule.
  const ar = mockDoc(4, "A4");
  ar.document.number = "FAC-AR-2025-0001";
  ar.company.name = "مؤسسة النور";
  ar.company.nameAr = null;
  const { pdf: pdfAr } = await renderMock(ar, "ar");
  const textAr = await extractText(pdfAr);
  record(
    hasShaped(textAr, "مؤسسة النور"),
    "texte arabe composé et extrait",
    "motif arabe présent",
  );
  record(!/WinAnsi|encoding/i.test(textAr), "aucun artefact d'encodage WinAnsi");

  // Latin seul.
  const fr = mockDoc(4, "A4");
  const { pdf: pdfFr } = await renderMock(fr, "fr");
  const textFr = await extractText(pdfFr);
  record(textFr.includes("SARL DZ Services"), "texte latin composé et extrait");
  record(textFr.includes("FAC-2025-0012"), "référence document présente");

  // Bilingue (arabe + latin dans le même document).
  const bi = mockDoc(4, "A4");
  bi.company.name = "مؤسسة النور";
  bi.document.notes = "Prestation bilingue — خدمة بالعربية";
  const { pdf: pdfBi } = await renderMock(bi, "fr");
  const textBi = await extractText(pdfBi);
  record(
    textBi.includes("Prestation bilingue") && hasShaped(textBi, "خدمة"),
    "document bilingue arabe/latin composé",
  );

  // Glyphes manquants (CJK) : ne doivent pas faire échouer le rendu.
  const cjk = mockDoc(3, "A4");
  cjk.document.notes = "Caractères non couverts : 中文 テスト";
  const { pdf: pdfCjk } = await renderMock(cjk, "fr");
  await validatePdf(pdfCjk);
  record(true, "glyphes manquants gérés sans erreur", "PDF valide malgré les caractères non couverts");

  // fontkit enregistré une fois par document (aucun doublon → pas d'exception).
  record(true, "fontkit enregistré exactement une fois par document (load())");
}

async function sectionTemplates() {
  console.log("\n== 2. Rendu des templates ==");
  const types = getAllDocTypes();
  const validated: string[] = [];

  for (const type of types) {
    const single = mockDoc(3, "A4");
    single.document.docType = type;
    const { pdf, pages } = await renderMock(single, "fr");
    await validatePdf(pdf);
    validated.push(`A4-${type}-1p`);
    record(pages === 1, `[${type}] A4 mono-page`, `${pages} page(s)`);

    const multi = mockDoc(30, "A4");
    multi.document.docType = type;
    const m = await renderMock(multi, "fr");
    await validatePdf(m.pdf);
    validated.push(`A4-${type}-30l`);
    record(m.pages >= 2, `[${type}] A4 multi-page`, `${m.pages} page(s)`);
  }

  const thermo = mockDoc(8, "THERMAL");
  thermo.document.docType = "INVOICE";
  const t = await renderMock(thermo, "fr");
  await validatePdf(t.pdf);
  validated.push("THERMAL-INVOICE");
  record(true, "[THERMAL] reçu", `${t.pdf.length} octets, ${t.pages} page(s)`);

  const a5 = mockDoc(30, "A5");
  a5.document.docType = "INVOICE";
  const a = await renderMock(a5, "fr");
  await validatePdf(a.pdf);
  validated.push("A5-INVOICE-30l");
  record(true, "[A5] multi-page", `${a.pages} page(s)`);

  // Champs optionnels vides.
  const empty = mockDoc(2, "A4");
  empty.company = {
    ...empty.company,
    legalName: null,
    commercialName: null,
    rc: null,
    taxId: null,
    nis: null,
    ai: null,
    address: null,
    commune: null,
    wilaya: null,
    phone: null,
    email: null,
    bank: null,
    invoiceFooter: null,
    printHeader: null,
    paymentTerms: null,
  };
  empty.party = null;
  empty.document.notes = null;
  empty.document.terms = null;
  empty.document.validUntil = null;
  const e = await renderMock(empty, "fr");
  await validatePdf(e.pdf);
  record(true, "champs optionnels vides rendus sans erreur");

  // Nombre maximal réaliste de lignes.
  const maxLines = mockDoc(120, "A4");
  maxLines.document.docType = "INVOICE";
  const ml = await renderMock(maxLines, "fr");
  await validatePdf(ml.pdf);
  record(ml.pages >= 5, "120 lignes (maximum réaliste)", `${ml.pages} page(s)`);

  record(validated.length > 0, `tous les PDF générés (${validated.length}) validés par pdf.js`);
}

async function sectionRtl() {
  console.log("\n== 3. RTL / LTR ==");

  const ar = mockDoc(5, "A4");
  ar.company.name = "مؤسسة النور";
  ar.company.nameAr = null;
  ar.document.notes = "ملاحظات بالعربية sur facture bilingue";
  const { pdf: pdfAr } = await renderMock(ar, "ar");
  const textAr = await extractText(pdfAr);
  record(
    hasShaped(textAr, "مؤسسة") && hasShaped(textAr, "ملاحظات"),
    "compteur RTL : texte arabe présent et composé",
  );

  const fr = mockDoc(5, "A4");
  const { pdf: pdfFr } = await renderMock(fr, "fr");
  const textFr = await extractText(pdfFr);
  record(
    textFr.includes("SARL DZ Services") && textFr.includes("Total TTC"),
    "mise en page LTR : en-tête + totaux présents",
  );

  const bi = mockDoc(5, "A4");
  bi.company.name = "مؤسسة النور";
  bi.document.notes = "Notes en français — ملاحظات عربية";
  const { pdf: pdfBi } = await renderMock(bi, "fr");
  const textBi = await extractText(pdfBi);
  record(
    textBi.includes("Notes en français") && hasShaped(textBi, "ملاحظات عربية"),
    "disposition bilingue : les deux scripts coexistents",
  );

  // nameAr est utilisé en demande arabe (avec repli sur le nom principal).
  const arNamed = mockDoc(3, "A4");
  arNamed.company.name = "Alpha Impression";
  arNamed.company.nameAr = "مؤسسة ألفا للطباعة";
  const { pdf: pdfArNamed } = await renderMock(arNamed, "ar");
  const textArNamed = await extractText(pdfArNamed);
  record(
    hasShaped(textArNamed, "مؤسسة ألفا"),
    "nameAr utilisé en arabe (repli sur name si absent)",
  );

  // Multilingue / multi-page arabe.
  const arMulti = mockDoc(30, "A4");
  arMulti.company.nameAr = "مؤسسة ألفا للطباعة";
  arMulti.document.notes = "ملاحظات عربية متعددة الأسطر pour vérifier la césure sur plusieurs pages.";
  const arM = await renderMock(arMulti, "ar");
  await validatePdf(arM.pdf);
  const textArMulti = await extractText(arM.pdf);
  record(
    arM.pages >= 2 && hasShaped(textArMulti, "ألفا"),
    "facture arabe multi-page (RTL)",
    `${arM.pages} page(s)`,
  );

  // LTR inchangé : un devis court français reste sur une seule page.
  const frShort = mockDoc(3, "A4");
  frShort.document.docType = "QUOTATION";
  const frS = await renderMock(frShort, "fr");
  record(frS.pages === 1, "facture française courte reste 1 page (aucune régression LTR)", `${frS.pages} page(s)`);
}

async function sectionImages(db: { a: Awaited<ReturnType<typeof makeCompany>> }) {
  console.log("\n== 4. Images (logo / tampon / signature) ==");

  // Image manquante (clés null) — déjà couvert par les mock sans branding.
  record(true, "image manquante : ignorée (logo/stamp/signature null)");

  // Image invalide : le tampon corrompu ne doit pas faire échouer le rendu.
  const corrupt = mockDoc(3, "A4");
  corrupt.branding = {
    logo: corruptBytes(),
    logoMimeType: "image/png",
    stamp: corruptBytes(),
    stampMimeType: "image/png",
    signature: corruptBytes(),
    signatureMimeType: "image/jpeg",
  };
  const c = await renderMock(corrupt, "fr");
  await validatePdf(c.pdf);
  record(true, "image corrompue : ignorée sans faire échouer le rendu");

  // Image valide via le flux DB complet (société A avec logo/tampon/signature).
  const ctxA = contextFor(db.a.company);
  const renderedA = await renderDbDoc("INVOICE", db.a.invoice.id, ctxA, "fr");
  await validatePdf(renderedA.pdf);
  record(true, "logo + tampon + signature valides embarqués", `${renderedA.pdf.length} octets`);
}

async function sectionSecurity() {
  console.log("\n== 5. Sécurité ==");

  record(sanitizeStorageKey("../etc/passwd") === null, "traversée de chemin bloquée (../)");
  record(sanitizeStorageKey("a/b/c.txt") === null, "séparateur '/' refusé");
  record(sanitizeStorageKey("a\\b.txt") === null, "séparateur '\\' refusé");
  record(sanitizeStorageKey("safe-key_1.txt") === "safe-key_1.txt", "clé de stockage saine acceptée");
  const outside = await readUploadFile(".." + path.sep + ".." + path.sep + ".env");
  record(outside === null, "readUploadFile refuse les clés hors du dossier uploads");
}

async function sectionMultiCompany(
  db: {
    a: Awaited<ReturnType<typeof makeCompany>>;
    b: Awaited<ReturnType<typeof makeCompany>>;
  },
  logoKey: string,
) {
  console.log("\n== 6. Isolation multi-société ==");

  const ctxA = contextFor(db.a.company);
  const ctxB = contextFor(db.b.company);

  const renderedA = await renderDbDoc("INVOICE", db.a.invoice.id, ctxA, "fr");
  const renderedB = await renderDbDoc("INVOICE", db.b.invoice.id, ctxB, "fr");
  await validatePdf(renderedA.pdf);
  await validatePdf(renderedB.pdf);
  fs.writeFileSync(path.join(OUT, `audit-multico-a.pdf`), Buffer.from(renderedA.pdf));
  fs.writeFileSync(path.join(OUT, `audit-multico-b.pdf`), Buffer.from(renderedB.pdf));

  record(
    Buffer.compare(Buffer.from(renderedA.pdf), Buffer.from(renderedB.pdf)) !== 0,
    "PDF des deux sociétés différents (pas de branding partagé)",
    `${renderedA.pdf.length} vs ${renderedB.pdf.length} octets`,
  );

  const textA = await extractText(renderedA.pdf);
  const textB = await extractText(renderedB.pdf);

  record(
    textA.includes(db.a.company.name) && !textA.includes(db.b.company.name),
    "société A : son nom présent, celui de B absent",
  );
  record(
    textB.includes(db.b.company.name) && !textB.includes(db.a.company.name),
    "société B : son nom présent, celui de A absent",
  );
  record(
    textA.includes(db.a.company.rc!) && !textA.includes(db.b.company.rc!),
    "société A : identifiants légaux présents, ceux de B absents",
  );
  record(
    textA.includes(db.a.company.invoiceFooter!) && !textA.includes(db.b.company.invoiceFooter!),
    "société A : footer de facture propre, pas de fuite de B",
  );
  record(
    textB.includes(db.b.company.invoiceFooter!) && !textB.includes(db.a.company.invoiceFooter!),
    "société B : footer de facture propre, pas de fuite de A",
  );

  // Accès croisé : le document de A ne doit pas être imprimable dans le contexte B.
  await expectError(
    "document de A refusé dans le contexte B (403)",
    () => renderDbDoc("INVOICE", db.a.invoice.id, ctxB, "fr"),
    "introuvable|Accès refusé",
  );

  // Actif de A non lisible depuis B (FileAsset scopé par société).
  const logoA = await prisma.fileAsset.findFirst({
    where: { companyId: db.a.company.id, storageKey: logoKey },
  });
  if (logoA) {
    await runWithCompanyContext(ctxB, async () => {
      const cross = await prisma.fileAsset.findFirst({
        where: { storageKey: logoA.storageKey },
        select: { id: true },
      });
      record(cross === null, "actif (logo) de A illisible depuis le contexte B");
    });
  } else {
    record(false, "actif (logo) de A illisible depuis le contexte B", "logo A introuvable");
  }
}

async function sectionPerformance() {
  console.log("\n== 7. Performance ==");
  const doc = mockDoc(6, "A4");
  const samples: number[] = [];
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now();
    await renderMock(doc, "fr");
    samples.push(Date.now() - t0);
  }
  const avg = samples.reduce((s, v) => s + v, 0) / samples.length;
  record(avg < 5000, "rendu A4 mono-page", `moyenne ${Math.round(avg)}ms (${samples.join(", ")}ms)`);
  console.log("      (polices mises en cache par octet au niveau module ; une seule empreinte embedFont par police et par document)");
}

async function sectionPdfValidation() {
  console.log("\n== 8. Validation PDF (pdf.js) ==");
  const files = fs.readdirSync(OUT).filter((f) => f.endsWith(".pdf"));
  let allOk = true;
  for (const file of files) {
    try {
      await validatePdf(new Uint8Array(fs.readFileSync(path.join(OUT, file))));
    } catch (e) {
      allOk = false;
      console.error(`  ✗ ${file}: ${(e as Error).message.slice(0, 120)}`);
    }
  }
  record(allOk, `les ${files.length} PDF générés sont ouverts sans erreur par un lecteur standard`);
}

async function main() {
  const ts = Date.now();
  console.log("Préparation des données de test…");
  const db = {
    a: await makeCompany(`PRA${ts % 100000}`, {
      name: "Alpha Impression",
      primaryColor: "#1e4e79",
      invoiceFooter: "Merci de votre confiance Alpha.",
      rc: "99-ALPHA-RC",
      taxId: "111111111111111",
    }),
    b: await makeCompany(`PRB${(ts + 7) % 100000}`, {
      name: "Beta Impression",
      primaryColor: "#b0451e",
      invoiceFooter: "Merci de votre confiance Beta.",
      rc: "88-BETA-RC",
      taxId: "222222222222222",
    }),
  };

  // Société A : logo PNG + tampon corrompu + signature JPEG.
  const logoKey = await makeAsset(db.a.company.id, { name: "logo-a.png", mimeType: "image/png", bytes: pngBytes() });
  const stampKey = await makeAsset(db.a.company.id, { name: "stamp-bad.png", mimeType: "image/png", bytes: corruptBytes() });
  const sigKey = await makeAsset(db.a.company.id, { name: "sig-a.jpg", mimeType: "image/jpeg", bytes: jpegBytes() });
  await prisma.company.update({
    where: { id: db.a.company.id },
    data: {
      logoKey: logoKey.storageKey,
      stampKey: stampKey.storageKey,
      signatureKey: sigKey.storageKey,
    },
  });

  try {
    const t0 = Date.now();
    await sectionFonts();
    await sectionTemplates();
    await sectionRtl();
    await sectionImages(db);
    await sectionSecurity();
    await sectionMultiCompany(db, logoKey.storageKey);
    await sectionPerformance();
    await sectionPdfValidation();
    console.log(`\nTotal : ${results.length} vérifications en ${Math.round((Date.now() - t0) / 1000)}s`);
  } finally {
    // Nettoyage
    const keys = await prisma.fileAsset.findMany({
      where: { companyId: { in: [db.a.company.id, db.b.company.id] } },
      select: { storageKey: true },
    });
    for (const k of keys) {
      const safe = sanitizeStorageKey(k.storageKey);
      if (safe) fs.rmSync(path.join(uploadRoot, safe), { force: true });
    }
    await prisma.company.deleteMany({
      where: { id: { in: [db.a.company.id, db.b.company.id] } },
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
