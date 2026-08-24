import { createTranslator, getDictionary } from "@/i18n";
import type { Locale } from "@/lib/constants";
import { getDocConfig } from "@/features/documents/engine/config";
import type { CommercialDocType } from "@/features/documents/engine/types";
import { resolveDocType } from "@/features/documents/engine/resolve";
import { assertFontsAvailable } from "./fonts";
import { mapToPrintableDocument } from "./map-document";
import { PdfEngine } from "./renderer";
import { getPrintConfig } from "./registry";
import {
  createFooter,
  createRunningHeader,
  renderPrintableDocument,
  type PrintLabels,
} from "./templates";

/**
 * Service d'impression — orchestration : résolution du document → mapping DTO
 * → labels localisés → moteur PDF → octets. Identique pour Preview, Print et
 * Download (même rendu garanti).
 */

export interface PrintResult {
  pdf: Uint8Array;
  contentType: string;
  filename: string;
  docType: CommercialDocType;
  number: string;
  format: "A4" | "A5" | "THERMAL";
}

export interface PrintDocumentParams {
  docId: string;
  companyId: string;
  locale?: Locale;
}

async function resolveLocale(_hint: Locale | undefined): Promise<Locale> {
  // DzERP documents render in French only (Arabic shaping is disabled to avoid
  // broken ligatures/connectivity in the generated PDFs). French is the
  // validated, fully-supported print language.
  void _hint;
  return "fr";
}

export async function printDocument(params: PrintDocumentParams): Promise<PrintResult> {
  const { docId, companyId, locale: localeHint } = params;

  const docType = await resolveDocType(docId, companyId);
  if (!docType) {
    throw new Error("Document introuvable ou hors de la société active.");
  }

  const locale = await resolveLocale(localeHint);
  assertFontsAvailable();

  const doc = await mapToPrintableDocument(docType, docId, companyId);
  const labels = buildLabels(locale, docType, doc);

  const engine = await PdfEngine.create({
    format: doc.company.printFormat,
    margins: doc.company.printMargins ?? undefined,
    rtl: false,
    onPage: createRunningHeader(doc, labels),
    onFooter: createFooter(doc, labels),
  });

  await renderPrintableDocument(engine, doc, labels, locale);
  const pdf = await engine.finalize();

  const config = getDocConfig(docType);
  const safeNumber = doc.document.number.replace(/[^A-Za-z0-9._-]+/g, "-");
  return {
    pdf,
    contentType: "application/pdf",
    filename: `${config.numberPrefix}-${safeNumber}.pdf`,
    docType,
    number: doc.document.number,
    format: doc.company.printFormat,
  };
}

export function buildLabels(
  locale: Locale,
  docType: CommercialDocType,
  doc: Awaited<ReturnType<typeof mapToPrintableDocument>>,
): PrintLabels {
  const dict = getDictionary(locale);
  const t = createTranslator(dict);
  const printConfig = getPrintConfig(docType);

  return {
    ...dict.print,
    docType: t(`docTypes.${docType}`),
    party: t(printConfig.partyLabelKey),
    statusLabel: t(`status.${doc.document.status}`),
    paymentStatusLabel: doc.document.paymentStatus
      ? t(`status.${doc.document.paymentStatus}`)
      : "",
    priorityLabel: t("print.priority"),
  };
}
