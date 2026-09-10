import fs from "node:fs";
import path from "node:path";
import type { PrintableDocument } from "../src/features/print/types";
import { mockDoc, render } from "./print-smoke";

const OUT = path.join(
  process.env.LOCALAPPDATA ?? path.join(process.cwd(), ".tmp"),
  "Temp",
  "opencode",
);

function withDoc(
  base: PrintableDocument,
  patch: (d: PrintableDocument) => PrintableDocument,
): PrintableDocument {
  return patch({ ...base, lines: base.lines.map((l) => ({ ...l })) });
}

const LONG_AR = "راغور تيزييييييييييييييييييييييييي";
const LONG_FR =
  "Prestation d'installation et de mise en service d'un réseau informatique sécurisé avec configuration avancée des postes et du serveur central";
const LONG_ADDR = "42 Test Street, Algiers / Industrial Zone / Building 12 / Algeria";

interface TestCase {
  name: string;
  file: string;
  doc: PrintableDocument;
  locale: "fr" | "ar" | "en";
}

function buildCases(): TestCase[] {
  const cases: TestCase[] = [];

  const longName = (name: string) =>
    withDoc(mockDoc(6), (d) => ({
      ...d,
      company: { ...d.company, name, activity: "Activité très longue décrite sur plusieurs mots informatiques industrie", printHeader: null },
    }));

  const withLines = (n: number, format: "A4" | "A5" | "THERMAL") =>
    mockDoc(n, format);

  const longDesc = (label: string) =>
    withDoc(mockDoc(8), (d) => ({
      ...d,
      lines: d.lines.map((l) => ({ ...l, label })),
    }));

  const bigAmounts = withDoc(mockDoc(5), (d) => ({
    ...d,
    lines: d.lines.map((l) => ({
      ...l,
      unitPrice: 12000000,
      quantity: 45,
      amountHt: 540000000,
      amountTva: 102600000,
      amountTtc: 642600000,
    })),
    totals: { ...d.totals, totalHt: 2700000000, totalTva: 513000000, totalTtc: 3213000000 },
  }));

  const longBank = withDoc(mockDoc(4), (d) => ({
    ...d,
    company: {
      ...d.company,
      bank: "Banque Nationale d'Algérie — Agence principale Wilaya d'Alger",
      bankAgency: "Agence Centrale des Grands Comptes et Établissements Spécialisés",
      rib: "RIP 00016 12345 67890123456789 92 — vérification du numéro de compte bancaire national",
      iban: "DZ00 0002 1234 5678 9012 3456 7890 00",
      swift: "BNADZDZLXXX",
    },
  }));

  const multiPageQuo = withDoc(mockDoc(35), (d) => ({
    ...d,
    document: { ...d.document, docType: "QUOTATION" as const, number: "DEV-2026-00010", notes: LONG_FR, terms: LONG_FR },
  }));

  const multiPageInv = withDoc(mockDoc(52), (d) => ({
    ...d,
    document: {
      ...d.document,
      docType: "INVOICE" as const,
      number: "FAC-2026-0001",
      notes: `Conditions : ${LONG_FR}. Référence commande : 45678.`,
      terms: `Paiement : ${LONG_FR}.`,
    },
  }));

  const statusDocs = [
    { status: "DRAFT" as const, file: "layout-stress-draft-fr.pdf" },
    { status: "CANCELLED" as const, file: "layout-stress-cancelled-fr.pdf" },
  ];

  cases.push(
    { name: "TEST 01 baseline 3 lignes A4 fr", file: "layout-01-a4-fr.pdf", doc: mockDoc(3), locale: "fr" },
    { name: "TEST 02 15 lignes A4 fr", file: "layout-02-a4-fr.pdf", doc: withLines(15, "A4"), locale: "fr" },
    { name: "TEST 03 50 lignes A4 multi-page fr", file: "layout-03-a4-fr.pdf", doc: withLines(50, "A4"), locale: "fr" },
    { name: "TEST 04 nom société arabe long A4 ar", file: "layout-04-a4-ar.pdf", doc: longName("مؤسسة الصفا للراغور المتطورة تيزييييييييييييييييييييييييي للصناعات والخدمات المتنوعة"), locale: "ar" },
    { name: "TEST 05 description française longue A4 fr", file: "layout-05-a4-fr.pdf", doc: longDesc(LONG_FR), locale: "fr" },
    { name: "TEST 06 mélange ar+fr+chiffres A4 fr", file: "layout-06-a4-fr.pdf", doc: longDesc(`${LONG_FR} — ${LONG_AR} — n° ${LONG_FR} 45%`) , locale: "fr" },
    { name: "TEST 07 nom longue latin + activité", file: "layout-07-a4-fr.pdf", doc: longName("SOCIÉTÉ D'ÉQUIPEMENTS ÉLECTRIQUES ET ÉLECTRONIQUES D'ALGÉRIE ORIENTALE"), locale: "fr" },
    { name: "TEST 08 adresses très longues A4 fr", file: "layout-08-a4-fr.pdf", doc: withDoc(mockDoc(8), (d) => ({
        ...d,
        company: { ...d.company, address: LONG_ADDR, commune: "Commune de la grande ville" },
        party: { ...(d.party as object), address: LONG_ADDR, commune: "Zone industrielle secondaire éloignée" } as NonNullable<PrintableDocument["party"]>,
      })), locale: "fr" },
    { name: "TEST 09 gros montants A4 fr", file: "layout-09-a4-fr.pdf", doc: bigAmounts, locale: "fr" },
    { name: "TEST 10 devis multi-page A4 fr", file: "layout-10-a4-fr.pdf", doc: multiPageQuo, locale: "fr" },
    { name: "TEST 11 facture multi-page A4 fr", file: "layout-11-a4-fr.pdf", doc: multiPageInv, locale: "fr" },
    { name: "TEST 12 A5 30 lignes fr", file: "layout-12-a5-fr.pdf", doc: withLines(30, "A5"), locale: "fr" },
    { name: "TEST 13 THERMAL 8 lignes lisibles", file: "layout-13-thermal-fr.pdf", doc: longDesc("Câble réseau, connecteur, goulotte — lot de matériel passif étiqueté"), locale: "fr" },
    { name: "TEST 14 A5 arabe (RTL)", file: "layout-14-a5-ar.pdf", doc: (() => {
        const d = withLines(25, "A5");
        return withDoc(d, (dd) => ({
          ...dd,
          party: { ...(dd.party as object), name: "مؤسسة محمد حداد للتجارة", address: LONG_AR } as NonNullable<PrintableDocument["party"]>,
          issuedBy: "أمينة تومي",
          lines: dd.lines.map((l) => ({ ...l, label: `خدمة الصيانة المعلوماتية — ${l.label}` })),
          notes: LONG_AR,
        }));
      })(), locale: "ar" },
    { name: "TEST 15 une seule description très longue A4 fr", file: "layout-15-a4-fr.pdf", doc: mockDoc(1).lines[0] ? longDesc(`${LONG_FR}. ${LONG_FR}. ${LONG_FR}.`) : mockDoc(3), locale: "fr" },
    { name: "TEST 16 25 lignes mixtes A4", file: "layout-16-a4-fr.pdf", doc: (() => {
        const d = withLines(25, "A4");
        return withDoc(d, (dd) => ({
          ...dd,
          lines: dd.lines.map((l, i) => ({
            ...l,
            label: i % 3 === 0 ? `${l.label} ${LONG_AR}` : i % 3 === 1 ? `Article mixte ${i} — ${LONG_FR} — ${LONG_AR}` : l.label,
          })),
        }));
      })(), locale: "fr" },
    { name: "TEST 17a statut DRAFT A4 fr", file: statusDocs[0].file, doc: withDoc(mockDoc(4), (d) => ({ ...d, document: { ...d.document, status: "DRAFT" as const } })), locale: "fr" },
    { name: "TEST 17b statut CANCELLED A4 fr", file: statusDocs[1].file, doc: withDoc(mockDoc(4), (d) => ({ ...d, document: { ...d.document, status: "CANCELLED" as const } })), locale: "fr" },
    { name: "TEST extra infos banque longues A4 fr", file: "layout-extra-bank-fr.pdf", doc: longBank, locale: "fr" },
  );

  // Régression DEV2026-00010 : le document qui a révélé les défauts.
  const regression: PrintableDocument = withDoc(mockDoc(1), (d) => ({
    ...d,
    company: { ...d.company, address: LONG_ADDR },
    party: { ...(d.party as object), address: LONG_ADDR, name: "Client Test DEV" } as NonNullable<PrintableDocument["party"]>,
    document: {
      ...d.document,
      docType: "QUOTATION" as const,
      number: "DEV2026-00010",
    },
    lines: [
      {
        lineNumber: 1,
        kind: "PRODUCT",
        label: LONG_AR,
        unit: "u",
        quantity: 15,
        unitPrice: 12000,
        discountPct: 0,
        taxPct: 19,
        amountHt: 180000,
        amountTva: 34200,
        amountTtc: 214200,
      },
    ],
    totals: {
      totalHt: 180000,
      totalTva: 34200,
      totalTtc: 214200,
      paidAmount: 0,
      netPayable: 214200,
    },
  }));
  cases.push({
    name: "RÉGRESSION DEV2026-00010 devis A4 fr",
    file: "layout-regression-dev2026-00010.pdf",
    doc: regression,
    locale: "fr",
  });

  return cases;
}

async function main() {
  const cases = buildCases();
  for (const c of cases) {
    try {
      const { pdf, pages } = await render(c.doc, c.locale);
      fs.writeFileSync(path.join(OUT, c.file), Buffer.from(pdf));
      console.log(`OK  ${c.name.padEnd(45)} ${c.file}: ${pdf.length} bytes, ${pages} page(s)`);
    } catch (e) {
      console.error(`FAIL ${c.name}: ${(e as Error).message}`);
      process.exitCode = 1;
    }
  }
  if (!process.exitCode) console.log("ALL LAYOUT TESTS RENDERED");
}

const isDirectRun =
  typeof process !== "undefined" && process.argv[1]?.endsWith("print-layout-stress.ts");

if (isDirectRun) main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});