-- CreateEnum
CREATE TYPE "TaxDeclarationKind" AS ENUM ('TVA', 'TAP', 'IRG');

-- CreateEnum
CREATE TYPE "TaxDeclarationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PAID');

-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('BUILDING', 'EQUIPMENT', 'VEHICLE', 'IT', 'OTHER');

-- CreateTable
CREATE TABLE "TaxDeclaration" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "kind" "TaxDeclarationKind" NOT NULL,
    "period" TEXT NOT NULL,
    "status" "TaxDeclarationStatus" NOT NULL DEFAULT 'DRAFT',
    "baseAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "TaxDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankReconciliation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bankAccount" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "statementBalance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "bookBalance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "difference" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "category" "AssetCategory" NOT NULL DEFAULT 'EQUIPMENT',
    "acquisitionDate" TIMESTAMP(3) NOT NULL,
    "acquisitionCost" DECIMAL(18,4) NOT NULL,
    "residualValue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "usefulLifeYears" INTEGER NOT NULL DEFAULT 5,
    "depreciationMethod" TEXT NOT NULL DEFAULT 'LINEAR',
    "accumulatedDepreciation" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "bookValue" DECIMAL(18,4) NOT NULL,
    "accountId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FixedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaxDeclaration_companyId_idx" ON "TaxDeclaration"("companyId");

-- CreateIndex
CREATE INDEX "TaxDeclaration_kind_idx" ON "TaxDeclaration"("kind");

-- CreateIndex
CREATE INDEX "TaxDeclaration_period_idx" ON "TaxDeclaration"("period");

-- CreateIndex
CREATE INDEX "TaxDeclaration_status_idx" ON "TaxDeclaration"("status");

-- CreateIndex
CREATE INDEX "BankReconciliation_companyId_idx" ON "BankReconciliation"("companyId");

-- CreateIndex
CREATE INDEX "BankReconciliation_period_idx" ON "BankReconciliation"("period");

-- CreateIndex
CREATE INDEX "FixedAsset_companyId_idx" ON "FixedAsset"("companyId");

-- CreateIndex
CREATE INDEX "FixedAsset_category_idx" ON "FixedAsset"("category");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAsset_companyId_code_key" ON "FixedAsset"("companyId", "code");

-- AddForeignKey
ALTER TABLE "TaxDeclaration" ADD CONSTRAINT "TaxDeclaration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

