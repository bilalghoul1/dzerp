import { getDocument } from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { mockDoc, render } from "./print-smoke";

async function dumpTotals(pdf: Uint8Array, label: string, _yLo: number, _yHi: number) {
  const doc = await getDocument({ data: pdf }).promise;
  const page = await doc.getPage(1);
  const tc = await page.getTextContent();
  console.log(`\n===== ${label} (pdf user-space y, origin bottom-left; band 300..560) =====`);
  for (const it of tc.items) {
    const item = it as TextItem;
    const x = item.transform[4];
    const yBot = item.transform[5];
    if (yBot >= 300 && yBot <= 560 && typeof item.str === "string" && item.str.trim()) {
      console.log(`y=${yBot.toFixed(1).padStart(6)} x=${x.toFixed(1).padStart(7)}  ${JSON.stringify(item.str)}`);
    }
  }
}

async function main() {
  // Standard INVOICE 3 lines (has payment info -> paidAmount + netPayable rows)
  const a4 = mockDoc(3, "A4");
  a4.document.docType = "INVOICE";
  const fr = await render(a4, "fr");
  await dumpTotals(fr.pdf, "INVOICE 3 lignes fr LTR", 300, 560);

  // Large amounts
  const big = mockDoc(2, "A4");
  big.document.docType = "INVOICE";
  big.totals = {
    totalHt: 12345678901234.5,
    totalTva: 2345678901234.55,
    totalTtc: 14691357802469.05,
    paidAmount: 100000,
    netPayable: 14691257802469.05,
  };
  big.lines = big.lines.map((l, i) => ({
    ...l,
    unitPrice: big.totals.totalHt / 2,
    amountHt: big.totals.totalHt / 2,
    amountTva: big.totals.totalTva / 2,
    amountTtc: big.totals.totalTtc / 2,
  }));
  const bigFr = await render(big, "fr");
  await dumpTotals(bigFr.pdf, "INVOICE GROS MONTANTS fr LTR", 300, 560);

  // Arabic RTL
  const ar = mockDoc(3, "A4");
  ar.document.docType = "INVOICE";
  ar.company.name = "مؤسسة النور";
  const arPdf = await render(ar, "ar");
  await dumpTotals(arPdf.pdf, "INVOICE 3 lignes ar RTL", 300, 560);

  // A5
  const a5 = mockDoc(3, "A5");
  a5.document.docType = "INVOICE";
  const a5Pdf = await render(a5, "fr");
  const a5Doc = await getDocument({ data: a5Pdf.pdf }).promise;
  const a5page = await a5Doc.getPage(1);
  const a5tc = await a5page.getTextContent();
  console.log(`\n===== INVOICE A5 fr (pageH=419.53, y downward) =====`);
  for (const it of a5tc.items) {
    const a5Item = it as TextItem;
    if (typeof a5Item.str === "string" && a5Item.str.trim()) {
      const yTop = a5Item.transform[5];
      if (yTop >= 200 && yTop <= 320) {
        console.log(`y=${yTop.toFixed(1).padStart(6)} x=${a5Item.transform[4].toFixed(1).padStart(7)}  ${JSON.stringify(a5Item.str)}`);
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });