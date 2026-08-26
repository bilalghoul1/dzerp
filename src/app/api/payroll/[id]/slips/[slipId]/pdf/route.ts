import { NextResponse } from "next/server";
import { PDFDocument, PDFPage, rgb } from "pdf-lib";
import { FontManager, assertFontsAvailable, sanitizeText } from "@/features/print/fonts";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/features/auth/rbac";
import { getOrResolveCompanyContext } from "@/features/company/context";

export const dynamic = "force-dynamic";

const GREEN = rgb(0.0, 0.28, 0.18);
const BLACK = rgb(0.12, 0.12, 0.12);
const GRAY = rgb(0.42, 0.42, 0.42);
const LIGHT = rgb(0.93, 0.93, 0.93);
const LINE = rgb(0.8, 0.8, 0.8);

function dz(n: unknown): string {
  const v = Number(n) || 0;
  return (
    v.toLocaleString("fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
    " DA"
  );
}

function font(fm: FontManager, bold = false) {
  return fm.getFont("latin", bold ? "bold" : "regular");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; slipId: string }> },
) {
  const { id, slipId } = await params;
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") ?? "fr";
  const rtl = locale === "ar";

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const ctx = await getOrResolveCompanyContext();
  if (!ctx) return NextResponse.json({ error: "Société inactive" }, { status: 403 });

  const slip = await prisma.salarySlip.findUnique({
    where: { id: slipId },
    include: { employee: true, payrollRun: true, lines: true },
  });

  if (!slip || slip.payrollRunId !== id || slip.companyId !== ctx.company.id) {
    return NextResponse.json({ error: "Bulletin introuvable" }, { status: 404 });
  }

  const company = await prisma.company.findUnique({ where: { id: ctx.company.id } });
  assertFontsAvailable();

  const doc = await PDFDocument.create();
  doc.registerFontkit((await import("@pdf-lib/fontkit")).default);
  const fm = new FontManager(doc);
  await fm.load();

  const W = 595.28; // A4
  const M = 40;
  const BOTTOM = 90; // reserve space for signature/stamp footer
  let page = doc.addPage([W, 841.89]);
  let y = 800;

  const ensureSpace = (needed: number) => {
    if (y - needed < BOTTOM) {
      page = doc.addPage([W, 841.89]);
      y = 800;
      drawHeaderStrip(page, fm, company, slip.period, M, W, rtl);
      y = 770;
    }
  };

  // ---- En-tête société ----
  drawHeaderStrip(page, fm, company, slip.period, M, W, rtl);
  y = 770;

  // Coordonnées société (NIF/NIS/RC/Capital/Banque)
  const coor: string[] = [
    `NIF: ${company?.taxId ?? "-"}`,
    `NIS: ${company?.nis ?? "-"}`,
    `RC: ${company?.rc ?? "-"}`,
    `Capital: ${company?.capital ?? "-"}`,
    `Adresse: ${company?.address ?? "-"}`,
    company?.rib ? `RIB/CCP: ${company.rib}` : `Banque: ${company?.bank ?? "-"}`,
  ];
  for (const c of coor) {
    page.drawText(c, { x: rtl ? W - M - fm.getFont("latin", "regular").widthOfTextAtSize(c, 9) : M, y, size: 9, font: font(fm, false), color: GRAY });
    y -= 13;
  }

  // Bloc employé
  y -= 8;
  page.drawRectangle({ x: M, y: y - 64, width: W - 2 * M, height: 64, color: LIGHT });
  const emp = [
    `Employé: ${slip.employee.firstName} ${slip.employee.lastName}`,
    `Matricule: ${slip.employee.code ?? "-"}`,
    `Poste: ${slip.employee.jobTitleId ?? "-"}`,
    `NSS: ${slip.employee.nss ?? "-"}`,
    `Date d'embauche: ${slip.employee.hireDate?.toISOString().slice(0, 10) ?? "-"}`,
  ];
  let ey = y - 16;
  for (const e of emp) {
    const w = fm.getFont("latin", "regular").widthOfTextAtSize(e, 9);
    page.drawText(e, { x: rtl ? W - M - 8 - w : M + 8, y: ey, size: 9, font: font(fm, false), color: BLACK });
    ey -= 12;
  }
  y -= 72;

  // ---- GAINS ----
  ensureSpace(120);
  y = drawSectionTitle(page, fm, "GAINS / المستحقات", M, y, W, rtl);
  y = drawRow(page, fm, "Salaire de base / الأجر الأساسي", dz(slip.baseSalary), M, y, W, rtl);
  const earnings = slip.lines.filter((l) => l.kind === "EARNING");
  for (const l of earnings) {
    ensureSpace(16);
    y = drawRow(page, fm, l.labelAr ?? l.label, dz(l.amount), M, y, W, rtl);
  }
  y = drawRow(page, fm, "Salaire Brut / إجمالي الأجر", dz(slip.grossSalary), M, y, W, rtl, true);

  // ---- RETENUES ----
  ensureSpace(120);
  y -= 6;
  y = drawSectionTitle(page, fm, "RETENUES / الاقتطاعات", M, y, W, rtl);
  y = drawRow(page, fm, "CNAS (9 %)", dz(slip.cnasAmount), M, y, W, rtl);
  y = drawRow(page, fm, "IRG / الضريبة على الدخل", dz(slip.irgAmount), M, y, W, rtl);
  const other = slip.lines.filter((l) => l.kind === "EMPLOYEE_DEDUCTION");
  for (const l of other) {
    ensureSpace(16);
    y = drawRow(page, fm, l.labelAr ?? l.label, dz(l.amount), M, y, W, rtl);
  }
  y = drawRow(page, fm, "Net à Payer / الصافي", dz(slip.netSalary), M, y, W, rtl, true);

  // ---- COTISATIONS PATRONALES ----
  ensureSpace(110);
  y -= 6;
  y = drawSectionTitle(page, fm, "COTISATIONS PATRONALES / حصة رب العمل", M, y, W, rtl);
  y = drawRow(page, fm, "CNAS patronale (26 %)", dz(slip.employerCnas), M, y, W, rtl);
  y = drawRow(page, fm, "CASNOS (1 %)", dz(slip.employerCasnos), M, y, W, rtl);
  y = drawRow(page, fm, "DAS (1 %)", dz(slip.employerDas), M, y, W, rtl);
  y = drawRow(page, fm, "Coût total employeur", dz(slip.totalCost), M, y, W, rtl, true);

  // ---- Pied : signature / cachet ----
  y = BOTTOM - 10;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: LINE });
  y -= 4;
  const signEmp = "Cachet et signature de l'employeur / ختم وتوقيع رب العمل";
  page.drawText(signEmp, {
    x: rtl ? M : M,
    y,
    size: 9,
    font: font(fm, false),
    color: GRAY,
  });
  page.drawText("Signature de l'employé / توقيع الأجير", {
    x: W - M - 180,
    y,
    size: 9,
    font: font(fm, false),
    color: GRAY,
  });
  page.drawText(`Période: ${slip.period}`, {
    x: M,
    y: 40,
    size: 9,
    font: font(fm, false),
    color: GRAY,
  });

  const pdfBytes = await doc.save();
  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="fiche-paie-${slip.period}-${slip.employee.code}.pdf"`,
    },
  });
}

function drawHeaderStrip(
  page: PDFPage,
  fm: FontManager,
  company: { name?: string | null } | null,
  period: string,
  M: number,
  W: number,
  rtl: boolean,
): void {
  page.drawRectangle({ x: 0, y: 770, width: W, height: 70, color: GREEN });
  const nameX = rtl ? W - M : M;
  const header = fm.splitRuns(sanitizeText(company?.name ?? "DzERP"), "bold");
  for (const run of header) {
    const w = run.font.widthOfTextAtSize(run.text, 16);
    page.drawText(run.text, {
      x: rtl ? nameX - w : nameX,
      y: 800,
      size: 16,
      font: run.font,
      color: rgb(1, 1, 1),
    });
  }
  const sub = "FICHE DE PAIE / كشف الراتب";
  const subW = fm.getFont("latin", "regular").widthOfTextAtSize(sub, 10);
  page.drawText(sub, {
    x: rtl ? W - M - subW : M,
    y: 782,
    size: 10,
    font: fm.getFont("latin", "regular"),
    color: rgb(1, 1, 1),
  });
  const periodFont = fm.getFont("latin", "bold");
  const periodText = `Période: ${period}`;
  const periodW = periodFont.widthOfTextAtSize(periodText, 10);
  page.drawText(periodText, {
    x: rtl ? M : W - M - periodW,
    y: 800,
    size: 10,
    font: periodFont,
    color: rgb(1, 1, 1),
  });
}

function drawSectionTitle(
  page: PDFPage,
  fm: FontManager,
  text: string,
  M: number,
  y: number,
  W: number,
  rtl: boolean,
): number {
  page.drawRectangle({ x: M, y: y - 18, width: W - 2 * M, height: 18, color: GREEN });
  const w = fm.getFont("latin", "bold").widthOfTextAtSize(text, 10);
  page.drawText(text, {
    x: rtl ? W - M - 6 - w : M + 6,
    y: y - 14,
    size: 10,
    font: fm.getFont("latin", "bold"),
    color: rgb(1, 1, 1),
  });
  return y - 26;
}

function drawRow(
  page: PDFPage,
  fm: FontManager,
  labelText: string,
  value: string,
  M: number,
  y: number,
  W: number,
  rtl: boolean,
  bold = false,
): number {
  const valueW = fm.getFont("latin", "regular").widthOfTextAtSize(value, 9);
  if (rtl) {
    // Label on the right, value on the left (Arabic reading order).
    const labelW = fm.getFont("latin", bold ? "bold" : "regular").widthOfTextAtSize(sanitizeText(labelText), 9);
    page.drawText(sanitizeText(labelText), {
      x: W - M - 6 - labelW,
      y,
      size: 9,
      font: fm.getFont("latin", bold ? "bold" : "regular"),
      color: BLACK,
    });
    page.drawText(value, {
      x: M + 6,
      y,
      size: 9,
      font: fm.getFont("latin", bold ? "bold" : "regular"),
      color: BLACK,
    });
  } else {
    page.drawText(sanitizeText(labelText), {
      x: M + 6,
      y,
      size: 9,
      font: fm.getFont("latin", bold ? "bold" : "regular"),
      color: BLACK,
    });
    page.drawText(value, {
      x: W - M - 6 - valueW,
      y,
      size: 9,
      font: fm.getFont("latin", bold ? "bold" : "regular"),
      color: BLACK,
    });
  }
  return y - 15;
}
