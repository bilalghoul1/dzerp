-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('COMPANY', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "PartyKind" AS ENUM ('CUSTOMER', 'SUPPLIER', 'BOTH');

-- CreateEnum
CREATE TYPE "PrintFormat" AS ENUM ('A4', 'A5', 'THERMAL');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "ai" TEXT,
ADD COLUMN     "commune" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "manager" TEXT,
ADD COLUMN     "nif" TEXT,
ADD COLUMN     "nis" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "rc" TEXT,
ADD COLUMN     "wilaya" TEXT;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "activity" TEXT,
ADD COLUMN     "ai" TEXT,
ADD COLUMN     "commercialName" TEXT,
ADD COLUMN     "commune" TEXT,
ADD COLUMN     "creditLimit" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "kind" "PartyKind" NOT NULL DEFAULT 'CUSTOMER',
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "legalForm" TEXT,
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "nis" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "rc" TEXT,
ADD COLUMN     "type" "ClientType" NOT NULL DEFAULT 'COMPANY',
ADD COLUMN     "vatNumber" TEXT,
ADD COLUMN     "wilaya" TEXT;

-- CreateTable
CREATE TABLE "Country" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalForm" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "LegalForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessSector" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "BusinessSector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "days" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wilaya" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wilaya_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commune" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "wilayaCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Commune_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bank" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "swift" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "Bank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentApproval" (
    "id" TEXT NOT NULL,
    "docType" "DocType" NOT NULL,
    "docId" TEXT NOT NULL,
    "requestedById" TEXT,
    "approverId" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Country_code_key" ON "Country"("code");

-- CreateIndex
CREATE INDEX "Country_isActive_idx" ON "Country"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LegalForm_code_key" ON "LegalForm"("code");

-- CreateIndex
CREATE INDEX "LegalForm_isActive_idx" ON "LegalForm"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessSector_code_key" ON "BusinessSector"("code");

-- CreateIndex
CREATE INDEX "BusinessSector_isActive_idx" ON "BusinessSector"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_code_key" ON "PaymentMethod"("code");

-- CreateIndex
CREATE INDEX "PaymentMethod_isActive_idx" ON "PaymentMethod"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Wilaya_code_key" ON "Wilaya"("code");

-- CreateIndex
CREATE INDEX "Wilaya_isActive_idx" ON "Wilaya"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Commune_code_key" ON "Commune"("code");

-- CreateIndex
CREATE INDEX "Commune_wilayaCode_idx" ON "Commune"("wilayaCode");

-- CreateIndex
CREATE INDEX "Commune_isActive_idx" ON "Commune"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Bank_code_key" ON "Bank"("code");

-- CreateIndex
CREATE INDEX "Bank_isActive_idx" ON "Bank"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentApproval_docId_key" ON "DocumentApproval"("docId");

-- CreateIndex
CREATE INDEX "DocumentApproval_docType_idx" ON "DocumentApproval"("docType");

-- CreateIndex
CREATE INDEX "DocumentApproval_status_idx" ON "DocumentApproval"("status");

-- CreateIndex
CREATE INDEX "DocumentApproval_approverId_idx" ON "DocumentApproval"("approverId");

-- CreateIndex
CREATE INDEX "Branch_wilaya_idx" ON "Branch"("wilaya");

-- CreateIndex
CREATE INDEX "Client_kind_idx" ON "Client"("kind");

-- CreateIndex
CREATE INDEX "Client_type_idx" ON "Client"("type");

-- AddForeignKey
ALTER TABLE "Commune" ADD CONSTRAINT "Commune_wilayaCode_fkey" FOREIGN KEY ("wilayaCode") REFERENCES "Wilaya"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentApproval" ADD CONSTRAINT "DocumentApproval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentApproval" ADD CONSTRAINT "DocumentApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
