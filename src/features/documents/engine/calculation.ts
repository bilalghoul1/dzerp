import type { InputLine, ComputedLine, ComputedTotals } from "./types";

export function computeLine(line: InputLine): ComputedLine {
  const qty = line.quantity ?? 1;
  const price = line.unitPrice ?? 0;
  const disc = line.discountPct ?? 0;
  const tax = line.taxPct ?? 0;
  const kind = line.kind ?? "PRODUCT";

  if (kind === "COMMENT" || kind === "SECTION") {
    return { amountHt: 0, amountTva: 0, amountTtc: 0 };
  }

  const baseHT = qty * price;
  const discount = baseHT * disc / 100;
  const amountHt = baseHT - discount;
  const amountTva = amountHt * tax / 100;
  const amountTtc = amountHt + amountTva;

  const r2 = (n: number) => Math.round(n * 100) / 100;

  return {
    amountHt: r2(amountHt),
    amountTva: r2(amountTva),
    amountTtc: r2(amountTtc),
  };
}

export function computeAllLines(lines: InputLine[]): ComputedTotals {
  const computed = lines.map(computeLine);

  let totalHt = 0;
  let totalTva = 0;
  let totalTtc = 0;

  for (const cl of computed) {
    totalHt += cl.amountHt;
    totalTva += cl.amountTva;
    totalTtc += cl.amountTtc;
  }

  const r2 = (n: number) => Math.round(n * 100) / 100;

  return {
    lines: computed,
    totalHt: r2(totalHt),
    totalTva: r2(totalTva),
    totalTtc: r2(totalTtc),
  };
}
