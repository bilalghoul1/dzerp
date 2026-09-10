import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";
import { mockDoc, render } from "./print-smoke";
import { writeFileSync } from "fs";

async function main() {
  const a4 = mockDoc(3, "A4");
  a4.document.docType = "INVOICE";
  const out = await render(a4, "fr");
  const doc = await getDocument({ data: out.pdf }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 3 });
  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx as any, viewport } as any).promise;
  writeFileSync("C:/Users/Bilal/AppData/Local/Temp/opencode/_totals-a4-fr.png", canvas.toBuffer("image/png"));
  console.log("wrote _totals-a4-fr.png", viewport.width, viewport.height);
}

main().catch((e) => { console.error(e); process.exit(1); });