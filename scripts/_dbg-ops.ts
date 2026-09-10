import { getDocument } from "pdfjs-dist";
import { OPS } from "pdfjs-dist";
import { mockDoc, render } from "./print-smoke";

async function dumpOps(pdf: Uint8Array, label: string, yMin: number, yMax: number) {
  const doc = await getDocument({ data: pdf }).promise;
  const page = await doc.getPage(1);
  const opList = await page.getOperatorList();
  console.log(`\n===== ${label}: ${opList.fnArray.length} ops total =====`);
  let rects = 0;
  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i] ?? [];
    if (fn === OPS.rectangle) {
      rects++;
      const [rx, ry, rw, rh] = args;
      if (ry + rh > yMin && ry < yMax) {
        console.log(`rect op[${i}] x=${rx.toFixed(1)} y=${ry.toFixed(1)} w=${rw.toFixed(1)} h=${rh.toFixed(1)}`);
      }
    }
    if (fn === OPS.constructPath && rects === 0) {
      // fallback coarse diagnostic: log any path with y in band
      const ys: number[] = [];
      for (let k = 0; k < args.length; k += 2) if (typeof args[k + 1] === "number") ys.push(args[k + 1]);
      if (ys.length && Math.max(...ys) > yMin && Math.min(...ys) < yMax) {
        console.log(`path op[${i}] fn=${fn}`);
      }
    }
  }
  console.log(`total rectangle ops on page 1: ${rects}`);
}

async function main() {
  const a4 = mockDoc(3, "A4");
  a4.document.docType = "INVOICE";
  const fr = await render(a4, "fr");
  // Page height A4 = 841.89. Totals in engine y-down ~427..515 => user space y ~ 327..415.
  await dumpOps(fr.pdf, "INVOICE 3 lignes fr-LTR operand dump", 320, 420);
}

main().catch((e) => { console.error(e); process.exit(1); });