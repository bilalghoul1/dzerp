-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "bank" TEXT,
ADD COLUMN     "bankAccount" TEXT,
ADD COLUMN     "bankAgency" TEXT,
ADD COLUMN     "capital" DECIMAL(65,30),
ADD COLUMN     "commercialName" TEXT,
ADD COLUMN     "defaultBranchId" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "emailFooter" TEXT,
ADD COLUMN     "establishedAt" TIMESTAMP(3),
ADD COLUMN     "expiryDate" TIMESTAMP(3),
ADD COLUMN     "iban" TEXT,
ADD COLUMN     "invoiceFooter" TEXT,
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'fr',
ADD COLUMN     "logoKey" TEXT,
ADD COLUMN     "mobile" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "primaryColor" TEXT,
ADD COLUMN     "printFormat" TEXT NOT NULL DEFAULT 'A4',
ADD COLUMN     "printHeader" TEXT,
ADD COLUMN     "printMargins" JSONB,
ADD COLUMN     "qrEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rib" TEXT,
ADD COLUMN     "secondaryActivity" TEXT,
ADD COLUMN     "secondaryColor" TEXT,
ADD COLUMN     "signatureKey" TEXT,
ADD COLUMN     "stampKey" TEXT,
ADD COLUMN     "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "swift" TEXT,
ADD COLUMN     "type" TEXT;

-- AlterTable
ALTER TABLE "UserCompany" ADD COLUMN     "defaultBranchId" TEXT;

-- CreateTable
CREATE TABLE "CompanyDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyDraft_userId_key" ON "CompanyDraft"("userId");

-- CreateIndex
CREATE INDEX "CompanyDraft_updatedAt_idx" ON "CompanyDraft"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Company_defaultBranchId_key" ON "Company"("defaultBranchId");

-- CreateIndex
CREATE INDEX "Company_status_idx" ON "Company"("status");

-- CreateIndex
CREATE INDEX "Company_deletedAt_idx" ON "Company"("deletedAt");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_defaultBranchId_fkey" FOREIGN KEY ("defaultBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyDraft" ADD CONSTRAINT "CompanyDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCompany" ADD CONSTRAINT "UserCompany_defaultBranchId_fkey" FOREIGN KEY ("defaultBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Phase 5.5 : rétro-remplissage (backfill)
-- ---------------------------------------------------------------------------

-- 1) Statut initial dérivé de l'état actif existant.
UPDATE "Company" SET "status" = 'INACTIVE' WHERE "isActive" = false AND "status" = 'ACTIVE';

-- 2) Succursale par défaut : siège (HEADQUARTER) de chaque société active,
--    sinon première succursale créée.
UPDATE "Company" c
SET "defaultBranchId" = (
  SELECT b."id" FROM "Branch" b
  WHERE b."companyId" = c."id"
  ORDER BY CASE WHEN b."type" = 'HEADQUARTER' THEN 0 ELSE 1 END, b."createdAt" ASC
  LIMIT 1
)
WHERE "defaultBranchId" IS NULL;
