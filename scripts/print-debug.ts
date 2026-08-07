import { PdfEngine } from "../src/features/print/renderer";
import { createFooter, createRunningHeader, renderPrintableDocument } from "../src/features/print/templates";
import { buildLabels } from "../src/features/print/service";
import { mockDoc } from "./print-smoke";

const t0 = Date.now();
const log = (msg: string) => console.log(`${Date.now() - t0}ms  ${msg}`);

async function main() {
  const doc = mockDoc(3, "A4");
  const labels = buildLabels("fr", doc.document.docType, doc);
  const engine = await PdfEngine.create({
    format: doc.company.printFormat,
    margins: doc.company.printMargins ?? undefined,
    rtl: false,
    onPage: createRunningHeader(doc, labels),
    onFooter: createFooter(doc, labels),
  });
  log("engine ready");
  await renderPrintableDocument(engine, doc, labels, "fr");
  log(`render done (pages=${engine.totalPages})`);

  // footer step
  const totalPages = engine.totalPages;
  for (const { page, pageIndex } of engine["footers"] as Array<{ page: unknown; pageIndex: number }>) {
    engine["drawOn"](page as never, () =>
      engine["onFooter"]!({ engine, page: page as never, pageIndex, totalPages }),
    );
  }
  log("footers done");

  // save step
  log("save start");
  const pdf = await engine.pdfDoc.save();
  log(`saved ${pdf.length} bytes`);
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
