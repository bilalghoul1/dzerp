import fs from "node:fs";
import path from "node:path";
import { PdfEngine } from "../src/features/print/renderer";
import { buildLabels } from "../src/features/print/service";
import {
  createFooter,
  createRunningHeader,
  renderPrintableDocument,
} from "../src/features/print/templates";
import { getPrintConfig } from "../src/features/print/registry";
import type { PrintableDocument } from "../src/features/print/types";

const OUT = path.join(
  process.env.LOCALAPPDATA ?? path.join(process.cwd(), ".tmp"),
  "Temp",
  "opencode",
);

function mockDoc(lines: number, format: "A4" | "A5" | "THERMAL" = "A4"): PrintableDocument {
  return {
    company: {
      name: "SARL DZ Services",
      nameAr: "مؤسسة دي زد للخدمات",
      activity: "Services informatiques et conseil",
      legalName: "DZ Services Sarl",
      legalForm: "SARL",
      commercialName: null,
      rc: "16/00-0123456B00",
      taxId: "000016012345678",
      nis: "000016012345678",
      ai: "1601123456789",
      vatNumber: null,
      address: "12 Rue des Frères Bouadou",
      commune: "Bir Mourad Raïs",
      wilaya: "Alger",
      postalCode: "16000",
      country: "Algérie",
      phone: "+213 21 00 00 00",
      mobile: "+213 555 00 00 00",
      email: "contact@dzservices.dz",
      website: "www.dzservices.dz",
      bank: "BNA",
      bankAgency: "Alger Centre",
      bankAccount: "001 12345 678901234567 89",
      rib: "002 12345 678901234567 89",
      iban: "DZ00 0021 1234 5678 9012 3456 7890",
      swift: "BNADZDZ",
      capital: "1 000 000 DA",
      currency: "DZD",
      printFormat: format,
      printMargins: null,
      printHeader: "Document commercial établi conformément à la réglementation en vigueur.",
      invoiceFooter: "Merci de votre confiance.",
      paymentTerms: "Paiement à réception de facture.",
      qrEnabled: false,
      primaryColor: "#1e4e79",
    },
    branch: {
      name: "Agence Alger Centre",
      code: "AG-01",
      address: "5 Bd Zighout Youcef",
      commune: "Alger Centre",
      wilaya: "Alger",
      postalCode: "16000",
      phone: "+213 21 11 11 11",
      email: "agence@dzservices.dz",
      manager: "M. Karim Benali",
    },
    party: {
      name: "ETB MOHAMED HADDAD",
      code: "CL-0042",
      legalName: null,
      commercialName: null,
      rc: "19/00-0456789C00",
      taxId: "000019045678987",
      nis: "000019045678987",
      ai: "1901123456789",
      vatNumber: null,
      address: "Zone industrielle, Lot 12",
      commune: "Oran",
      wilaya: "Oran",
      postalCode: "31000",
      phone: "+213 41 22 22 22",
      email: "haddad.etb@mail.dz",
    },
    document: {
      id: "doc_123",
      docType: "INVOICE",
      number: "FAC-2025-0012",
      status: "APPROVED",
      issuedAt: "2025-08-05T10:00:00.000Z",
      dueDate: "2025-09-04T10:00:00.000Z",
      validUntil: null,
      deliveryDate: null,
      shippedAt: null,
      receivedAt: null,
      neededAt: null,
      priority: null,
      reason: null,
      currency: "DZD",
      exchangeRate: 1,
      paymentStatus: "PARTIAL",
      paymentMethod: null,
      issuedBy: "Amina Toumi",
      createdBy: "Amina Toumi",
      notes: "Livraison prévue sous 10 jours ouvrés. Merci de vérifier la conformité à réception.",
      terms: "Paiement à réception de facture, par virement bancaire ou chèque.",
      meta: null,
    },
    lines: Array.from({ length: lines }, (_, i) => ({
      lineNumber: i + 1,
      kind: "PRODUCT",
      label: `Prestation de maintenance informatique — lot ${i + 1}`,
      unit: "forfait",
      quantity: 1 + (i % 3),
      unitPrice: 25000,
      discountPct: i % 5 === 0 ? 5 : 0,
      taxPct: 19,
      amountHt: 25000,
      amountTva: 4750,
      amountTtc: 29750,
    })),
    totals: {
      totalHt: 25000 * lines,
      totalTva: 4750 * lines,
      totalTtc: 29750 * lines,
      paidAmount: 30000,
      netPayable: 29750 * lines - 30000,
    },
    branding: { logo: null, logoMimeType: null, stamp: null, stampMimeType: null, signature: null, signatureMimeType: null },
  };
}

async function render(doc: PrintableDocument, locale: "fr" | "ar" | "en") {
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
  void getPrintConfig;
  return { pdf, pages: engine.totalPages };
}

async function main() {
  const arDoc = (() => {
    const d = mockDoc(8, "A4");
    return {
      ...d,
      party: { ...d.party, name: "مؤسسة محمد حداد للتجارة", address: "حي الصناعي، القطعة 12", commune: "وهران" },
      issuedBy: "أمينة تومي",
      lines: d.lines.map((l) => ({ ...l, label: `خدمة الصيانة المعلوماتية — الدفعة ${l.lineNumber}` })),
      notes: "التسليم متوقع خلال 10 أيام عمل. يرجى التحقق من المطابقة عند الاستلام.",
      terms: "الدفع عند استلام الفاتورة، عن طريق تحويل بنكي أو شيك.",
    };
  })() as PrintableDocument;
  const cases: Array<{ file: string; doc: PrintableDocument; locale: "fr" | "ar" | "en" }> = [
    { file: "smoke-a4-fr.pdf", doc: mockDoc(6), locale: "fr" },
    { file: "smoke-a4-ar.pdf", doc: arDoc, locale: "ar" },
    { file: "smoke-thermal-en.pdf", doc: mockDoc(5, "THERMAL"), locale: "en" },
    { file: "smoke-a5-fr.pdf", doc: mockDoc(30, "A5"), locale: "fr" },
    { file: "smoke-draft-fr.pdf", doc: { ...mockDoc(4), document: { ...mockDoc(4).document, status: "DRAFT" as const } }, locale: "fr" },
    { file: "smoke-cancelled-fr.pdf", doc: { ...mockDoc(4), document: { ...mockDoc(4).document, status: "CANCELLED" as const } }, locale: "fr" },
    { file: "smoke-paid-ar.pdf", doc: arDoc, locale: "ar" },
  ];
  for (const c of cases) {
    const { pdf, pages } = await render(c.doc, c.locale);
    fs.writeFileSync(path.join(OUT, c.file), Buffer.from(pdf));
    console.log(`${c.file}: ${pdf.length} bytes, ${pages} page(s)`);
  }
}

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1]?.endsWith("print-smoke.ts");

if (isDirectRun) {
  main()
    .then(() => console.log("OK"))
    .catch((e) => {
      console.error("FAIL", e);
      process.exit(1);
    });
}

export { mockDoc, render };
