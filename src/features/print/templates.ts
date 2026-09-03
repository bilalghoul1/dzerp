import type { DocumentStatus } from "@/generated/prisma/enums";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/lib/constants";
import { amountToWords, formatAmount, formatDate, formatQuantity, formatRate } from "./format";
import type { PrintTypeConfig } from "./registry";
import { getPrintConfig } from "./registry";
import { rgb } from "pdf-lib";
import { COLORS, toColor, type Align, type Color, type PdfEngine } from "./renderer";
import { drawTable, type TableColumn } from "./table";
import type { PrintableDocument, PrintFormat } from "./types";

/**
 * Templates d'impression — mise en page des 9 documents commerciaux (plus un
 * rendu générique via le registre). Les templates ne connaissent QUE le DTO
 * `PrintableDocument` : aucune requête Prisma ici.
 */

export type PrintLabels = Dictionary["print"] & {
  docType: string;
  party: string;
  issuer: string;
  statusLabel: string;
  paymentStatusLabel: string;
  priorityLabel: string;
  customerOrderNumber: string;
  customerOrderDate: string;
  issuerStamp: string;
  clientLabel: string;
};

interface TemplateCtx {
  engine: PdfEngine;
  doc: PrintableDocument;
  labels: PrintLabels;
  locale: Locale;
  config: PrintTypeConfig;
}

interface LayoutParams {
  titleSize: number;
  bodySize: number;
  tableSize: number;
  nameSize: number;
  sectionSize: number;
  gap: number;
  colWidth: number;
  logoMaxH: number;
  metaWidth: number;
  titleSizeStamp: number;
  /** Hauteur du bandeau d'en-tête (banner) sur la première page. */
  bannerH: number;
}

function layout(format: PrintFormat): LayoutParams {
  switch (format) {
    case "A5":
      return {
        titleSize: 13, bodySize: 8, tableSize: 7.5, nameSize: 11,
        sectionSize: 8.5, gap: 6, colWidth: 130, logoMaxH: 42, metaWidth: 0.45, titleSizeStamp: 26,
        bannerH: 30,
      };
    case "THERMAL":
      return {
        titleSize: 11, bodySize: 7.5, tableSize: 7, nameSize: 10,
        sectionSize: 8, gap: 4, colWidth: 90, logoMaxH: 30, metaWidth: 0.55, titleSizeStamp: 20,
        bannerH: 24,
      };
    default:
      return {
        titleSize: 15, bodySize: 8.5, tableSize: 8, nameSize: 12,
        sectionSize: 9.5, gap: 8, colWidth: 210, logoMaxH: 52, metaWidth: 0.42, titleSizeStamp: 34,
        bannerH: 38,
      };
  }
}

function statusColor(status: DocumentStatus): Color {
  switch (status) {
    case "CANCELLED":
    case "REJECTED":
      return COLORS.darkRed;
    case "APPROVED":
    case "CONFIRMED":
    case "PROCESSED":
    case "CLOSED":
    case "VALIDATED":
      return COLORS.green;
    case "PENDING":
    case "PENDING_APPROVAL":
    case "PARTIALLY_PROCESSED":
      return COLORS.amber;
    case "DRAFT":
      return COLORS.gray;
    default:
      return COLORS.blue;
  }
}

function joinParts(parts: Array<string | null | undefined>): string {
  return parts.filter((p): p is string => !!p && p.trim().length > 0).join(" • ");
}

/**
 * Nom d'affichage de la société : en demande arabe, on préfère le nom arabe
 * (nameAr) s'il est renseigné, sinon repli sur le nom principal. Les demandes
 * fr/en utilisent toujours le nom principal.
 */
function companyName(doc: PrintableDocument, locale: Locale): string {
  return locale === "ar" && doc.company.nameAr
    ? doc.company.nameAr
    : doc.company.name;
}

function brand(ctx: TemplateCtx): Color {
  return toColor(ctx.doc.company.primaryColor, COLORS.black);
}

/** Mélange une couleur avec du blanc (factor 0..1) pour un fond "teinté". */
function tint(color: Color, factor: number): Color {
  return rgb(
    color.red + (1 - color.red) * factor,
    color.green + (1 - color.green) * factor,
    color.blue + (1 - color.blue) * factor,
  );
}

/** Compte le nombre de lignes visuelles qu'occupent les champs "Label : Valeur". */
function countFieldLines(
  engine: PdfEngine,
  fields: Array<{ label: string; value: string }>,
  labelColW: number,
  bodySize: number,
  cardW: number,
): number {
  let count = 0;
  for (const f of fields) {
    const valMaxW = cardW - 8 - labelColW - 4;
    const valLines = engine.wrap(f.value, "regular", bodySize, valMaxW);
    count += Math.max(valLines.length, 1);
  }
  return count;
}

// ---------------------------------------------------------------------------
// En-tête : identité société + logo + titre + statut + méta + contrepartie
// ---------------------------------------------------------------------------

async function drawHeader(ctx: TemplateCtx): Promise<void> {
  const { engine, doc, labels } = ctx;
  const P = layout(engine.format);
  const right = engine.contentRight;
  const pageTop = engine.y;
  const brandColor = brand(ctx);
  const rtl = engine.rtl;

  // ---- Bandeau d'en-tête (banner) : nom société + type de document ----
  const bannerH = P.bannerH;
  engine.ensureSpace(bannerH + 4);
  engine.fillRect(engine.contentLeft, pageTop, engine.contentWidth, bannerH, brandColor);

  const bannerTextColor = COLORS.white;
  // En RTL l'identité est ancrée à droite du bandeau (miroir), sinon à gauche.
  const nameX = rtl ? engine.contentRight - 10 : engine.contentLeft + 12;
  engine.drawText(companyName(doc, ctx.locale), {
    x: nameX,
    y: pageTop + (bannerH - P.nameSize) / 2,
    size: P.nameSize, style: "bold", color: bannerTextColor,
    align: rtl ? "right" : "left", maxWidth: engine.contentWidth * 0.5,
  });
  const titleX = rtl ? engine.contentLeft : right;
  const titleAlign: Align = rtl ? "left" : "right";
  // Cadre du titre du document : discret, en dégradé du CX sur le bandeau.
  const titleLabel = labels.docType;
  const titleSize = P.titleSize;
  const titleW = engine.measure(titleLabel, "bold", titleSize) + 16;
  const titleBoxH = titleSize + 10;
  const titleBoxX = rtl ? engine.contentLeft + 8 : right - 8 - titleW;
  engine.fillRect(titleBoxX, pageTop + (bannerH - titleBoxH) / 2, titleW, titleBoxH, COLORS.black);
  engine.drawText(titleLabel, {
    x: titleBoxX + titleW / 2, y: pageTop + (bannerH - titleSize) / 2,
    size: titleSize, style: "bold", color: bannerTextColor, align: "center",
  });
  engine.y = pageTop + bannerH + P.gap;

  // ---- Identité société (logo) sous le bandeau ----
  let logoBottom = engine.y;
  const companyX = rtl ? right - Math.min(260, engine.contentWidth * 0.5) : engine.contentLeft;
  if (doc.branding.logo) {
    engine.ensureSpace(P.logoMaxH + 8 + P.gap);
    const img = await engine.embedImage(doc.branding.logo, doc.branding.logoMimeType);
    if (img) {
      const box = engine.drawImage(img, companyX, engine.y, {
        maxWidth: 140,
        maxHeight: P.logoMaxH + 8,
      });
      logoBottom = engine.y + box.height;
    }
  }

  const companyBottom = logoBottom;

  // ---- Référence + statut sous le bandeau ----
  let ty = Math.max(companyBottom, engine.y);
  const refX = rtl ? engine.contentLeft : right;
  const refAlign: Align = rtl ? "left" : "right";
  engine.drawText(`${labels.ref} ${doc.document.number}`, {
    x: refX, y: ty, size: P.bodySize + 1, style: "bold", align: refAlign,
  });
  ty += (P.bodySize + 1) * 1.5;

  const chipW = engine.measure(labels.statusLabel, "bold", P.bodySize) + 10;
  const chipH = P.bodySize * 1.9;
  const chipX = rtl ? engine.contentLeft : right - chipW;
  engine.fillRect(chipX, ty, chipW, chipH, statusColor(doc.document.status));
  engine.drawText(labels.statusLabel, {
    x: chipX + chipW / 2, y: ty + (chipH - P.bodySize) / 2,
    size: P.bodySize, style: "bold", color: COLORS.white, align: "center",
  });
  const titleBottom = ty + chipH + P.gap;

  // ---- Méta (droite) + contrepartie (gauche) ----
  const blockTop = Math.max(companyBottom, titleBottom);
  const metaWidth = engine.contentWidth * P.metaWidth;

  let metaY = blockTop;
  const lineH = P.bodySize * 1.3;
  // Ensure space for at least 4 meta rows
  engine.ensureSpace(lineH * 4 + P.gap);
  const metaRows: Array<[string, string | null]> = [
    [labels.date, formatDate(doc.document.issuedAt, ctx.locale)],
    [labels.validUntil, ctx.config.showValidUntil ? formatDate(doc.document.validUntil, ctx.locale) : null],
    [labels.dueDate, ctx.config.showDueDate ? formatDate(doc.document.dueDate, ctx.locale) : null],
    [labels.deliveryDate, ctx.config.showDeliveryDate ? formatDate(doc.document.deliveryDate, ctx.locale) : null],
    [labels.shippedAt, ctx.config.showShippedAt ? formatDate(doc.document.shippedAt, ctx.locale) : null],
    [labels.receivedAt, ctx.config.showReceivedAt ? formatDate(doc.document.receivedAt, ctx.locale) : null],
    [labels.neededAt, ctx.config.showNeededAt ? formatDate(doc.document.neededAt, ctx.locale) : null],
    [labels.priority, ctx.config.showPriority ? doc.document.priority ?? null : null],
    [labels.paymentStatus, ctx.config.hasPayment && doc.document.paymentStatus ? labels.paymentStatusLabel : null],
    [labels.paymentMethod, ctx.config.hasPayment ? doc.document.paymentMethod : null],
    [labels.branch, doc.branch.name ? joinParts([doc.branch.name, doc.branch.code]) : null],
    [labels.issuedBy, doc.document.issuedBy],
    ...(doc.document.docType === "CUSTOMER_ORDER"
      ? ([
          [labels.customerOrderNumber, (doc.document.meta?.["customerOrderNumber"] as string) ?? null] as [string, string | null],
          [labels.customerOrderDate, doc.document.meta?.["customerOrderDate"] ? formatDate(String(doc.document.meta["customerOrderDate"]), ctx.locale) : null] as [string, string | null],
        ])
      : []),
  ];
  for (const [label, value] of metaRows) {
    if (!value) continue;
    engine.drawText(`${label} : ${value}`, {
      x: titleX, y: metaY, size: P.bodySize, align: titleAlign, maxWidth: metaWidth,
    });
    metaY += lineH;
  }

  // ---- Cartes côte-à-côte : Émetteur (fournisseur) + Client ----
  const cardGap = P.gap;
  const cardW = (engine.contentWidth - cardGap) / 2;
  const party = doc.party;
  const cardTop = metaY;
  const cardTitleH = P.sectionSize * 1.15;
  // ---- Champs (Labels & Values) des cartes Émetteur / Client ----
  // Chaque champ est rendu sur sa propre ligne "Label" puis "Valeur", au lieu
  // d'une unique phrase — la fiche devient lisible et structurée ("Labels &
  // Values") plutôt qu'un simple paragraphe.
  type CardField = { label: string; value: string };

  const addressOf = (s: { address?: string | null; commune?: string | null; wilaya?: string | null }) =>
    joinParts([s.address, s.commune, s.wilaya]);

  const legalFields = (s: { rc?: string | null; taxId?: string | null; nis?: string | null; ai?: string | null; vatNumber?: string | null }): CardField[] =>
    ([
      [labels.rc, s.rc],
      [labels.taxId, s.taxId],
      [labels.nis, s.nis],
      [labels.ai, s.ai],
      [labels.vatNumber, s.vatNumber],
    ] as Array<[string, string | null | undefined]>)
      .filter(([, v]) => !!v)
      .map(([label, v]) => ({ label, value: String(v) }));

  const emitForm = joinParts([
    doc.company.legalForm,
    doc.company.capital ? `${labels.capital} ${doc.company.capital}` : null,
  ]);
  const emitAddress = addressOf(doc.company);
  const emitName = companyName(doc, ctx.locale);

  const emitFields: CardField[] = [
    ...(emitForm ? [{ label: labels.legalForm, value: emitForm }] : []),
    ...legalFields(doc.company),
    ...(emitAddress ? [{ label: labels.address, value: emitAddress }] : []),
    ...(doc.company.phone ? [{ label: labels.phone, value: doc.company.phone }] : []),
    ...(doc.company.email ? [{ label: labels.email, value: doc.company.email }] : []),
  ];

  let clientFields: CardField[] = [];
  if (party) {
    const cAddress = addressOf(party);
    clientFields = [
      ...legalFields(party),
      ...(cAddress ? [{ label: labels.address, value: cAddress }] : []),
      ...(party.phone ? [{ label: labels.phone, value: party.phone }] : []),
      ...(party.email ? [{ label: labels.email, value: party.email }] : []),
    ];
  }

  // Largeur de la colonne "Label" : fixe pour aligner toutes les "Valeur".
  const labelColW = Math.min(
    cardW * 0.32,
    Math.ceil(engine.measure(labels.taxId, "regular", P.bodySize) + 4),
  );
  // Lignes de champ compactes (1.0×) pour laisser de la place au corps.
  const fieldLineH = P.bodySize;
  // Nom / sous-titre slightly larger for readability.
  const nameLineH = (P.bodySize + 1.5) * 1.3;

  // Hauteurs estimées alignées : nom (1) + activité (0-1) + champs.
  const emitNameLines = engine.wrap(emitName, "bold", P.bodySize + 1.5, cardW - 12).length;
  const activityLines = doc.company.activity ? engine.wrap(doc.company.activity, "regular", P.bodySize, cardW - 12).length : 0;
  const emitFieldLineCount = countFieldLines(engine, emitFields, labelColW, P.bodySize, cardW);
  const clientFieldLineCount = countFieldLines(engine, clientFields, labelColW, P.bodySize, cardW);
  const fieldCount = Math.max(emitFieldLineCount, clientFieldLineCount);

  const cardBodyH =
    Math.max(emitNameLines, 1) * nameLineH
    + activityLines * fieldLineH
    + fieldCount * fieldLineH
    + P.gap;
  const cardH = cardTitleH + cardBodyH;

  engine.ensureSpace(cardH + P.gap);

  const drawCard = (
    x: number,
    title: string,
    name: string,
    subtitle: string | null,
    fields: CardField[],
  ) => {
    engine.drawRect(x, cardTop, cardW, cardH, {
      border: COLORS.lineGray,
      borderWidth: 0.7,
      fill: COLORS.white,
    });
    // Bande de titre discrète : fond "teinté" clair + filet d'accent en tête.
    engine.fillRect(x, cardTop, cardW, cardTitleH, tint(brandColor, 0.93));
    engine.fillRect(x, cardTop, 3.5, cardTitleH, brandColor);
    engine.drawText(title, {
      x: x + (rtl ? cardW - 8 : 8), y: cardTop + (cardTitleH - P.sectionSize) / 2, size: P.sectionSize,
      style: "bold", color: COLORS.black,
      maxWidth: cardW - 14,
    });

    let ly = cardTop + cardTitleH + 4;
    // Nom de la partie (mise en avant, gras).
    for (const w of engine.wrap(name, "bold", P.bodySize + 1.5, cardW - 12)) {
      engine.drawText(w, { x: x + 8, y: ly, size: P.bodySize + 1.5, style: "bold", color: COLORS.black, maxWidth: cardW - 12 });
      ly += nameLineH;
    }
    // Activité / sous-titre (gris, corps standard).
    if (subtitle) {
      for (const w of engine.wrap(subtitle, "regular", P.bodySize, cardW - 12)) {
        engine.drawText(w, { x: x + 8, y: ly, size: P.bodySize, color: COLORS.gray, maxWidth: cardW - 12 });
        ly += fieldLineH;
      }
    }
    // Champs "Label : Valeur" — chaque champ sur sa propre ligne.
    for (const f of fields) {
      engine.drawText(`${f.label}:`, { x: x + 8, y: ly, size: P.bodySize, style: "bold", color: COLORS.gray, maxWidth: labelColW });
      const valLines = engine.wrap(f.value, "regular", P.bodySize, cardW - 8 - labelColW - 4);
      for (const v of valLines) {
        engine.drawText(v, { x: x + 8 + labelColW + 4, y: ly, size: P.bodySize, color: COLORS.black, maxWidth: cardW - 8 - labelColW - 4 });
        ly += fieldLineH;
      }
    }
  };

  drawCard(
    rtl ? engine.contentRight - cardW : engine.contentLeft,
    labels.issuer, emitName, doc.company.activity ?? null, emitFields,
  );
  if (party) {
    drawCard(
      rtl ? engine.contentLeft : engine.contentRight - cardW,
      labels.party, party.name, null, clientFields,
    );
  }

  let partyY = cardTop + cardH;
  if (doc.branch.name) {
    partyY += P.gap;
    engine.ensureSpace(P.bodySize * 3 + P.gap);
    engine.drawText(labels.branch, {
      x: rtl ? engine.contentRight : engine.contentLeft, y: partyY, size: P.bodySize, style: "bold", color: COLORS.gray,
    });
    partyY += P.bodySize * 1.4;
    const branchLine = joinParts([
      doc.branch.name,
      doc.branch.address,
      doc.branch.commune,
      doc.branch.wilaya,
      doc.branch.manager ? `${labels.manager} : ${doc.branch.manager}` : null,
    ]);
    const wrapped = engine.wrap(branchLine, "regular", P.bodySize, engine.contentWidth);
    const bLineH = P.bodySize * 1.4;
    for (const w of wrapped) {
      engine.drawText(w, {
        x: rtl ? engine.contentRight : engine.contentLeft, y: partyY, size: P.bodySize, color: COLORS.gray, maxWidth: engine.contentWidth,
      });
      partyY += bLineH;
    }
  }

  const headerBottom = Math.max(metaY, partyY);
  engine.y = headerBottom + P.gap;
  engine.drawLine(engine.contentLeft, engine.y - P.gap / 2, right, engine.y - P.gap / 2, {
    thickness: 1.1,
    color: brandColor,
  });

  if (doc.company.printHeader) {
    engine.y = engine.drawParagraph(doc.company.printHeader, {
      x: rtl ? engine.contentRight : engine.contentLeft, y: engine.y, size: P.bodySize, color: COLORS.gray,
      align: "start", maxWidth: engine.contentWidth,
    });
    engine.y += P.gap;
  }
}

// ---------------------------------------------------------------------------
// Lignes
// ---------------------------------------------------------------------------

function lineColumns(ctx: TemplateCtx): TableColumn[] {
  const { engine, doc, labels, locale } = ctx;
  const P = layout(engine.format);
  const currency = doc.document.currency;
  const w = engine.contentWidth;
  const amountW = () =>
    engine.measure(formatAmount(0, locale, currency), "regular", P.tableSize) + 8;

  if (engine.format === "THERMAL") {
    const priceW = amountW();
    const fixed = 14 + 24 + priceW + priceW + 24;
    return [
      { key: "n", label: "#", width: 14, align: "right" },
      { key: "desc", label: labels.description, width: Math.max(40, w - fixed), align: "start" },
      { key: "price", label: labels.unitPriceHt, width: priceW, align: "right" },
      { key: "qty", label: labels.quantity, width: 24, align: "right" },
      { key: "tax", label: labels.tax, width: 24, align: "right" },
      { key: "ht", label: labels.lineTotalHt, width: priceW, align: "right", style: "bold" },
    ];
  }

  if (engine.format === "A5") {
    const priceW = amountW();
    const fixed = 16 + 30 + priceW + priceW + 24 + priceW;
    return [
      { key: "n", label: "#", width: 16, align: "right" },
      { key: "desc", label: labels.description, width: Math.max(50, w - fixed), align: "start" },
      { key: "price", label: labels.unitPriceHt, width: priceW, align: "right" },
      { key: "qty", label: labels.quantity, width: 30, align: "right" },
      { key: "tax", label: labels.tax, width: 24, align: "right" },
      { key: "ht", label: labels.lineTotalHt, width: priceW, align: "right", style: "bold" },
    ];
  }

  let priceW = Math.max(
    amountW(),
    engine.measure(formatAmount(0, locale, currency), "bold", P.tableSize),
  ) + 12;
  const qtyW = Math.max(30, engine.measure(labels.quantity, "regular", P.tableSize) + 6);
  const taxW = Math.max(24, engine.measure(labels.tax, "regular", P.tableSize) + 4);
  // A4 : deux colonnes de montants (Total HT + Total TTC) pour un rendu pro.
  // On garantit une colonne "désignation" lisible : on compresse si besoin.
  let fixed = 20 + qtyW + priceW * 3 + taxW + priceW;
  const minDesc = 70;
  let descW = w - fixed;
  if (descW < minDesc) {
    // Repasse la colonne HT à une largeur "compacte" pour libérer de la place.
    priceW = Math.max(amountW(), 48);
    fixed = 20 + qtyW + priceW * 3 + taxW + priceW;
    descW = w - fixed;
  }
  return [
    { key: "n", label: "#", width: 20, align: "right" },
    { key: "desc", label: labels.description, width: Math.max(minDesc, descW), align: "start" },
    { key: "price", label: labels.unitPriceHt, width: priceW, align: "right" },
    { key: "qty", label: labels.quantity, width: qtyW, align: "right" },
    { key: "tax", label: labels.tax, width: taxW, align: "right" },
    { key: "ht", label: labels.lineTotalHt, width: priceW, align: "right" },
    { key: "ttc", label: labels.lineTotalTtc, width: priceW, align: "right", style: "bold" },
  ];
}

function lineRows(ctx: TemplateCtx): Array<Record<string, string>> {
  const { doc, locale } = ctx;
  const currency = doc.document.currency;
  return doc.lines.map((line) => ({
    n: String(line.lineNumber),
    desc: line.label,
    price: formatAmount(line.unitPrice, locale, currency),
    qty: formatQuantity(line.quantity, locale),
    tax: line.taxPct ? `${formatRate(line.taxPct, locale)}%` : "",
    ht: formatAmount(line.amountHt, locale, currency),
    ttc: formatAmount(line.amountTtc, locale, currency),
  }));
}

function drawLines(ctx: TemplateCtx): void {
  const { engine, doc } = ctx;
  const P = layout(engine.format);

  if (doc.lines.length === 0) {
    engine.drawText("—", {
      x: engine.rtl ? engine.contentRight : engine.contentLeft, y: engine.y, size: P.bodySize, color: COLORS.gray,
    });
    engine.y += P.bodySize * 1.6;
    return;
  }

  const result = drawTable(engine, {
    x: engine.contentLeft,
    y: engine.y,
    columns: lineColumns(ctx),
    rows: lineRows(ctx),
    rowSize: P.tableSize,
    headerColor: brand(ctx),
    headerTextColor: COLORS.white,
    zebraColor: COLORS.lightGray,
    maxLines: 2,
    cellPaddingX: 4,
  });
  engine.y = result.y + P.gap;
}

// ---------------------------------------------------------------------------
// Totaux
// ---------------------------------------------------------------------------

function drawTotals(ctx: TemplateCtx): void {
  const { engine, doc, labels, locale } = ctx;
  const P = layout(engine.format);
  const currency = doc.document.currency;
  const rtl = engine.rtl;
  const right = engine.contentRight;
  const boxW = Math.min(
    engine.contentWidth * (engine.format === "THERMAL" ? 0.85 : 0.5),
    220,
  );
  const labelX = right - boxW;
  // RTL : libellés à droite, valeurs à gauche (miroir de l'axe de lecture).
  const labelTextX = rtl ? right : labelX;
  const labelAlign: Align = rtl ? "right" : "left";
  const valueTextX = rtl ? labelX : right;
  const valueAlign: Align = rtl ? "left" : "right";

  const totalRows: Array<{ label: string; value: string; bold?: boolean; color?: Color; band?: boolean }> = [
    { label: labels.totalHt, value: formatAmount(doc.totals.totalHt, locale, currency) },
    { label: labels.totalTva, value: formatAmount(doc.totals.totalTva, locale, currency) },
  ];
  if (doc.totals.tap != null) {
    totalRows.push({ label: `${labels.tap}`, value: formatAmount(doc.totals.tap, locale, currency) });
  }
  totalRows.push({ label: labels.totalTtc, value: formatAmount(doc.totals.totalTtc, locale, currency), bold: true, color: brand(ctx), band: true });

  if (ctx.config.hasPayment) {
    if ((doc.totals.paidAmount ?? 0) > 0) {
      totalRows.splice(totalRows.length - 1, 0, {
        label: labels.paidAmount,
        value: formatAmount(doc.totals.paidAmount ?? 0, locale, currency),
      });
    }
    if (doc.totals.netPayable != null) {
      totalRows.push({
        label: labels.netPayable,
        value: formatAmount(doc.totals.netPayable ?? 0, locale, currency),
        bold: true,
        color: brand(ctx),
        band: true,
      });
    }
  }

  const lineH = P.bodySize * 1.5;
  const titleH = P.sectionSize * 1.15;
  engine.ensureSpace(titleH + totalRows.length * lineH + 12);

  // Titre discret du cadre récapitulatif.
  engine.drawText(labels.summaryTitle, {
    x: labelTextX, y: engine.y, size: P.sectionSize, style: "bold", color: brand(ctx), align: labelAlign,
  });
  engine.y += titleH + 2;

  const boxTop = engine.y;
  engine.drawRect(labelX, boxTop, right - labelX, totalRows.length * lineH + 8, {
    border: COLORS.lineGray,
    borderWidth: 0.6,
  });
  engine.y = boxTop + 3;

  for (let i = 0; i < totalRows.length; i++) {
    const row = totalRows[i];
    if (row.band) {
      // Bande pleine de la ligne finale (TTC / Net à payer) : fond teinté + trait haut.
      engine.fillRect(labelX, engine.y, right - labelX, lineH, tint(row.color ?? brand(ctx), 0.9));
      engine.drawLine(labelX, engine.y, right, engine.y, { thickness: 0.9, color: row.color ?? brand(ctx) });
      engine.drawLine(labelX, engine.y + lineH, right, engine.y + lineH, { thickness: 0.6, color: COLORS.lineGray });
    }
    engine.drawText(row.label, {
      x: labelTextX, y: engine.y, size: row.bold ? P.bodySize + 1 : P.bodySize,
      style: row.bold ? "bold" : "regular", color: row.color ?? COLORS.black, align: labelAlign,
    });
    engine.drawText(row.value, {
      x: valueTextX, y: engine.y, size: row.bold ? P.bodySize + 1 : P.bodySize,
      style: row.bold ? "bold" : "regular", color: row.color ?? COLORS.black, align: valueAlign,
    });
    engine.y += lineH;
  }
  engine.y += P.gap;
}

// ---------------------------------------------------------------------------
// Notes, conditions, montant en lettres
// ---------------------------------------------------------------------------

function sectionTitle(ctx: TemplateCtx, text: string): void {
  const { engine } = ctx;
  const P = layout(engine.format);
  engine.drawText(text, {
    x: engine.rtl ? engine.contentRight : engine.contentLeft, y: engine.y, size: P.sectionSize, style: "bold", color: brand(ctx),
  });
  engine.y += P.sectionSize * 1.4;
}

function drawNotesAndTerms(ctx: TemplateCtx): void {
  const { engine, doc, labels } = ctx;
  const P = layout(engine.format);
  const rtl = engine.rtl;
  // Avoir / document lié à une facture : afficher le motif (référence explicite
  // à la facture d'origine) en tête de la zone de texte.
  if (doc.document.reason) {
    sectionTitle(ctx, labels.reason);
    engine.y = engine.drawParagraph(doc.document.reason, {
      x: rtl ? engine.contentRight : engine.contentLeft, y: engine.y, size: P.bodySize, maxWidth: engine.contentWidth,
    });
    engine.y += P.gap;
  }
  if (doc.document.notes) {
    sectionTitle(ctx, labels.notes);
    engine.y = engine.drawParagraph(doc.document.notes, {
      x: rtl ? engine.contentRight : engine.contentLeft, y: engine.y, size: P.bodySize, maxWidth: engine.contentWidth,
    });
    engine.y += P.gap;
  }
  if (doc.document.terms) {
    sectionTitle(ctx, labels.terms);
    engine.y = engine.drawParagraph(doc.document.terms, {
      x: rtl ? engine.contentRight : engine.contentLeft, y: engine.y, size: P.bodySize, maxWidth: engine.contentWidth,
    });
    engine.y += P.gap;
  }
}

function drawAmountInWords(ctx: TemplateCtx): void {
  const { engine, doc, labels, locale } = ctx;
  const P = layout(engine.format);
  const rtl = engine.rtl;
  const currency = doc.document.currency;
  const amount =
    ctx.config.hasPayment && doc.totals.netPayable != null
      ? doc.totals.netPayable
      : doc.totals.totalTtc;
  if (!amount) return;
  const words = amountToWords(amount, locale, currency);
  sectionTitle(ctx, labels.amountInWords);
  const boxTop = engine.y;
  engine.y = engine.drawParagraph(words, {
    x: rtl ? engine.contentRight - 6 : engine.contentLeft + 6, y: engine.y + 3, size: P.bodySize, maxWidth: engine.contentWidth - 12,
  });
  engine.drawRect(engine.contentLeft, boxTop, engine.contentWidth, engine.y - boxTop + 2, {
    border: COLORS.lineGray,
    borderWidth: 0.6,
  });
  engine.y += P.gap;
}

// ---------------------------------------------------------------------------
// Banque + signatures
// ---------------------------------------------------------------------------

async function drawBankAndSignatures(ctx: TemplateCtx): Promise<void> {
  const { engine, doc, labels } = ctx;
  const P = layout(engine.format);
  const party = doc.party;
  const rtl = engine.rtl;

  const bankInfo: Array<[string, string | null]> = [
    [labels.bank, doc.company.bank],
    [labels.bankAgency, doc.company.bankAgency],
    [labels.bankAccount, doc.company.bankAccount],
    [labels.rib, doc.company.rib],
    [labels.iban, doc.company.iban],
    [labels.swift, doc.company.swift],
  ];
  const bankLines = bankInfo.filter(([, v]) => !!v);
  const hasBank = bankLines.length > 0;

  const sigHeight = 56;
  engine.ensureSpace(sigHeight + (hasBank ? 46 : 0));

  const colW = (engine.contentWidth - P.gap) / 2;

  if (hasBank) {
    sectionTitle(ctx, labels.bank);
    for (const [label, value] of bankLines) {
      engine.drawText(`${label} : ${value}`, {
        x: rtl ? engine.contentRight : engine.contentLeft, y: engine.y, size: P.bodySize, maxWidth: colW,
      });
      engine.y += P.bodySize * 1.4;
    }
    engine.y += P.gap;
  }

  // Signatures.
  const sigTop = engine.y;
  const sigColW = (engine.contentWidth - P.gap) / 2;
  // Document de livraison / réception : boîte de signature destinataire plus
  // grande (le réceptionnaire appose cachet + signature + observation).
  const isDelivery = doc.document.docType === "DELIVERY_NOTE" || doc.document.docType === "GOODS_RECEIPT";
  const sigBoxH = isDelivery ? 70 : 50;

  // Cadre "L'Émetteur — Cachet" (toujours visible, même sans image).
  // RTL : miroir — cadre émetteur à droite, cadre client à gauche.
  const issuerSigX = rtl ? engine.contentRight - sigColW : engine.contentLeft;
  engine.drawRect(issuerSigX, sigTop, sigColW, sigBoxH, {
    border: COLORS.lineGray,
    borderWidth: 0.7,
  });
  engine.drawText(labels.issuerStamp, {
    x: rtl ? issuerSigX + sigColW - 2 : issuerSigX + 2,
    y: sigTop + 3,
    size: P.bodySize, style: "bold", maxWidth: sigColW,
  });

  // Cachet (image) superposé dans le cadre si fourni.
  if (doc.branding.stamp) {
    const img = await engine.embedImage(doc.branding.stamp, doc.branding.stampMimeType);
    if (img) {
      const boxH = isDelivery ? sigBoxH / 2 : sigBoxH / 2;
      engine.drawImage(img, issuerSigX + 6, sigTop + 14, {
        maxWidth: sigColW - 12, maxHeight: boxH - 6,
      });
    }
  }
  // Signature manuscrite (image) superposée si fournie.
  if (doc.branding.signature) {
    const img = await engine.embedImage(doc.branding.signature, doc.branding.signatureMimeType);
    if (img) {
      const sigOffset = doc.branding.stamp ? sigBoxH / 2 + 2 : 12;
      engine.drawImage(img, issuerSigX + 6, sigTop + sigOffset, {
        maxWidth: sigColW - 12, maxHeight: sigBoxH / 2 - 6,
      });
    }
  }
  engine.y = Math.max(engine.y, sigTop + sigBoxH + P.gap);

  if (party) {
    const rx = rtl ? engine.contentLeft : engine.contentRight - sigColW;
    engine.drawRect(rx, sigTop, sigColW, sigBoxH, {
      border: COLORS.lineGray,
      borderWidth: 0.7,
    });
    // Pour une livraison, le cadre "client" devient explicitement celui du
    // réceptionnaire ("Destinataire — Cachet").
    engine.drawText(isDelivery ? labels.receiver : labels.clientLabel, {
      x: rtl ? rx + sigColW - 2 : rx + 2, y: sigTop + 3, size: P.bodySize, style: "bold", align: "start", maxWidth: sigColW,
    });
    engine.drawText(party.name, {
      x: rtl ? rx + sigColW - 2 : rx + 2, y: sigTop + 3 + P.bodySize * 1.4, size: P.bodySize, color: COLORS.gray,
      align: "start", maxWidth: sigColW,
    });
  }

  engine.y = Math.max(engine.y, sigTop + sigBoxH + P.gap);
}

// ---------------------------------------------------------------------------
// Tampons de statut
// ---------------------------------------------------------------------------

function drawStatusStamps(ctx: TemplateCtx): void {
  const { engine, doc, labels } = ctx;
  const P = layout(engine.format);
  const cx = engine.pageWidth / 2;
  const cy = engine.pageHeight / 2;

  const status = doc.document.status;
  if (status === "DRAFT") {
    engine.stampText(labels.draft, {
      x: cx, y: cy, size: P.titleSizeStamp, color: COLORS.gray, rotateDeg: -25, opacity: 0.28,
    });
  } else if (status === "CANCELLED") {
    engine.stampText(labels.cancelled, {
      x: cx, y: cy, size: P.titleSizeStamp, color: COLORS.darkRed, rotateDeg: -25, opacity: 0.3,
    });
  } else if (ctx.config.hasPayment && doc.document.paymentStatus === "PAID") {
    engine.stampText(labels.paid, {
      x: engine.rtl ? engine.contentLeft + 60 : engine.contentRight - 60, y: cy, size: P.titleSize, color: COLORS.green, rotateDeg: -15, opacity: 0.35,
    });
  }
}

// ---------------------------------------------------------------------------
// En-tête courant + pied de page
// ---------------------------------------------------------------------------

export function createRunningHeader(doc: PrintableDocument, labels: PrintLabels, locale: Locale) {
  return (engine: PdfEngine, _pageIndex: number): void => {
    void _pageIndex;
    const P = layout(engine.format);
    const brandColor = toColor(doc.company.primaryColor, COLORS.black);
    engine.drawLine(engine.contentLeft, engine.y, engine.contentRight, engine.y, {
      thickness: 0.8,
      color: brandColor,
    });
    engine.y += 6;
    engine.drawText(companyName(doc, locale), {
      x: engine.rtl ? engine.contentRight : engine.contentLeft, y: engine.y, size: P.bodySize, style: "bold",
      maxWidth: engine.contentWidth * 0.6,
    });
    engine.drawText(`${labels.ref} ${doc.document.number}`, {
      x: engine.rtl ? engine.contentLeft : engine.contentRight, y: engine.y, size: P.bodySize,
      align: engine.rtl ? "left" : "right",
    });
    engine.y += P.bodySize * 1.7;
  };
}

export function createFooter(doc: PrintableDocument, labels: PrintLabels) {
  return (ctx: { engine: PdfEngine; pageIndex: number; totalPages: number }): void => {
    const P = layout(doc.company.printFormat);
    const bottomY = ctx.engine.pageHeight - ctx.engine.marginBottom + 4;
    ctx.engine.drawLine(
      ctx.engine.contentLeft, bottomY, ctx.engine.contentRight, bottomY, { thickness: 0.5 },
    );
    let fy = bottomY + 8;
    if (doc.company.invoiceFooter) {
      // Pied de page "statique" : on n'utilise PAS drawParagraph (qui avance le
      // curseur et peut créer des pages — boucle infinie pendant la finalisation).
      const lines = ctx.engine.wrap(doc.company.invoiceFooter, "regular", P.bodySize - 1, ctx.engine.contentWidth);
      const centerX = (ctx.engine.contentLeft + ctx.engine.contentRight) / 2;
      for (const line of lines) {
        ctx.engine.drawText(line, {
          x: centerX, y: fy, size: P.bodySize - 1, color: COLORS.gray,
          align: "center", maxWidth: ctx.engine.contentWidth,
        });
        fy += ctx.engine.lineHeight(P.bodySize - 1);
      }
    }
    ctx.engine.drawText(
      `${labels.page} ${ctx.pageIndex + 1} ${labels.of} ${ctx.totalPages}`,
      { x: ctx.engine.rtl ? ctx.engine.contentLeft : ctx.engine.contentRight, y: fy, size: P.bodySize - 1, color: COLORS.gray, align: ctx.engine.rtl ? "left" : "right" },
    );
  };
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

export async function renderPrintableDocument(
  engine: PdfEngine,
  doc: PrintableDocument,
  labels: PrintLabels,
  locale: Locale,
): Promise<void> {
  const ctx: TemplateCtx = {
    engine,
    doc,
    labels,
    locale,
    config: getPrintConfig(doc.document.docType),
  };
  await drawHeader(ctx);
  drawLines(ctx);
  drawTotals(ctx);
  drawNotesAndTerms(ctx);
  drawAmountInWords(ctx);
  await drawBankAndSignatures(ctx);
  drawStatusStamps(ctx);
}
