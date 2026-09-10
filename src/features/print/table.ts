import type { Align, Color, PdfEngine } from "./renderer";
import { COLORS } from "./renderer";
import type { FontStyle } from "./fonts";

/**
 * Tableau réutilisable pour les templates d'impression : gestion des ruptures
 * de page avec en-tête répété, lignes zebrées, cellules multi-lignes.
 *
 * Garanties structurelles :
 * - Les largeurs de colonnes sont RÉSOLUES depuis le contenu réel (valeurs
 *   formatées + libellés d'en-tête), jamais ajoutées "de tête" à partir d'un
 *   montant nul. Une colonne financière ne peut pas être plus étroite que sa
 *   plus grande valeur → pas de troncature des montants.
 * - Une cellule définie `noWrap` (montants…) est rendue sur UNE ligne : le
 *   curseur et la devise restent un seul bloc visuel ; si l'espace manque, la
 *   typographie est réduite dans les limites sûres — jamais tronquée.
 * - Les cellules `truncate` (description) peuvent recevoir des points de
 *   suspension, plafonnées aussi par la hauteur utile de la page pour qu'une
 *   seule ligne monstrueuse ne chevauche jamais le bas de page.
 */

export interface TableColumn {
  key: string;
  label: string;
  align?: Align;
  width: number;
  style?: FontStyle;
  size?: number;
  color?: Color;
  /** Largeur minimale garantie (pt). Défaut : largeur mesurée du libellé. */
  minWidth?: number;
  /** Colonne flexible qui absorbe le reste de la largeur (ex. description). */
  flex?: number;
  /** Autorise les points de suspension (description). Défaut : false. */
  truncate?: boolean;
  /** Force une ligne unique, sans coupure interne (montants, quantités). */
  noWrap?: boolean;
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
  /** Nombre max de lignes d'enveloppement pour les cellules `truncate` (défaut 3). */
  maxLines?: number;
  /** Colonnes du total (ajoutées sous le tableau, alignées à droite). */
  totals?: Array<{ label: string; value: string; bold?: boolean; size?: number }>;
}

export interface DrawnTable {
  y: number;
  cols: number[];
}

const ELLIPSIS = "…";
const ABSOLUTE_FLOOR = 14;

/** Style effectif d'une cellule (police par défaut du tableau sinon colonne). */
function cellStyle(col: TableColumn, fallback: FontStyle): FontStyle {
  return col.style ?? fallback;
}

function cellSize(col: TableColumn, fallback: number): number {
  return col.size ?? fallback;
}

/**
 * Découpe le libellé d'en-tête en lignes lisibles. Un unique mot ne peut pas
 * être coupé au caractère : on réduit plutôt sa taille (fit) pour préserver
 * la forme du mot (jamais "Addre/ss").
 */
function headerLines(
  engine: PdfEngine,
  col: TableColumn,
  size: number,
  width: number,
): { lines: string[]; size: number } {
  const maxW = width - 2;
  if (engine.measure(col.label, "bold", size) <= maxW) {
    return { lines: [col.label], size };
  }
  // Un libellé d'un seul mot ("Qté") ne SE COUPE JAMAIS au caractère : on
  // réduit sa taille pour le garder intact. Les libellés multi-mots peuvent
  // envelopper sur plusieurs lignes, sauf si un mot reste plus large que la
  // colonne (dans ce cas, réduction de taille au lieu d'une découpe).
  const tokens = col.label.split(/\s+/);
  if (tokens.length === 1) {
    const fit = engine.fitSizeToWidth(col.label, "bold", size, maxW, 6);
    return { lines: [col.label], size: fit };
  }
  const wrapped = engine.wrap(col.label, "bold", size, maxW);
  const brokenWord = wrapped.some(
    (line) => engine.measure(line, "bold", size) > maxW + 0.5,
  );
  if (!brokenWord) return { lines: wrapped, size };
  const fit = engine.fitSizeToWidth(col.label, "bold", size, maxW, 6);
  return { lines: [col.label], size: fit };
}

/**
 * Prépare les lignes d'une cellule. `noWrap` → une seule ligne (taille ajustée
 * au besoin). `truncate` → enveloppement plafonné avec points de suspension.
 * Sinon → enveloppement complet SANS jamais tronquer (intégrité financière).
 */
function fitCellLines(
  engine: PdfEngine,
  text: string,
  col: TableColumn,
  size: number,
  maxWidth: number,
  maxLines: number,
  pageSafeMaxLines: number,
): { lines: string[]; size: number } {
  const style = cellStyle(col, "regular");
  if (!text) return { lines: [""], size };
  if (col.noWrap) {
    const fit = engine.fitSizeToWidth(text, style, size, maxWidth, 5.5);
    return { lines: [text], size: fit };
  }
  const lines = engine.wrap(text, style, size, maxWidth);
  const full = lines.length > 0 ? lines : [""];
  if (!col.truncate) return { lines: full, size };
  const cap = Math.max(1, Math.min(maxLines, pageSafeMaxLines));
  if (full.length <= cap) return { lines: full, size };
  const kept = full.slice(0, cap - 1);
  let last = full[cap - 1];
  while (
    last.length > 1 &&
    engine.measure(last + ELLIPSIS, style, size) > maxWidth
  ) {
    last = last.slice(0, -1);
  }
  kept.push(last + ELLIPSIS);
  return { lines: kept, size };
}

/**
 * Résout les largeurs de colonnes depuis : minWidth, largeur du libellé,
 * et — pour les colonnes non-flexibles — la plus grande valeur réelle
 * présente dans les données. La colonne flexible absorbe le reste.
 */
function resolveWidths(
  engine: PdfEngine,
  columns: TableColumn[],
  rows: Array<Record<string, string>>,
  totalW: number,
  size: number,
  cellPaddingX = 3,
): number[] {
  // Le libellé d'en-tête doit tenir DANS sa zone de texte (largeur de colonne
  // moins les deux paddings horizontaux), sinon chaque en-tête enveloppe sur
  // deux lignes et la bande d'en-tête gonfle inutilement.
  const widths = columns.map((col) => {
    const labelW = engine.measure(col.label, "bold", size);
    return Math.max(col.minWidth ?? 12, labelW + cellPaddingX * 2 + 2);
  });

  // Colonnes de garde (non-flexibles) : doivent contenir leur valeur max réelle.
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if ((col.flex ?? 0) > 0) continue;
    let maxV = 0;
    for (const row of rows) {
      const v = row[col.key];
      if (typeof v !== "string" || v.length === 0) continue;
      maxV = Math.max(maxV, engine.measure(v, cellStyle(col, "regular"), cellSize(col, size)));
    }
    widths[i] = Math.max(widths[i], maxV + 6);
  }

  const guardTotal = widths.reduce(
    (sum, w, i) => sum + ((columns[i].flex ?? 0) > 0 ? 0 : w),
    0,
  );
  const flexIdx = columns.findIndex((c) => (c.flex ?? 0) > 0);

  if (flexIdx === -1) {
    return shrinkToFit(widths, totalW);
  }

  const flexMin = Math.max(ABSOLUTE_FLOOR, columns[flexIdx].minWidth ?? 30);
  let remaining = totalW - guardTotal;
  if (remaining < flexMin) {
    // Les colonnes de garde cèdent leur excédent (jamais sous le plancher).
    const deficit = flexMin - remaining;
    let rest = deficit;
    for (let i = 0; i < widths.length && rest > 0; i++) {
      if (i === flexIdx) continue;
      const shrinkable = widths[i] - ABSOLUTE_FLOOR;
      if (shrinkable > 0) {
        const delta = Math.min(shrinkable, rest);
        widths[i] -= delta;
        rest -= delta;
      }
    }
    remaining = flexMin - rest;
  }
  widths[flexIdx] = remaining;
  return widths;
}

function shrinkToFit(widths: number[], totalW: number): number[] {
  const sum = widths.reduce((a, b) => a + b, 0);
  if (sum <= totalW) return widths;
  const scale = Math.min(1, totalW / sum);
  widths = widths.map((w) => Math.max(ABSOLUTE_FLOOR, w * scale));
  return widths;
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

  const totalWidth = columns.reduce((sum, c) => sum + c.width, 0);
  const right = x + totalWidth;
  const rtl = engine.rtl;
  const lineH = engine.lineHeight(rowSize);

  // Largeurs résolues depuis les vraies données. On redistribue si l'appelant
  // fournissait sa propre répartition (la somme reste exactement totalWidth).
  const widths = resolveWidths(engine, columns, rows, totalWidth, rowSize, cellPaddingX);
  const resolvedColumns = columns.map((col, i) => ({ ...col, width: widths[i] }));

  // Hauteur de page utile pour borner une cellule tronquée monstrueuse.
  const pageUsableH = engine.contentBottom - engine.contentTop;
  const pageSafeMaxLines = Math.max(1, Math.floor((pageUsableH - lineH) / lineH));

  // En-tête : libellés enveloppés (max 2 lignes) ou ajustés sans découpe de mot.
  const headerMeta = resolvedColumns.map((col) =>
    headerLines(engine, col, rowSize, col.width - cellPaddingX * 2),
  );
  const headerLineCount = Math.max(1, ...headerMeta.map((h) => h.lines.length));
  const headerHeight = headerHeightOpt ?? Math.max(
    headerLineCount * lineH + cellPaddingY * 2,
    rowSize * 2.1,
  );

  // Compteur de page réel pour l'en-tête répété.
  const drawHeader = () => {
    if (engine.y + headerHeight > engine.contentBottom) {
      engine.newPage();
    }
    engine.fillRect(x, engine.y, totalWidth, headerHeight, headerColor ?? COLORS.lightGray);
    let cursor = rtl ? right : x;
    for (let i = 0; i < resolvedColumns.length; i++) {
      const col = resolvedColumns[i];
      const cx = rtl ? cursor - col.width : cursor;
      const meta = headerMeta[i];
      const baseAlign: Align = resolveCellAlign(col.align, rtl, rtl ? "right" : "left");
      let lineY = engine.y + (headerHeight - meta.lines.length * lineH) / 2 + cellPaddingY * 0.5;
      for (const lineText of meta.lines) {
        engine.drawText(lineText, {
          x:
            baseAlign === "right"
              ? cx + col.width - cellPaddingX
              : baseAlign === "center"
                ? cx + col.width / 2
                : cx + cellPaddingX,
          y: lineY,
          size: meta.size,
          style: "bold",
          color: headerTextColor,
          align: baseAlign,
          maxWidth: col.width - cellPaddingX * 2,
        });
        lineY += lineH * 0.94;
      }
      cursor = rtl ? cursor - col.width : cursor + col.width;
    }
    engine.y += headerHeight;
    engine.drawLine(x, engine.y, right, engine.y, {
      thickness: 1.4,
      color: headerColor ?? COLORS.lineGray,
    });
  };

  drawHeader();

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const cells = resolvedColumns.map((col) => {
      const maxW = col.width - cellPaddingX * 2;
      return fitCellLines(
        engine,
        row[col.key] ?? "",
        col,
        cellSize(col, rowSize),
        maxW,
        maxLines,
        pageSafeMaxLines,
      );
    });
    const maxLinesCount = cells.reduce(
      (m, cell) => Math.max(m, cell.lines.length),
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

    let cursor = rtl ? right : x;
    for (let c = 0; c < resolvedColumns.length; c++) {
      const col = resolvedColumns[c];
      const cell = cells[c];
      let lineY = engine.y + cellPaddingY;
      const baseAlign: Align = resolveCellAlign(col.align, rtl, cellStyle(col, "regular") === "regular" ? (rtl ? "right" : "left") : "right");
      const cx = rtl ? cursor - col.width : cursor;
      for (const line of cell.lines) {
        if (col.noWrap) {
          // Bloc unique aligné à droite du cadre de cellule (montants).
          engine.drawText(line, {
            x:
              baseAlign === "right"
                ? cx + col.width - cellPaddingX
                : baseAlign === "center"
                  ? cx + col.width / 2
                  : cx + cellPaddingX,
            y: lineY,
            size: cell.size,
            style: cellStyle(col, "regular"),
            color: col.color,
            align: baseAlign,
          });
        } else {
          engine.drawText(line, {
            x:
              baseAlign === "right"
                ? cx + col.width - cellPaddingX
                : baseAlign === "center"
                  ? cx + col.width / 2
                  : cx + cellPaddingX,
            y: lineY,
            size: cell.size,
            style: cellStyle(col, "regular"),
            color: col.color,
            align: baseAlign,
            maxWidth: col.width - cellPaddingX * 2,
          });
        }
        lineY += lineH;
      }
      cursor = rtl ? cursor - col.width : cursor + col.width;
    }
    engine.y += rowH;
  }

  engine.drawLine(x, engine.y, right, engine.y, { thickness: 0.6 });

  for (const total of totals) {
    if (engine.y + headerHeight > engine.contentBottom) {
      engine.newPage();
    }
    const totalW = totals.length > 0 ? totalWidth * 0.55 : 0;
    const labelX = rtl ? right : x + totalWidth - totalW;
    const labelAlign: Align = rtl ? "right" : "left";
    const valueX = rtl ? x : right;
    const valueAlign: Align = rtl ? "left" : "right";
    engine.drawText(total.label, {
      x: labelX,
      y: engine.y + 2,
      size: total.size ?? rowSize + 1,
      style: total.bold ? "bold" : "regular",
      align: labelAlign,
    });
    // Valeur rendue en un bloc (jamais tronquée) : on ajuste la taille si besoin.
    if (total.value) {
      const vSize = engine.fitSizeToWidth(
        total.value,
        total.bold ? "bold" : "regular",
        total.size ?? rowSize + 1,
        Math.max(24, totalW - 8),
      );
      engine.drawText(total.value, {
        x: valueX,
        y: engine.y + 2,
        size: vSize,
        style: total.bold ? "bold" : "regular",
        align: valueAlign,
      });
    }
    engine.y += (total.size ?? rowSize + 1) * 1.8;
  }

  return { y: engine.y, cols: widths };
}

function resolveCellAlign(align: Align | undefined, rtl: boolean, fallback: Align): Align {
  if (align === "start") return rtl ? "right" : "left";
  if (align === "end") return rtl ? "left" : "right";
  return align ?? fallback;
}