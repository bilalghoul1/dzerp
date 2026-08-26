import type { DocumentStatus } from "@/generated/prisma/enums";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/lib/constants";
import { amountToWords, formatAmount, formatDate, formatQuantity, formatRate } from "./format";
import type { PrintTypeConfig } from "./registry";
import { getPrintConfig } from "./registry";
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
  statusLabel: string;
  paymentStatusLabel: string;
  priorityLabel: string;
  customerOrderNumber: string;
  customerOrderDate: string;
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
}

function layout(format: PrintFormat): LayoutParams {
  switch (format) {
    case "A5":
      return {
        titleSize: 13, bodySize: 8, tableSize: 7.5, nameSize: 11,
        sectionSize: 8.5, gap: 6, colWidth: 130, logoMaxH: 42, metaWidth: 0.45, titleSizeStamp: 26,
      };
    case "THERMAL":
      return {
        titleSize: 11, bodySize: 7.5, tableSize: 7, nameSize: 10,
        sectionSize: 8, gap: 4, colWidth: 90, logoMaxH: 30, metaWidth: 0.55, titleSizeStamp: 20,
      };
    default:
      return {
        titleSize: 15, bodySize: 8.5, tableSize: 8, nameSize: 12,
        sectionSize: 9.5, gap: 8, colWidth: 210, logoMaxH: 52, metaWidth: 0.42, titleSizeStamp: 34,
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

function brand(ctx: TemplateCtx): Color {
  return toColor(ctx.doc.company.primaryColor, COLORS.black);
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

  let logoBottom = engine.y;
  const companyX = rtl ? right - Math.min(260, engine.contentWidth * 0.5) : engine.contentLeft;
  let textX = companyX;
  if (doc.branding.logo) {
    const img = await engine.embedImage(doc.branding.logo, doc.branding.logoMimeType);
    if (img) {
      const box = engine.drawImage(img, companyX, engine.y, {
        maxWidth: 120,
        maxHeight: P.logoMaxH,
      });
      textX = rtl ? companyX : companyX + box.width + 10;
      logoBottom = engine.y + box.height;
    }
  }

  // Largeur de la colonne société : bornée pour ne jamais empiéter sur la
  // colonne méta (droite).
  const metaX = right - engine.contentWidth * P.metaWidth;
  const companyWidth = Math.max(
    80,
    Math.min(metaX - textX - P.gap, 260),
  );

  const companyLines: Array<{ text: string; style?: "bold"; color?: Color } | null> = [
    { text: doc.company.name, style: "bold" },
    doc.company.legalName ? { text: doc.company.legalName, color: COLORS.gray } : null,
    joinParts([
      doc.company.legalForm,
      doc.company.capital ? `${labels.capital} ${doc.company.capital}` : null,
    ])
      ? { text: joinParts([
          doc.company.legalForm,
          doc.company.capital ? `${labels.capital} ${doc.company.capital}` : null,
        ]), color: COLORS.gray }
      : null,
    joinParts([
      doc.company.rc ? `${labels.rc} : ${doc.company.rc}` : null,
      doc.company.taxId ? `${labels.taxId} : ${doc.company.taxId}` : null,
      doc.company.nis ? `${labels.nis} : ${doc.company.nis}` : null,
      doc.company.ai ? `${labels.ai} : ${doc.company.ai}` : null,
      doc.company.vatNumber ? `${labels.vatNumber} : ${doc.company.vatNumber}` : null,
    ])
      ? { text: joinParts([
          doc.company.rc ? `${labels.rc} : ${doc.company.rc}` : null,
          doc.company.taxId ? `${labels.taxId} : ${doc.company.taxId}` : null,
          doc.company.nis ? `${labels.nis} : ${doc.company.nis}` : null,
          doc.company.ai ? `${labels.ai} : ${doc.company.ai}` : null,
          doc.company.vatNumber ? `${labels.vatNumber} : ${doc.company.vatNumber}` : null,
        ]) }
      : null,
    joinParts([
      doc.company.bank ? `${labels.bank} : ${doc.company.bank}` : null,
      doc.company.rib ? `${labels.rib} : ${doc.company.rib}` : null,
      doc.company.bankAccount ? `${labels.bankAccount} : ${doc.company.bankAccount}` : null,
    ])
      ? {
          text: joinParts([
            doc.company.bank ? `${labels.bank} : ${doc.company.bank}` : null,
            doc.company.rib ? `${labels.rib} : ${doc.company.rib}` : null,
            doc.company.bankAccount ? `${labels.bankAccount} : ${doc.company.bankAccount}` : null,
          ]),
          color: COLORS.gray,
        }
      : null,
    joinParts([
      doc.company.address,
      doc.company.commune,
      doc.company.wilaya,
      doc.company.postalCode,
      doc.company.country,
    ])
      ? { text: joinParts([
          doc.company.address,
          doc.company.commune,
          doc.company.wilaya,
          doc.company.postalCode,
          doc.company.country,
        ]), color: COLORS.gray }
      : null,
    joinParts([
      doc.company.phone ? `${labels.phone} : ${doc.company.phone}` : null,
      doc.company.mobile ? `${labels.phone} : ${doc.company.mobile}` : null,
      doc.company.email,
      doc.company.website,
    ])
      ? { text: joinParts([
          doc.company.phone ? `${labels.phone} : ${doc.company.phone}` : null,
          doc.company.mobile ? `${labels.phone} : ${doc.company.mobile}` : null,
          doc.company.email,
          doc.company.website,
        ]), color: COLORS.gray }
      : null,
  ];

  for (const line of companyLines) {
    if (!line) continue;
    const size = line.style === "bold" ? P.nameSize : P.bodySize;
    const wrapped = engine.wrap(line.text, line.style ?? "regular", size, companyWidth);
    const lineH = size * 1.35;
    for (const w of wrapped) {
      engine.drawText(w, {
        x: textX, y: engine.y, size, style: line.style ?? "regular",
        color: line.color ?? COLORS.black, maxWidth: companyWidth,
      });
      engine.y += lineH;
    }
  }
  const companyBottom = Math.max(engine.y, logoBottom);

  // ---- Titre (droite en LTR / gauche en RTL) ----
  let ty = pageTop;
  const titleX = rtl ? engine.contentLeft : right;
  const titleAlign: Align = rtl ? "left" : "right";
  engine.drawText(labels.docType, {
    x: titleX, y: ty, size: P.titleSize, style: "bold", color: brandColor, align: titleAlign,
  });
  ty += P.titleSize * 1.3;
  engine.drawText(`${labels.ref} ${doc.document.number}`, {
    x: titleX, y: ty, size: P.bodySize + 1, style: "bold", align: titleAlign,
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
  const lineH = P.bodySize * 1.5;
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

  const colW = engine.contentWidth - metaWidth - P.gap;
  const partyX = rtl ? right - colW : engine.contentLeft;
  let partyY = blockTop;
  const party = doc.party;
  if (party) {
    engine.drawText(labels.party, {
      x: partyX, y: partyY, size: P.sectionSize, style: "bold", color: brandColor,
      align: rtl ? "right" : "left",
    });
    partyY += P.sectionSize * 1.4;

    const partyIdLine = joinParts([
      party.rc ? `${labels.rc} : ${party.rc}` : null,
      party.taxId ? `${labels.taxId} : ${party.taxId}` : null,
      party.nis ? `${labels.nis} : ${party.nis}` : null,
      party.ai ? `${labels.ai} : ${party.ai}` : null,
      party.vatNumber ? `${labels.vatNumber} : ${party.vatNumber}` : null,
    ]);
    const partyAddr = joinParts([
      party.address, party.commune, party.wilaya, party.postalCode,
    ]);
    const partyContact = joinParts([
      party.phone ? `${labels.phone} : ${party.phone}` : null,
      party.email,
    ]);

    const drawPartyLine = (text: string | null, opts?: { bold?: boolean; gray?: boolean }) => {
      if (!text) return;
      const size = opts?.bold ? P.bodySize + 1 : P.bodySize;
      const wrapped = engine.wrap(text, opts?.bold ? "bold" : "regular", size, colW);
      const lineH = size * 1.4;
      for (const w of wrapped) {
        engine.drawText(w, {
          x: partyX, y: partyY, size,
          style: opts?.bold ? "bold" : "regular",
          color: opts?.gray ? COLORS.gray : COLORS.black, maxWidth: colW,
          align: rtl ? "right" : "left",
        });
        partyY += lineH;
      }
    };

    drawPartyLine(party.name, { bold: true });
    drawPartyLine(partyIdLine);
    drawPartyLine(partyAddr, { gray: true });
    drawPartyLine(partyContact, { gray: true });
  }
  if (doc.branch.name) {
    partyY += P.gap;
    engine.drawText(labels.branch, {
      x: engine.contentLeft, y: partyY, size: P.bodySize, style: "bold", color: COLORS.gray,
    });
    partyY += P.bodySize * 1.4;
    const branchLine = joinParts([
      doc.branch.name,
      doc.branch.address,
      doc.branch.commune,
      doc.branch.wilaya,
      doc.branch.manager ? `${labels.manager} : ${doc.branch.manager}` : null,
    ]);
    const wrapped = engine.wrap(branchLine, "regular", P.bodySize, colW);
    const bLineH = P.bodySize * 1.4;
    for (const w of wrapped) {
      engine.drawText(w, {
        x: engine.contentLeft, y: partyY, size: P.bodySize, color: COLORS.gray, maxWidth: colW,
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
      x: engine.contentLeft, y: engine.y, size: P.bodySize, color: COLORS.gray,
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
    const fixed = 14 + 24 + priceW + 42;
    return [
      { key: "n", label: "#", width: 14, align: "right" },
      { key: "desc", label: labels.description, width: Math.max(40, w - fixed), align: "start" },
      { key: "qty", label: labels.quantity, width: 24, align: "right" },
      { key: "price", label: labels.price, width: priceW, align: "right" },
      { key: "ttc", label: labels.amountTtc, width: 42, align: "right", style: "bold" },
    ];
  }

  if (engine.format === "A5") {
    const priceW = amountW();
    const fixed = 16 + 30 + priceW + 24 + priceW + priceW + priceW;
    return [
      { key: "n", label: "#", width: 16, align: "right" },
      { key: "desc", label: labels.description, width: Math.max(50, w - fixed), align: "start" },
      { key: "qty", label: labels.quantity, width: 30, align: "right" },
      { key: "price", label: labels.price, width: priceW, align: "right" },
      { key: "tax", label: labels.tax, width: 24, align: "right" },
      { key: "tva", label: labels.amountTva, width: priceW, align: "right" },
      { key: "ht", label: labels.amountHt, width: priceW, align: "right" },
      { key: "ttc", label: labels.amountTtc, width: priceW, align: "right", style: "bold" },
    ];
  }

  const priceW = Math.max(
    amountW(),
    ...doc.lines.map((l) =>
      Math.max(
        engine.measure(formatAmount(l.unitPrice ?? 0, locale, currency), "regular", P.tableSize),
        engine.measure(formatAmount(l.amountHt ?? 0, locale, currency), "regular", P.tableSize),
        engine.measure(formatAmount(l.amountTva ?? 0, locale, currency), "regular", P.tableSize),
        engine.measure(formatAmount(l.amountTtc ?? 0, locale, currency), "bold", P.tableSize),
      ),
    ),
  ) + 10;
  const qtyW = Math.max(30, engine.measure(labels.quantity, "regular", P.tableSize) + 6);
  const taxW = Math.max(24, engine.measure(labels.tax, "regular", P.tableSize) + 4);
  const fixed = 20 + qtyW + priceW + taxW + priceW + priceW + priceW;
  return [
    { key: "n", label: "#", width: 20, align: "right" },
    { key: "desc", label: labels.description, width: Math.max(70, w - fixed), align: "start" },
    { key: "qty", label: labels.quantity, width: qtyW, align: "right" },
    { key: "price", label: labels.price, width: priceW, align: "right" },
    { key: "tax", label: labels.tax, width: taxW, align: "right" },
    { key: "tva", label: labels.amountTva, width: priceW, align: "right" },
    { key: "ht", label: labels.amountHt, width: priceW, align: "right" },
    { key: "ttc", label: labels.amountTtc, width: priceW, align: "right", style: "bold" },
  ];
}

function lineRows(ctx: TemplateCtx): Array<Record<string, string>> {
  const { doc, locale } = ctx;
  const currency = doc.document.currency;
  return doc.lines.map((line) => ({
    n: String(line.lineNumber),
    desc: line.label,
    qty: formatQuantity(line.quantity, locale),
    price: formatAmount(line.unitPrice, locale, currency),
    tax: line.taxPct ? `${formatRate(line.taxPct, locale)}%` : "",
    tva: formatAmount(line.amountTva, locale, currency),
    ht: formatAmount(line.amountHt, locale, currency),
    ttc: formatAmount(line.amountTtc, locale, currency),
  }));
}

function drawLines(ctx: TemplateCtx): void {
  const { engine, doc } = ctx;
  const P = layout(engine.format);

  if (doc.lines.length === 0) {
    engine.drawText("—", {
      x: engine.contentLeft, y: engine.y, size: P.bodySize, color: COLORS.gray,
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
    cellPaddingX: 2,
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
  const valueX = rtl ? right - boxW : right;
  const labelAlign: Align = rtl ? "right" : "left";
  const valueAlign: Align = rtl ? "left" : "right";

  const totalRows: Array<{ label: string; value: string; bold?: boolean; color?: Color }> = [
    { label: labels.totalHt, value: formatAmount(doc.totals.totalHt, locale, currency) },
    { label: labels.totalTva, value: formatAmount(doc.totals.totalTva, locale, currency) },
    { label: labels.totalTtc, value: formatAmount(doc.totals.totalTtc, locale, currency), bold: true, color: brand(ctx) },
  ];

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
      });
    }
  }

  const lineH = P.bodySize * 1.7;
  engine.ensureSpace(totalRows.length * lineH + 8);
  engine.drawLine(labelX, engine.y, right, engine.y);
  engine.y += 4;

  for (const row of totalRows) {
    engine.drawText(row.label, {
      x: labelX, y: engine.y, size: row.bold ? P.bodySize + 1 : P.bodySize,
      style: row.bold ? "bold" : "regular", color: row.color ?? COLORS.black, align: labelAlign,
    });
    engine.drawText(row.value, {
      x: valueX, y: engine.y, size: row.bold ? P.bodySize + 1 : P.bodySize,
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
    x: engine.contentLeft, y: engine.y, size: P.sectionSize, style: "bold", color: brand(ctx),
  });
  engine.y += P.sectionSize * 1.4;
}

function drawNotesAndTerms(ctx: TemplateCtx): void {
  const { engine, doc, labels } = ctx;
  const P = layout(engine.format);
  if (doc.document.notes) {
    sectionTitle(ctx, labels.notes);
    engine.y = engine.drawParagraph(doc.document.notes, {
      x: engine.contentLeft, y: engine.y, size: P.bodySize, maxWidth: engine.contentWidth,
    });
    engine.y += P.gap;
  }
  if (doc.document.terms) {
    sectionTitle(ctx, labels.terms);
    engine.y = engine.drawParagraph(doc.document.terms, {
      x: engine.contentLeft, y: engine.y, size: P.bodySize, maxWidth: engine.contentWidth,
    });
    engine.y += P.gap;
  }
}

function drawAmountInWords(ctx: TemplateCtx): void {
  const { engine, doc, labels, locale } = ctx;
  const P = layout(engine.format);
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
    x: engine.contentLeft + 6, y: engine.y + 3, size: P.bodySize, maxWidth: engine.contentWidth - 12,
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
        x: engine.contentLeft, y: engine.y, size: P.bodySize, maxWidth: colW,
      });
      engine.y += P.bodySize * 1.4;
    }
    engine.y += P.gap;
  }

  // Signatures.
  const sigTop = engine.y;
  const sigColW = (engine.contentWidth - P.gap) / 2;
  const sigBoxH = 50;

  // Cadre "Cachet et Signature" (toujours visible, même sans image).
  engine.drawRect(engine.contentLeft, sigTop, sigColW, sigBoxH, {
    border: COLORS.lineGray,
    borderWidth: 0.7,
  });
  engine.drawText(labels.signature, {
    x: engine.contentLeft + 2,
    y: sigTop + 3,
    size: P.bodySize, style: "bold", maxWidth: sigColW,
  });

  // Cachet (image) superposé dans le cadre si fourni.
  if (doc.branding.stamp) {
    const img = await engine.embedImage(doc.branding.stamp, doc.branding.stampMimeType);
    if (img) {
      engine.drawImage(img, engine.contentLeft + 6, sigTop + 12, {
        maxWidth: sigColW - 12, maxHeight: sigBoxH - 16,
      });
    }
  }
  // Signature manuscrite (image) superposée si fournie.
  if (doc.branding.signature) {
    const img = await engine.embedImage(doc.branding.signature, doc.branding.signatureMimeType);
    if (img) {
      engine.drawImage(img, engine.contentLeft + 6, sigTop + 12, {
        maxWidth: sigColW - 12, maxHeight: sigBoxH - 16,
      });
    }
  }
  engine.y = Math.max(engine.y, sigTop + sigBoxH + P.gap);

  if (party) {
    const rx = engine.contentRight - sigColW;
    engine.drawRect(rx, sigTop, sigColW, sigBoxH, {
      border: COLORS.lineGray,
      borderWidth: 0.7,
    });
    engine.drawText(labels.signature, {
      x: rx + 2, y: sigTop + 3, size: P.bodySize, style: "bold", align: "start", maxWidth: sigColW,
    });
    engine.drawText(party.name, {
      x: rx + 2, y: sigTop + 3 + P.bodySize * 1.4, size: P.bodySize, color: COLORS.gray,
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
      x: engine.contentRight - 60, y: cy, size: P.titleSize, color: COLORS.green, rotateDeg: -15, opacity: 0.35,
    });
  }
}

// ---------------------------------------------------------------------------
// En-tête courant + pied de page
// ---------------------------------------------------------------------------

export function createRunningHeader(doc: PrintableDocument, labels: PrintLabels) {
  return (engine: PdfEngine, _pageIndex: number): void => {
    void _pageIndex;
    const P = layout(engine.format);
    const brandColor = toColor(doc.company.primaryColor, COLORS.black);
    engine.drawLine(engine.contentLeft, engine.y, engine.contentRight, engine.y, {
      thickness: 0.8,
      color: brandColor,
    });
    engine.y += 6;
    engine.drawText(doc.company.name, {
      x: engine.contentLeft, y: engine.y, size: P.bodySize, style: "bold", maxWidth: engine.contentWidth * 0.6,
    });
    engine.drawText(`${labels.ref} ${doc.document.number}`, {
      x: engine.contentRight, y: engine.y, size: P.bodySize, align: "right",
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
      { x: ctx.engine.contentRight, y: fy, size: P.bodySize - 1, color: COLORS.gray, align: "right" },
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
