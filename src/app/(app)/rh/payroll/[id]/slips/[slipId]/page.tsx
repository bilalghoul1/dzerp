import { notFound, redirect } from "next/navigation";
import { requirePermission, getCurrentUser } from "@/features/auth/rbac";
import { getOrResolveCompanyContext } from "@/features/company/context";
import { PageHeader } from "@/components/page/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function dz(n: unknown): string {
  const v = Number(n) || 0;
  return (
    v.toLocaleString("fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
    " دج"
  );
}

export default async function SalarySlipPage({
  params,
}: {
  params: Promise<{ id: string; slipId: string }>;
}) {
  const { id, slipId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requirePermission("rh.view");
  const ctx = await getOrResolveCompanyContext();
  if (!ctx) redirect("/admin/companies");

  const slip = await prisma.salarySlip.findUnique({
    where: { id: slipId },
    include: {
      employee: true,
      payrollRun: true,
      lines: true,
    },
  });

  if (!slip || slip.payrollRunId !== id || slip.companyId !== ctx.company.id) {
    notFound();
  }

  const earnings = slip.lines.filter((l) => l.kind === "EARNING");
  const employeeDeductions = slip.lines.filter((l) => l.kind === "EMPLOYEE_DEDUCTION");
  const employerCharges = slip.lines.filter((l) => l.kind === "EMPLOYER_CHARGE");

  return (
    <div>
      <PageHeader
        title={`Bulletin de paie — ${slip.period}`}
        description={`${slip.employee.firstName} ${slip.employee.lastName}`}
        actions={
          <a
            href={`/api/payroll/${slip.payrollRunId}/slips/${slip.id}/pdf`}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            Exporter PDF
          </a>
        }
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Gains</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {earnings.map((l) => (
              <Row key={l.id} label={l.labelAr ?? l.label} value={dz(l.amount)} />
            ))}
            <Row label="Salaire brut" value={dz(slip.grossSalary)} bold />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Retenues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {employeeDeductions.map((l) => (
              <Row key={l.id} label={l.labelAr ?? l.label} value={dz(l.amount)} />
            ))}
            <Row label="Salaire net à payer" value={dz(slip.netSalary)} bold />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Charges patronales</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-3">
            {employerCharges.map((l) => (
              <Row key={l.id} label={l.labelAr ?? l.label} value={dz(l.amount)} />
            ))}
            <Row label="Coût total employeur" value={dz(slip.totalCost)} bold />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b py-1.5 text-sm last:border-0">
      <span className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className={bold ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}
