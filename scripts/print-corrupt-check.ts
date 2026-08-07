import { PdfEngine } from "../src/features/print/renderer";
import { createFooter, createRunningHeader, renderPrintableDocument } from "../src/features/print/templates";
import { buildLabels } from "../src/features/print/service";
import { mockDoc } from "./print-smoke";

async function main() {
  const corrupt = mockDoc(3, "A4");
  corrupt.branding = {
    logo: Buffer.from("ceci n'est pas une image", "utf8"),
    logoMimeType: "image/png",
    stamp: Buffer.from("ceci n'est pas une image", "utf8"),
    stampMimeType: "image/png",
    signature: Buffer.from("ceci n'est pas une image", "utf8"),
    signatureMimeType: "image/jpeg",
  };
  const labels = buildLabels("fr", corrupt.document.docType, corrupt);
  const engine = await PdfEngine.create({
    format: corrupt.company.printFormat,
    margins: null,
    rtl: false,
    onPage: createRunningHeader(corrupt, labels),
    onFooter: createFooter(corrupt, labels),
  });
  console.log("rendering…");
  await renderPrintableDocument(engine, corrupt, labels, "fr");
  console.log("render OK");
  const pdf = await engine.finalize();
  console.log("finalize OK", pdf.length);
}

main().catch((e) => {
  console.error("FAIL", e, "\n", e instanceof Error ? e.stack : "");
  process.exit(1);
});
