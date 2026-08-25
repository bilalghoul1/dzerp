import type { Align, Color, PdfEngine } from "./renderer";
import { COLORS } from "./renderer";
import type { FontStyle } from "./fonts";
import { hasArabicScript } from "./fonts";

/**
 * Tableau réutilisable pour les templates d'impression : gestion des ruptures
 * de page avec en-tête répété, lignes zebrées, cellules multi-lignes tronquées.
 */

export interface TableColumn {
  key: string;
  label: string;
  align?: Align;
  width: number;
  style?: FontStyle;
  size?: number;
  color?: Color;
}

export interface TableOptions {
  x: number;
  y: number;
  columns: TableColumn[];
  rows: Array<Record<string, string>>;
  rowSize?: number;
  rowHeight?: number;
  headerHeight?: number;
  headerColor?: Color;
  headerTextColor?: Color;
  zebraColor?: Color;
  borderColor?: Color;
  cellPaddingX?: number;
  cellPaddingY?: number;
  /** Nombre max de lignes d'enveloppement par cellule (défaut 3). */
  maxLines?: number;
  /** Colonnes du total (ajoutées sous le tableau, alignées à droite). */
  totals?: Array<{ label: string; value: string; bold?: boolean; size?: number }>;
}

export interface DrawnTable {
  y: number;
}

function fitCellLines(
  engine: PdfEngine,
  text: string,
  style: FontStyle,
  size: number,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines = engine.wrap(text, style, size, maxWidth);
  if (lines.length <= maxLines) return lines.length > 0 ? lines : [""];
  const kept = lines.slice(0, maxLines - 1);
  const last = lines[maxLines - 1];
  const ellipsis = "…";
  let truncated = last;
  while (
    truncated.length > 1 &&
    engine.measure(truncated + ellipsis, style, size) > maxWidth
  ) {
    truncated = truncated.slice(0, -1);
  }
  kept.push(truncated + ellipsis);
  return kept;
}

export function drawTable(engine: PdfEngine, options: TableOptions): DrawnTable {
  const {
    x,
    columns,
    rows,
    rowSize = 8,
    rowHeight: rowHeightOpt,
    headerHeight: headerHeightOpt,
    headerColor,
    headerTextColor,
    zebraColor,
    cellPaddingX = 3,
    cellPaddingY = 3,
    maxLines = 3,
    totals = [],
  } = options;

  const headerHeight = headerHeightOpt ?? Math.max(rowSize * 1.9, 14);
  const lineH = engine.lineHeight(rowSize);
  const totalWidth = columns.reduce((sum, c) => sum + c.width, 0);
  const right = x + totalWidth;

  const drawHeader = () => {
    if (engine.y + headerHeight > engine.contentBottom) {
      engine.newPage();
    }
    engine.fillRect(x, engine.y, totalWidth, headerHeight, headerColor ?? COLORS.lightGray);
    let cursor = x;
    for (const col of columns) {
      engine.drawText(col.label, {
        x: col.align === "right" ? cursor + col.width : col.align === "center" ? cursor + col.width / 2 : cursor + cellPaddingX,
        y: engine.y + headerHeight / 2 - rowSize / 2,
        size: rowSize,
        style: "bold",
        color: headerTextColor,
        align: col.align === "right" ? "right" : col.align === "center" ? "center" : "left",
        maxWidth: col.width - cellPaddingX * 2,
      });
      cursor += col.width;
    }
    engine.y += headerHeight;
  };

  drawHeader();

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const cellLines: string[][] = columns.map((col) =>
      fitCellLines(
        engine,
        row[col.key] ?? "",
        col.style ?? "regular",
        col.size ?? rowSize,
        col.width - cellPaddingX * 2,
        maxLines,
      ),
    );
    const maxLinesCount = cellLines.reduce(
      (max, lines) => Math.max(max, lines.length),
      1,
    );
    const rowH = rowHeightOpt ?? Math.max(
      maxLinesCount * lineH + cellPaddingY * 2,
      rowSize * 1.9,
    );

    if (engine.y + rowH > engine.contentBottom) {
      engine.newPage();
      drawHeader();
    }

    if (zebraColor && r % 2 === 1) {
      engine.fillRect(x, engine.y, totalWidth, rowH, zebraColor);
    }

    let cursor = x;
    for (let c = 0; c < columns.length; c++) {
      const col = columns[c];
      const lines = cellLines[c];
      let lineY = engine.y + cellPaddingY;
      for (const line of lines) {
        // Within a French document, Arabic data (client name, product label)
        // is shaped correctly by FontManager.splitRuns; right-aligning a
        // purely-Arabic cell reads more naturally without flipping the whole
        // French layout to RTL.
        const isArabicCell = col.align === undefined && hasArabicScript(line);
        const alignResolved: Align = col.align === "center"
          ? "center"
          : col.align === "right" || isArabicCell
            ? "right"
            : "start";
        engine.drawText(line, {
          x: alignResolved === "center" ? cursor + col.width / 2 : alignResolved === "right" ? cursor + col.width - cellPaddingX : cursor + cellPaddingX,
          y: lineY,
          size: col.size ?? rowSize,
          style: col.style ?? "regular",
          color: col.color,
          align: alignResolved,
          maxWidth: col.width - cellPaddingX * 2,
        });
        lineY += lineH;
      }
      cursor += col.width;
    }
    engine.y += rowH;
  }

  engine.drawLine(x, engine.y, right, engine.y, { thickness: 0.6 });

  for (const total of totals) {
    if (engine.y + headerHeight > engine.contentBottom) {
      engine.newPage();
    }
    const totalW = totals.length > 0 ? totalWidth * 0.55 : 0;
    engine.drawText(total.label, {
      x: x + totalWidth - totalW,
      y: engine.y + 2,
      size: total.size ?? rowSize + 1,
      style: total.bold ? "bold" : "regular",
      align: "left",
    });
    engine.drawText(total.value, {
      x: right,
      y: engine.y + 2,
      size: total.size ?? rowSize + 1,
      style: total.bold ? "bold" : "regular",
      align: "right",
    });
    engine.y += (total.size ?? rowSize + 1) * 1.8;
  }

  return { y: engine.y };
}
