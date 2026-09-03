import { PDFDocument, PDFImage, PDFPage, degrees, rgb, RGB } from "pdf-lib";
import {
  FontManager,
  sanitizeText,
  type FontStyle,
} from "./fonts";
import type { PrintFormat, PrintMargins } from "./types";

/**
 * Moteur PDF (pdf-lib) — la seule brique de rendu du système d'impression.
 *
 * - Coordonnées orientées "haut" (y décroît vers le bas), converties en
 *   coordonnées PDF (origine bas-gauche) en interne.
 * - Gestion multi-pages : en-têtes répétés (callback onPage) et pieds de
 *   page numérotés (finalisés une fois le total connu).
 * - Composition automatique du texte bilingue via le FontManager.
 */

export type Color = RGB;

export function toColor(hex: string | null | undefined, fallback: Color): Color {
  if (!hex) return fallback;
  const m = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return fallback;
  return rgb(
    parseInt(m.slice(0, 2), 16) / 255,
    parseInt(m.slice(2, 4), 16) / 255,
    parseInt(m.slice(4, 6), 16) / 255,
  );
}

export const COLORS = {
  black: rgb(0.12, 0.12, 0.12),
  white: rgb(1, 1, 1),
  gray: rgb(0.42, 0.42, 0.42),
  lightGray: rgb(0.93, 0.93, 0.93),
  lineGray: rgb(0.82, 0.82, 0.82),
  darkRed: rgb(0.72, 0.15, 0.15),
  green: rgb(0.1, 0.55, 0.25),
  amber: rgb(0.75, 0.55, 0.05),
  blue: rgb(0.1, 0.35, 0.6),
} as const;

export type Align = "left" | "center" | "right" | "start" | "end";

export interface DrawTextOptions {
  x: number;
  y: number;
  size: number;
  style?: FontStyle;
  color?: Color;
  align?: Align;
  maxWidth?: number;
}

export interface ParagraphOptions {
  x: number;
  y: number;
  size: number;
  style?: FontStyle;
  color?: Color;
  align?: Align;
  maxWidth: number;
  lineHeight?: number;
}

export interface FooterContext {
  engine: PdfEngine;
  page: PDFPage;
  pageIndex: number;
  totalPages: number;
}

export interface EngineOptions {
  format: PrintFormat;
  margins?: PrintMargins | null;
  rtl?: boolean;
  footerHeight?: number;
  /** En-tête répété sur les pages de continuation. */
  onPage?: (engine: PdfEngine, pageIndex: number) => void;
  /** Pied de page (reçoit le total en finalisation). */
  onFooter?: (ctx: FooterContext) => void;
}

const PAGE_SIZES: Record<PrintFormat, { width: number; height: number }> = {
  A4: { width: 595.28, height: 841.89 },
  A5: { width: 419.53, height: 595.28 },
  THERMAL: { width: 226.77, height: 841.89 },
};

const MM_TO_PT = 72 / 25.4;

const DEFAULT_MARGINS_MM: Record<PrintFormat, PrintMargins> = {
  A4: { top: 12, right: 12, bottom: 12, left: 12 },
  A5: { top: 10, right: 10, bottom: 10, left: 10 },
  THERMAL: { top: 6, right: 4, bottom: 6, left: 4 },
};

export function mmToPt(mm: number): number {
  return mm * MM_TO_PT;
}

export class PdfEngine {
  readonly pdfDoc: PDFDocument;
  readonly format: PrintFormat;
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly rtl: boolean;
  readonly fonts: FontManager;

  readonly marginTop: number;
  readonly marginRight: number;
  readonly marginBottom: number;
  readonly marginLeft: number;
  readonly contentLeft: number;
  readonly contentRight: number;
  readonly contentTop: number;
  readonly contentWidth: number;

  contentBottom: number;

  page: PDFPage;
  pageIndex = 0;

  /** Curseur top-based ; avance manuellement dans les templates. */
  y: number;

  private readonly onPage?: (engine: PdfEngine, pageIndex: number) => void;
  private readonly onFooter?: (ctx: FooterContext) => void;
  private readonly footers: Array<{ page: PDFPage; pageIndex: number }> = [];
  private drawingFooter = false;

  private constructor(
    pdfDoc: PDFDocument,
    fonts: FontManager,
    options: EngineOptions,
  ) {
    const size = PAGE_SIZES[options.format];
    this.pdfDoc = pdfDoc;
    this.format = options.format;
    this.pageWidth = size.width;
    this.pageHeight = size.height;
    this.rtl = options.rtl ?? false;
    this.fonts = fonts;

    const defaults = DEFAULT_MARGINS_MM[options.format];
    const m: Partial<PrintMargins> = options.margins ?? {};
    const mm = (v: number | undefined, fallback: number) =>
      mmToPt(Number.isFinite(v) ? (v as number) : fallback);
    this.marginTop = mm(m.top, defaults.top);
    this.marginRight = mm(m.right, defaults.right);
    this.marginBottom = mm(m.bottom, defaults.bottom);
    this.marginLeft = mm(m.left, defaults.left);
    this.contentLeft = this.marginLeft;
    this.contentRight = this.pageWidth - this.marginRight;
    this.contentTop = this.marginTop;
    this.contentWidth = this.contentRight - this.contentLeft;
    this.contentBottom =
      this.pageHeight - this.marginBottom - (options.footerHeight ?? 42);

    this.onPage = options.onPage;
    this.onFooter = options.onFooter;

    this.page = pdfDoc.addPage([size.width, size.height]);
    this.y = this.contentTop;
    this.footers.push({ page: this.page, pageIndex: 0 });
  }

  /** Crée le document, embarque les polices et construit le moteur. */
  static async create(options: EngineOptions): Promise<PdfEngine> {
    const pdfDoc = await PDFDocument.create();
    const fonts = new FontManager(pdfDoc);
    await fonts.load();
    return new PdfEngine(pdfDoc, fonts, options);
  }

  /** Nouvelle page : en-tête de continuation + enregistrement du pied. */
  newPage(): void {
    if (this.drawingFooter) {
      throw new Error(
        "newPage() interdite pendant la composition d'un pied de page (risque de boucle infinie)",
      );
    }
    this.pageIndex += 1;
    this.page = this.pdfDoc.addPage([this.pageWidth, this.pageHeight]);
    this.y = this.contentTop;
    this.footers.push({ page: this.page, pageIndex: this.pageIndex });
    if (this.onPage) this.onPage(this, this.pageIndex);
  }

  /** Ouvre une nouvelle page si le contenu ne tient plus. */
  ensureSpace(height: number): boolean {
    if (this.y + height > this.contentBottom) {
      this.newPage();
      return true;
    }
    return false;
  }

  get totalPages(): number {
    return this.pageIndex + 1;
  }

  // ------------------------------------------------------------- text
  private toPdfY(y: number): number {
    return this.pageHeight - y;
  }

  private resolveAlign(align: Align | undefined): Exclude<Align, "start" | "end"> {
    if (align === "start") return this.rtl ? "right" : "left";
    if (align === "end") return this.rtl ? "left" : "right";
    return align ?? (this.rtl ? "right" : "left");
  }

  lineHeight(size: number, style: FontStyle = "regular"): number {
    return size * 1.4;
  }

  /** Découpe un texte en lignes (sur l'ordre logique, avant composition). */
  wrap(
    text: string,
    style: FontStyle,
    size: number,
    maxWidth: number,
  ): string[] {
    const clean = sanitizeText(text).trim();
    if (!clean) return [""];
    const words = clean.split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (this.fonts.measureText(candidate, style, size).width > maxWidth) {
        if (current) lines.push(current);
        const wordWidth = this.fonts.measureText(word, style, size).width;
        if (wordWidth > maxWidth) {
          // Mot plus large que la colonne : coupe au caractère.
          let segment = "";
          for (const ch of Array.from(word)) {
            const test = segment + ch;
            if (
              segment &&
              this.fonts.measureText(test, style, size).width > maxWidth
            ) {
              lines.push(segment);
              segment = ch;
            } else {
              segment = test;
            }
          }
          current = segment;
        } else {
          current = word;
        }
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  /** Largeur d'un texte une fois composé. */
  measure(text: string, style: FontStyle, size: number): number {
    return this.fonts.measureText(text, style, size).width;
  }

  /**
   * Dessine une ou plusieurs lignes (wrap si maxWidth). Les templates gèrent
   * les ruptures de page. Retourne le nombre de lignes dessinées.
   */
  drawText(
    text: string,
    options: DrawTextOptions,
  ): number {
    const { x, y, size, style = "regular", color = COLORS.black, align, maxWidth } = options;
    const clean = sanitizeText(text);
    const alignResolved = this.resolveAlign(align);
    const lines = maxWidth
      ? this.wrap(clean, style, size, maxWidth)
      : [clean];
    const lineH = this.lineHeight(size, style);
    for (let i = 0; i < lines.length; i++) {
      const runs = this.fonts.splitRuns(lines[i], style);
      let width = 0;
      for (const run of runs) width += run.font.widthOfTextAtSize(run.text, size);
      let startX = x;
      if (alignResolved === "right") startX = x - width;
      else if (alignResolved === "center") startX = x - width / 2;
      let offset = 0;
      for (const run of runs) {
        const baseline =
          y + i * lineH + this.fonts.ascentFactor(run.script) * size;
        this.page.drawText(run.text, {
          x: startX + offset,
          y: this.toPdfY(baseline),
          size,
          font: run.font,
          color,
        });
        offset += run.font.widthOfTextAtSize(run.text, size);
      }
    }
    return lines.length;
  }

  /**
   * Paragraphe avec retour à la ligne et ruptures de page automatiques.
   * Fait avancer le curseur du moteur. Retourne le nouveau y.
   */
  drawParagraph(
    text: string,
    options: ParagraphOptions,
  ): number {
    const {
      x,
      y,
      size,
      style = "regular",
      color = COLORS.black,
      align,
      maxWidth,
      lineHeight: lineH,
    } = options;
    const clean = sanitizeText(text);
    const lh = lineH ?? this.lineHeight(size, style);
    const lines = this.wrap(clean, style, size, maxWidth);
    if (lines.length === 0) return y;
    let cursor = y;
    this.y = y;
    for (const line of lines) {
      if (this.y + lh > this.contentBottom) {
        this.newPage();
        cursor = this.y;
      }
      this.drawText(line, { x, y: cursor, size, style, color, align, maxWidth });
      cursor += lh;
      this.y = cursor;
    }
    return cursor;
  }

  // ----------------------------------------------------------- shapes
  drawLine(x1: number, y1: number, x2: number, y2: number, options?: {
    thickness?: number;
    color?: Color;
  }): void {
    this.page.drawLine({
      start: { x: x1, y: this.toPdfY(y1) },
      end: { x: x2, y: this.toPdfY(y2) },
      thickness: options?.thickness ?? 0.6,
      color: options?.color ?? COLORS.lineGray,
    });
  }

  drawRect(x: number, y: number, w: number, h: number, options?: {
    fill?: Color;
    border?: Color;
    borderWidth?: number;
  }): void {
    const pdfY = this.toPdfY(y + h);
    this.page.drawRectangle({
      x,
      y: pdfY,
      width: w,
      height: h,
      color: options?.fill,
      borderColor: options?.border,
      borderWidth: options?.borderWidth ?? (options?.border ? 0.6 : 0),
    });
  }

  fillRect(x: number, y: number, w: number, h: number, color: Color): void {
    this.page.drawRectangle({ x, y: this.toPdfY(y + h), width: w, height: h, color });
  }

  // ----------------------------------------------------------- images
  /**
   * Tampon diagonal (BROUILLON / ANNULÉ / PAYÉ). x,y = centre du tampon.
   */
  stampText(text: string, options: {
    x: number;
    y: number;
    size: number;
    style?: FontStyle;
    color?: Color;
    rotateDeg?: number;
    opacity?: number;
  }): void {
    const { x, y, size, style = "bold", color = COLORS.gray, rotateDeg = 0, opacity } = options;
    const runs = this.fonts.splitRuns(text, style);
    let width = 0;
    for (const run of runs) width += run.font.widthOfTextAtSize(run.text, size);
    const baseline = y + this.fonts.ascentFactor("latin") * size;
    let offset = -width / 2;
    for (const run of runs) {
      this.page.drawText(run.text, {
        x: x + offset,
        y: this.toPdfY(baseline),
        size,
        font: run.font,
        color,
        rotate: degrees(rotateDeg),
        opacity,
      });
      offset += run.font.widthOfTextAtSize(run.text, size);
    }
  }

  async embedImage(
    buffer: Uint8Array,
    mimeType: string | null,
  ): Promise<PDFImage | null> {
    const mime = (mimeType ?? "").toLowerCase();
    try {
      if (mime === "image/png") return await this.pdfDoc.embedPng(buffer);
      if (mime === "image/jpeg" || mime === "image/jpg")
        return await this.pdfDoc.embedJpg(buffer);
      return null;
    } catch {
      // Image corrompue ou format inattendu : on ignore plutôt que de faire
      // échouer tout le rendu (comportement tolérant, comme l'image manquante).
      return null;
    }
  }

  /** Dessine une image en préservant le ratio. Retourne la taille dessinée. */
  drawImage(
    image: PDFImage,
    x: number,
    y: number,
    options?: { maxWidth?: number; maxHeight?: number },
  ): { width: number; height: number } {
    const ratio = image.width / image.height;
    let width = options?.maxWidth ?? image.width;
    let height = width / ratio;
    if (options?.maxHeight && height > options.maxHeight) {
      height = options.maxHeight;
      width = height * ratio;
    }
    this.page.drawImage(image, {
      x,
      y: this.toPdfY(y + height),
      width,
      height,
    });
    return { width, height };
  }

  /** Applique un dessin sur une page précise (pieds de page). */
  drawOn(page: PDFPage, fn: () => void): void {
    const previous = this.page;
    this.page = page;
    try {
      fn();
    } finally {
      this.page = previous;
    }
  }

  async finalize(): Promise<Uint8Array> {
    const totalPages = this.totalPages;
    for (const { page, pageIndex } of this.footers) {
      if (this.onFooter) {
        this.drawingFooter = true;
        try {
          this.drawOn(page, () =>
            this.onFooter!({ engine: this, page, pageIndex, totalPages }),
          );
        } finally {
          this.drawingFooter = false;
        }
      }
    }
    return this.pdfDoc.save({ useObjectStreams: false });
  }
}
