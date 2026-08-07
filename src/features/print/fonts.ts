import fs from "node:fs";
import path from "node:path";
import { PDFDocument, PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { shapeArabicText, shapeArabicVisual } from "naqqash";

/**
 * FontManager — chargement centralisé des polices d'impression.
 *
 * - Polices stockées dans `assets/fonts/` (TTF, embarquables via fontkit).
 * - Jamais de Helvetica/WinAnsi pour le texte arabe.
 * - Embedding une seule fois par document PDF, réutilisé par tous les templates.
 * - Les templates ne demandent que des styles (regular/bold/italic/...),
 *   le FontManager résout le fichier réel selon le script du texte.
 *
 * Sources (licences librement redistribuables) :
 *   - Amiri (OFL-1.1) — arabe Naskh, couvre aussi le latin.
 *   - Inter (OFL-1.1) — latin, conçu pour l'UI/les documents.
 */

export type FontStyle = "regular" | "bold" | "italic" | "boldItalic";
export type FontScript = "latin" | "arabic";

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");

interface FontFile {
  file: string;
  weight: number;
  italic: boolean;
}

const LATIN_FONTS: Record<FontStyle, FontFile> = {
  regular: { file: "Inter-Regular.ttf", weight: 400, italic: false },
  bold: { file: "Inter-Bold.ttf", weight: 700, italic: false },
  italic: { file: "Inter-Italic.ttf", weight: 400, italic: true },
  boldItalic: { file: "Inter-BoldItalic.ttf", weight: 700, italic: true },
};

const ARABIC_FONTS: Record<FontStyle, FontFile> = {
  regular: { file: "Amiri-Regular.ttf", weight: 400, italic: false },
  bold: { file: "Amiri-Bold.ttf", weight: 700, italic: false },
  // L'italique n'existe pas en écriture arabe : repli sur la graisse seule.
  italic: { file: "Amiri-Regular.ttf", weight: 400, italic: false },
  boldItalic: { file: "Amiri-Bold.ttf", weight: 700, italic: false },
};

const ARABIC_FONT_NAMES = new Set(
  Object.values(ARABIC_FONTS).map((f) => f.file),
);

const ARABIC_BLOCK_RE =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

const fileCache = new Map<string, Uint8Array>();

function readFontBytes(file: string): Uint8Array {
  let bytes = fileCache.get(file);
  if (!bytes) {
    bytes = fs.readFileSync(path.join(FONT_DIR, file));
    fileCache.set(file, bytes);
  }
  return bytes;
}

/** Nettoyage des caractères de contrôle qui cassent l'encodage PDF. */
export function sanitizeText(text: string): string {
  return text
    .replace(/\u0000/g, " ")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r/g, "");
}

export function hasArabicScript(text: string): boolean {
  return ARABIC_BLOCK_RE.test(text);
}

export function isArabicChar(codePoint: number): boolean {
  return ARABIC_BLOCK_RE.test(String.fromCodePoint(codePoint));
}

/** Formes contextuelles (ordre logique) — pour mesure et test. */
export function shapeArabic(text: string): string {
  return shapeArabicText(sanitizeText(text));
}

/** Formes contextuelles + ordre visuel (prêt pour rendu LTR). */
export function shapeArabicForRender(text: string): string {
  return shapeArabicVisual(sanitizeText(text));
}

/**
 * FontManager — instance par document PDF. Toutes les polices sont embarquées
 * une seule fois à la création (`load()`) et réutilisées pour tous les
 * templates ; les octets bruts sont mis en cache au niveau module.
 */
export class FontManager {
  private readonly doc: PDFDocument;
  private readonly embedded = new Map<string, PDFFont>();

  constructor(doc: PDFDocument) {
    this.doc = doc;
  }

  /** Embarque toutes les variantes (latin + arabe) — un appel par rendu. */
  async load(): Promise<void> {
    this.doc.registerFontkit(fontkit);
    const files = new Set(
      [...Object.values(LATIN_FONTS), ...Object.values(ARABIC_FONTS)].map(
        (f) => f.file,
      ),
    );
    for (const file of files) {
      if (!this.embedded.has(file)) {
        this.embedded.set(file, await this.doc.embedFont(readFontBytes(file)));
      }
    }
  }

  getFont(script: FontScript, style: FontStyle): PDFFont {
    const table = script === "arabic" ? ARABIC_FONTS : LATIN_FONTS;
    const entry = table[style] ?? table.regular;
    const font = this.embedded.get(entry.file);
    if (!font) {
      throw new Error(`Police non embarquée : ${entry.file}`);
    }
    return font;
  }

  /**
   * Découpe un texte en séquences (police, texte) : le texte arabe est
   * composé avec la police arabe (formes contextuelles + ordre visuel),
   * le reste avec la police latine. Permet les documents bilingues.
   */
  splitRuns(
    text: string,
    style: FontStyle,
  ): Array<{ font: PDFFont; text: string; script: FontScript }> {
    const clean = sanitizeText(text);
    if (!hasArabicScript(clean)) {
      return [{ font: this.getFont("latin", style), text: clean, script: "latin" }];
    }
    const visual = shapeArabicForRender(clean);
    const runs: Array<{ font: PDFFont; text: string; script: FontScript }> = [];
    let current = "";
    let currentScript: FontScript | null = null;
    for (const ch of visual) {
      const script: FontScript = isArabicChar(ch.codePointAt(0) ?? 0)
        ? "arabic"
        : "latin";
      if (currentScript !== null && script !== currentScript) {
        runs.push({
          font: this.getFont(currentScript, style),
          text: current,
          script: currentScript,
        });
        current = "";
      }
      current += ch;
      currentScript = script;
    }
    if (current && currentScript !== null) {
      runs.push({
        font: this.getFont(currentScript, style),
        text: current,
        script: currentScript,
      });
    }
    return runs;
  }

  /** Largeur totale d'un texte une fois composé (forme + polices réelles). */
  measureText(
    text: string,
    style: FontStyle,
    size: number,
  ): { width: number; runs: Array<{ font: PDFFont; text: string; script: FontScript }> } {
    const runs = this.splitRuns(text, style);
    let width = 0;
    for (const run of runs) {
      width += run.font.widthOfTextAtSize(run.text, size);
    }
    return { width, runs };
  }

  /**
   * Approximations d'ascender pour ancrer le texte sur une ligne "top".
   * (pdf-lib n'expose pas les métriques brutes des polices embarquées.)
   */
  ascentFactor(script: FontScript): number {
    // L'amiri (Naskh) a des hampes plus hautes que l'Inter.
    return script === "arabic" ? 0.85 : 0.77;
  }
}

/** Sécurité : les polices doivent exister avant tout rendu. */
export function assertFontsAvailable(): void {
  const files = [
    ...new Set([...Object.values(LATIN_FONTS), ...Object.values(ARABIC_FONTS)].map((f) => f.file)),
  ];
  for (const file of files) {
    if (!fs.existsSync(path.join(FONT_DIR, file))) {
      throw new Error(`Police d'impression manquante : ${file}`);
    }
  }
}

export { fontkit };
