/**
 * Moteur de calcul de paie algérien (IRG + cotisations CNAS/CASNOS/DAS).
 *
 * Références : CGI algérien (art. 86+), sécurité sociale (CNAS/CASNOS/DAS).
 *
 * - CNAS salarial : 9 % (retraite) sur le brut.
 * - CNAS patronale : 26 % (retraite + AT/MP), CASNOS 1 %, DAS 1 %.
 * - IRG : impôt progressif par tranches. Le brut imposable =
 *   (salaire brut − cotisations salariales CNAS) − abattement forfaitaire.
 *   Abattement légal = 40 % du brut imposable, plafonné entre 1 000 DZD
 *   (minimum) et 1 500 DZD (maximum).
 */
import type {
  SocialContributionConfig,
  Employee,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export interface IrgBracketInput {
  min: number;
  max: number | null; // null = au-delà
  rate: number; // décimal
  deductible: number; // abattement forfaitaire par tranche
}

export interface PayrollInput {
  baseSalary: number;
  seniorityBonus?: number;
  housingBonus?: number;
  transportBonus?: number;
  otherBonus?: number;
  otherDeduction?: number;
  brackets: IrgBracketInput[];
  social: SocialContributionConfig;
  /** Abattement forfaitaire IRG (défaut légal : 40 % plafonné 1000..1500). */
  irgFlatDeduction?: number;
  /** Abattement supplémentaire (ex : handicap). */
  extraDeduction?: number;
}

export interface PayrollResult {
  grossSalary: number;
  cnasAmount: number; // salarial 9 %
  taxableBase: number; // brut − CNAS − abattement
  irgAmount: number;
  netSalary: number;
  employerCnas: number;
  employerCasnos: number;
  employerDas: number;
  totalCost: number;
}

// Abattement forfaitaire IRG (Loi de finances) : 40 % plafonné 1000..1500.
const IRG_ABATTEMENT_RATE = 0.4;
const IRG_ABATTEMENT_MIN = 1000;
const IRG_ABATTEMENT_MAX = 1500;
// Taux par défaut si la config société est absente.
const DEF_CNAS_EMP = 0.09;
const DEF_CNAS_PAT = 0.26;
const DEF_CASNOS = 0.01;
const DEF_DAS = 0.01;

export function computePayroll(input: PayrollInput): PayrollResult {
  const base = num(input.baseSalary);
  const seniority = num(input.seniorityBonus);
  const housing = num(input.housingBonus);
  const transport = num(input.transportBonus);
  const other = num(input.otherBonus);
  const otherDed = num(input.otherDeduction);

  const gross = round2(base + seniority + housing + transport + other);

  // Cotisation salariale CNAS (9 %)
  const cnasAmount = round2(gross * Number(input.social.cnasEmployeeRate ?? DEF_CNAS_EMP));

  // Base imposable IRG = brut − CNAS − abattement forfaitaire (40 % plafonné)
  const flatRaw = gross * IRG_ABATTEMENT_RATE;
  const flat = input.irgFlatDeduction ?? clamp(flatRaw, IRG_ABATTEMENT_MIN, IRG_ABATTEMENT_MAX);
  const extra = num(input.extraDeduction);
  const taxableBase = round2(Math.max(0, gross - cnasAmount - flat - extra));

  // IRG progressif
  const irgAmount = round2(computeIrg(taxableBase, input.brackets));

  const netSalary = round2(gross - cnasAmount - irgAmount - otherDed);

  // Charges patronales
  const employerCnas = round2(gross * Number(input.social.cnasEmployerRate ?? DEF_CNAS_PAT));
  const employerCasnos = round2(gross * Number(input.social.casnosEmployerRate ?? DEF_CASNOS));
  const employerDas = round2(gross * Number(input.social.dasEmployerRate ?? DEF_DAS));
  const totalCost = round2(gross + employerCnas + employerCasnos + employerDas);

  return {
    grossSalary: gross,
    cnasAmount,
    taxableBase,
    irgAmount,
    netSalary,
    employerCnas,
    employerCasnos,
    employerDas,
    totalCost,
  };
}

/** IRG progressif : cumul des tranches avec abattement forfaitaire. */
export function computeIrg(taxableBase: number, brackets: IrgBracketInput[]): number {
  if (taxableBase <= 0 || brackets.length === 0) return 0;
  const sorted = [...brackets].sort((a, b) => a.min - b.min);
  let tax = 0;
  for (const b of sorted) {
    const upper = b.max ?? Infinity;
    if (taxableBase <= b.min) break;
    const portion = Math.min(taxableBase, upper) - b.min;
    if (portion <= 0) continue;
    tax += portion * b.rate;
  }
  return Math.max(0, tax);
}

/**
 * Traite une période de paie complète pour une société : pour chaque employé
 * actif, calcule la paie et crée un SalarySlip + ses lignes détaillées.
 * Idempotent : recrée proprement les bulletins de la période.
 */
export async function processPayrollRun(params: {
  payrollRunId: string;
  companyId: string;
  period: string;
  defaultSocial?: SocialContributionConfig;
}): Promise<{ slipsCreated: number }> {
  const { payrollRunId, companyId, period, defaultSocial } = params;

  const social =
    defaultSocial ??
    (await prisma.socialContributionConfig.upsert({
      where: { companyId },
      create: {
        companyId,
        cnasEmployeeRate: DEF_CNAS_EMP,
        cnasEmployerRate: DEF_CNAS_PAT,
        casnosEmployerRate: DEF_CASNOS,
        dasEmployerRate: DEF_DAS,
      },
      update: {},
    }));

  const brackets = await prisma.irgBracket.findMany({ where: { companyId } });
  const bracketInputs: IrgBracketInput[] = brackets.map((b) => ({
    min: Number(b.min),
    max: b.max === null ? null : Number(b.max),
    rate: Number(b.rate),
    deductible: Number(b.deductible),
  }));

  const employees = await prisma.employee.findMany({
    where: { companyId, status: "ACTIVE", endDate: null },
  });

  let slipsCreated = 0;
  for (const emp of employees) {
    const input: PayrollInput = {
      baseSalary: Number(emp.baseSalary ?? 0),
      seniorityBonus: Number(emp.seniorityBonus ?? 0),
      housingBonus: Number(emp.housingBonus ?? 0),
      transportBonus: Number(emp.transportBonus ?? 0),
      otherBonus: Number(emp.otherBonus ?? 0),
      brackets: bracketInputs,
      social,
    };
    const r = computePayroll(input);

    await prisma.salarySlip.deleteMany({ where: { payrollRunId, employeeId: emp.id } });

    await prisma.salarySlip.create({
      data: {
        companyId,
        employeeId: emp.id,
        payrollRunId,
        period,
        baseSalary: r.grossSalary, // SBA + primes cotisables (voir note)
        seniorityBonus: input.seniorityBonus,
        housingBonus: input.housingBonus,
        transportBonus: input.transportBonus,
        otherBonus: input.otherBonus,
        grossSalary: r.grossSalary,
        irgAmount: r.irgAmount,
        cnasAmount: r.cnasAmount,
        netSalary: r.netSalary,
        employerCnas: r.employerCnas,
        employerCasnos: r.employerCasnos,
        employerDas: r.employerDas,
        totalCost: r.totalCost,
        lines: {
          create: buildSlipLines(emp, r),
        },
      },
    });
    slipsCreated++;
  }

  return { slipsCreated };
}

function buildSlipLines(
  emp: Employee,
  r: PayrollResult,
): Prisma.SalarySlipLineCreateWithoutSalarySlipInput[] {
  return [
    { label: "Salaire de base", labelAr: "الأجر الأساسي", kind: "EARNING", amount: num(emp.baseSalary) },
    { label: "Prime d'ancienneté", labelAr: "منحة الأقدمية", kind: "EARNING", amount: num(emp.seniorityBonus) },
    { label: "Indemnité de logement", labelAr: "منحة السكن", kind: "EARNING", amount: num(emp.housingBonus) },
    { label: "Indemnité de transport", labelAr: "منحة النقل", kind: "EARNING", amount: num(emp.transportBonus) },
    { label: "Primes diverses", labelAr: "منح متنوعة", kind: "EARNING", amount: num(emp.otherBonus) },
    { label: "CNAS (salarial 9 %)", labelAr: "كناس (حصة العامل 9%)", kind: "EMPLOYEE_DEDUCTION", amount: r.cnasAmount },
    { label: "IRG retenu à la source", labelAr: "IRG المحتجز من المصدر", kind: "EMPLOYEE_DEDUCTION", amount: r.irgAmount },
    { label: "CNAS patronale (26 %)", labelAr: "كناس رب العمل (26%)", kind: "EMPLOYER_CHARGE", amount: r.employerCnas },
    { label: "CASNOS (1 %)", labelAr: "كاسنوس (1%)", kind: "EMPLOYER_CHARGE", amount: r.employerCasnos },
    { label: "DAS (1 %)", labelAr: "داس (1%)", kind: "EMPLOYER_CHARGE", amount: r.employerDas },
  ];
}

function num(n: unknown): number {
  return Number(n) || 0;
}
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}
