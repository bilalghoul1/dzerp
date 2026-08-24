-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'VALIDATED', 'PAID');

-- CreateEnum
CREATE TYPE "SalaryLineKind" AS ENUM ('EARNING', 'EMPLOYEE_DEDUCTION', 'EMPLOYER_CHARGE');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "stampAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "tapAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "tapRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "totalDue" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "label" TEXT,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalarySlip" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "baseSalary" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "seniorityBonus" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "housingBonus" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "transportBonus" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "otherBonus" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "grossSalary" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "irgAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cnasAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "otherDeduction" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "netSalary" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "employerCnas" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "employerCasnos" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "employerDas" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalarySlip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalarySlipLine" (
    "id" TEXT NOT NULL,
    "salarySlipId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelAr" TEXT,
    "kind" "SalaryLineKind" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "SalarySlipLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IrgBracket" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "min" DECIMAL(65,30) NOT NULL,
    "max" DECIMAL(65,30),
    "rate" DECIMAL(65,30) NOT NULL,
    "deductible" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "label" TEXT,
    "labelAr" TEXT,

    CONSTRAINT "IrgBracket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialContributionConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "cnasEmployeeRate" DECIMAL(65,30) NOT NULL DEFAULT 0.09,
    "cnasEmployerRate" DECIMAL(65,30) NOT NULL DEFAULT 0.26,
    "casnosEmployerRate" DECIMAL(65,30) NOT NULL DEFAULT 0.01,
    "dasEmployerRate" DECIMAL(65,30) NOT NULL DEFAULT 0.01,

    CONSTRAINT "SocialContributionConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollRun_period_idx" ON "PayrollRun"("period");

-- CreateIndex
CREATE INDEX "PayrollRun_status_idx" ON "PayrollRun"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_companyId_period_key" ON "PayrollRun"("companyId", "period");

-- CreateIndex
CREATE INDEX "SalarySlip_employeeId_idx" ON "SalarySlip"("employeeId");

-- CreateIndex
CREATE INDEX "SalarySlip_period_idx" ON "SalarySlip"("period");

-- CreateIndex
CREATE UNIQUE INDEX "SalarySlip_payrollRunId_employeeId_key" ON "SalarySlip"("payrollRunId", "employeeId");

-- CreateIndex
CREATE INDEX "SalarySlipLine_salarySlipId_idx" ON "SalarySlipLine"("salarySlipId");

-- CreateIndex
CREATE INDEX "IrgBracket_companyId_idx" ON "IrgBracket"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialContributionConfig_companyId_key" ON "SocialContributionConfig"("companyId");

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalarySlip" ADD CONSTRAINT "SalarySlip_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalarySlip" ADD CONSTRAINT "SalarySlip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalarySlip" ADD CONSTRAINT "SalarySlip_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalarySlipLine" ADD CONSTRAINT "SalarySlipLine_salarySlipId_fkey" FOREIGN KEY ("salarySlipId") REFERENCES "SalarySlip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IrgBracket" ADD CONSTRAINT "IrgBracket_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialContributionConfig" ADD CONSTRAINT "SocialContributionConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

