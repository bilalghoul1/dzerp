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

function dz(n: unknown): string {
  const v = Number(n) || 0;
  return (
    v.toLocaleString("fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
    " DA"
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; slipId: string }> },
) {
  const { id, slipId } = await params;
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

  const page = doc.addPage([595.28, 841.89]); // A4
  const W = page.getWidth();
  const M = 40;
  let y = 800;

  // En-tête société
  page.drawRectangle({ x: 0, y: 770, width: W, height: 70, color: GREEN });
  const header = fm.splitRuns(
    sanitizeText(company?.name ?? "DzERP"),
    "bold",
  );
  for (const run of header) {
    page.drawText(run.text, { x: M, y: 800, size: 16, font: run.font, color: rgb(1, 1, 1) });
  }
  page.drawText("FICHE DE PAIE / كشف الراتب", {
    x: M,
    y: 782,
    size: 10,
    font: fm.getFont("latin", "regular"),
    color: rgb(1, 1, 1),
  });

  // Coordonnées société (NIF/NIS/RC)
  y = 750;
  const coor = [
    `NIF: ${company?.taxId ?? "-"}`,
    `NIS: ${company?.nis ?? "-"}`,
    `RC: ${company?.rc ?? "-"}`,
    `Adresse: ${company?.address ?? "-"}`,
  ];
  for (const c of coor) {
    page.drawText(c, { x: M, y, size: 9, font: fm.getFont("latin", "regular"), color: GRAY });
    y -= 13;
  }

  // Bloc employé
  y -= 10;
  page.drawRectangle({ x: M, y: y - 60, width: W - 2 * M, height: 60, color: LIGHT });
  const emp = [
    `Employé: ${slip.employee.firstName} ${slip.employee.lastName}`,
    `Poste: ${slip.employee.jobTitleId ?? "-"}`,
    `NSS: ${slip.employee.nss ?? "-"}`,
    `Date d'embauche: ${slip.employee.hireDate?.toISOString().slice(0, 10) ?? "-"}`,
  ];
  let ey = y - 16;
  for (const e of emp) {
    page.drawText(e, { x: M + 8, y: ey, size: 9, font: fm.getFont("latin", "regular"), color: BLACK });
    ey -= 12;
  }
  y -= 70;

  // Tableau gains
  y = drawSectionTitle(page, fm, "GAINS / المستحقات", M, y, W);
  const earnings = slip.lines.filter((l) => l.kind === "EARNING");
  for (const l of earnings) {
    y = drawRow(page, fm, l.labelAr ?? l.label, dz(l.amount), M, y, W);
  }
  y = drawRow(page, fm, "Salaire Brut / إجمالي الأجر", dz(slip.grossSalary), M, y, W, true);

  // Tableau retenues
  y -= 8;
  y = drawSectionTitle(page, fm, "RETENUES / الاقتطاعات", M, y, W);
  const deductions = slip.lines.filter((l) => l.kind === "EMPLOYEE_DEDUCTION");
  for (const l of deductions) {
    y = drawRow(page, fm, l.labelAr ?? l.label, dz(l.amount), M, y, W);
  }
  y = drawRow(page, fm, "Net à Payer / الصافي", dz(slip.netSalary), M, y, W, true);

  // Charge patronale
  y -= 8;
  y = drawSectionTitle(page, fm, "COTISATIONS PATRONALES / حصة رب العمل", M, y, W);
  y = drawRow(page, fm, "CNAS patronale (26 %)", dz(slip.employerCnas), M, y, W);
  y = drawRow(page, fm, "CASNOS (1 %)", dz(slip.employerCasnos), M, y, W);
  y = drawRow(page, fm, "DAS (1 %)", dz(slip.employerDas), M, y, W);
  y = drawRow(page, fm, "Coût total employeur", dz(slip.totalCost), M, y, W, true);

  // Pied
  page.drawText(`Période: ${slip.period}`, {
    x: M,
    y: 40,
    size: 9,
    font: fm.getFont("latin", "regular"),
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

function drawSectionTitle(
  page: PDFPage,
  fm: FontManager,
  text: string,
  M: number,
  y: number,
  W: number,
): number {
  page.drawRectangle({ x: M, y: y - 18, width: W - 2 * M, height: 18, color: GREEN });
  page.drawText(text, { x: M + 6, y: y - 14, size: 10, font: fm.getFont("latin", "bold"), color: rgb(1, 1, 1) });
  return y - 26;
}

function drawRow(
  page: PDFPage,
  fm: FontManager,
  label: string,
  value: string,
  M: number,
  y: number,
  W: number,
  bold = false,
): number {
  page.drawText(sanitizeText(label), {
    x: M + 6,
    y,
    size: 9,
    font: fm.getFont("latin", bold ? "bold" : "regular"),
    color: BLACK,
  });
  page.drawText(value, {
    x: W - M - 6 - fm.getFont("latin", "regular").widthOfTextAtSize(value, 9),
    y,
    size: 9,
    font: fm.getFont("latin", bold ? "bold" : "regular"),
    color: BLACK,
  });
  return y - 15;
}
