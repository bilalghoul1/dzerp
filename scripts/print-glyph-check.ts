import { PdfEngine } from "../src/features/print/renderer";
import { createFooter, createRunningHeader, renderPrintableDocument } from "../src/features/print/templates";
import { buildLabels } from "../src/features/print/service";
import { mockDoc } from "./print-smoke";
import { getDocument } from "pdfjs-dist";

async function renderGlyph() {
  const doc = mockDoc(2);
  doc.document.notes = "Test caractère CJK : 中文測試 и русский αβγ ★ — émoji 😀";
  const labels = buildLabels("fr", doc.document.docType, doc);
  const engine = await PdfEngine.create({
    format: doc.company.printFormat,
    margins: null,
    rtl: false,
    onPage: createRunningHeader(doc, labels, "fr"),
    onFooter: createFooter(doc, labels),
  });
  await renderPrintableDocument(engine, doc, labels, "fr");
  return engine.finalize();
}

async function validatePdf(bytes: Uint8Array) {
  const doc = await getDocument({ data: bytes }).promise;
  const text: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    for (const item of content.items) text.push((item as { str: string }).str);
  }
  await doc.destroy();
  return text.join(" ");
}

async function main() {
  const t0 = Date.now();
  const pdf = await renderGlyph();
  console.log(`render glyph doc OK (${Date.now() - t0}ms, ${pdf.length} bytes)`);
  const text = await validatePdf(pdf);
  console.log(`pdfjs parse OK. contains CJK char: ${text.includes("中")}, contains α: ${text.includes("α")}, contains ★: ${text.includes("★")}`);
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
