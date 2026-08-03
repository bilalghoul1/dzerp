/*
  Warnings:

  - Added the required column `customerId` to the `CreditNote` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customerId` to the `DeliveryNote` table without a default value. This is not possible if the table is not empty.
  - Added the required column `supplierId` to the `GoodsReceipt` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customerId` to the `Invoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `supplierId` to the `PurchaseOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `supplierId` to the `PurchaseRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customerId` to the `Quotation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customerId` to the `SalesOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `supplierId` to the `SupplierInvoice` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CreditNote" ADD COLUMN     "customerId" TEXT NOT NULL,
ALTER COLUMN "clientId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "DeliveryNote" ADD COLUMN     "customerId" TEXT NOT NULL,
ALTER COLUMN "clientId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "GoodsReceipt" ADD COLUMN     "supplierId" TEXT NOT NULL,
ALTER COLUMN "clientId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "customerId" TEXT NOT NULL,
ALTER COLUMN "clientId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "supplierId" TEXT NOT NULL,
ALTER COLUMN "clientId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PurchaseRequest" ADD COLUMN     "supplierId" TEXT NOT NULL,
ALTER COLUMN "clientId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "customerId" TEXT NOT NULL,
ALTER COLUMN "clientId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN     "customerId" TEXT NOT NULL,
ALTER COLUMN "clientId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SupplierInvoice" ADD COLUMN     "supplierId" TEXT NOT NULL,
ALTER COLUMN "clientId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "ClientType" NOT NULL DEFAULT 'COMPANY',
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "legalName" TEXT,
    "commercialName" TEXT,
    "legalForm" TEXT,
    "activity" TEXT,
    "sector" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "taxId" TEXT,
    "rc" TEXT,
    "nis" TEXT,
    "ai" TEXT,
    "vatNumber" TEXT,
    "address" TEXT,
    "wilaya" TEXT,
    "commune" TEXT,
    "postalCode" TEXT,
    "paymentTerms" TEXT,
    "creditLimit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "balance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "ClientType" NOT NULL DEFAULT 'COMPANY',
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "legalName" TEXT,
    "commercialName" TEXT,
    "legalForm" TEXT,
    "activity" TEXT,
    "sector" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "taxId" TEXT,
    "rc" TEXT,
    "nis" TEXT,
    "ai" TEXT,
    "vatNumber" TEXT,
    "address" TEXT,
    "wilaya" TEXT,
    "commune" TEXT,
    "postalCode" TEXT,
    "paymentTerms" TEXT,
    "creditLimit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "balance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_code_key" ON "Customer"("code");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE INDEX "Customer_type_idx" ON "Customer"("type");

-- CreateIndex
CREATE INDEX "Customer_sector_idx" ON "Customer"("sector");

-- CreateIndex
CREATE INDEX "Customer_createdAt_idx" ON "Customer"("createdAt");

-- CreateIndex
CREATE INDEX "Customer_deletedAt_idx" ON "Customer"("deletedAt");

-- CreateIndex
CREATE INDEX "Customer_createdById_idx" ON "Customer"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");

-- CreateIndex
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

-- CreateIndex
CREATE INDEX "Supplier_type_idx" ON "Supplier"("type");

-- CreateIndex
CREATE INDEX "Supplier_sector_idx" ON "Supplier"("sector");

-- CreateIndex
CREATE INDEX "Supplier_createdAt_idx" ON "Supplier"("createdAt");

-- CreateIndex
CREATE INDEX "Supplier_deletedAt_idx" ON "Supplier"("deletedAt");

-- CreateIndex
CREATE INDEX "Supplier_createdById_idx" ON "Supplier"("createdById");

-- CreateIndex
CREATE INDEX "CreditNote_customerId_idx" ON "CreditNote"("customerId");

-- CreateIndex
CREATE INDEX "DeliveryNote_customerId_idx" ON "DeliveryNote"("customerId");

-- CreateIndex
CREATE INDEX "GoodsReceipt_supplierId_idx" ON "GoodsReceipt"("supplierId");

-- CreateIndex
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_supplierId_idx" ON "PurchaseRequest"("supplierId");

-- CreateIndex
CREATE INDEX "Quotation_customerId_idx" ON "Quotation"("customerId");

-- CreateIndex
CREATE INDEX "SalesOrder_customerId_idx" ON "SalesOrder"("customerId");

-- CreateIndex
CREATE INDEX "SupplierInvoice_supplierId_idx" ON "SupplierInvoice"("supplierId");

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryNote" ADD CONSTRAINT "DeliveryNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: migrate legacy seeded Client rows (CUSTOMER kind) into the new
-- Customer table with generated CUS codes. Add-only; the Client table stays.
INSERT INTO "Customer" (
  "id", "code", "type", "name", "nameAr", "firstName", "lastName",
  "legalName", "commercialName", "legalForm", "activity", "sector",
  "email", "phone", "taxId", "rc", "nis", "ai", "vatNumber",
  "address", "wilaya", "commune", "postalCode", "paymentTerms",
  "creditLimit", "notes", "balance", "isActive", "createdAt", "updatedAt",
  "createdById", "updatedById"
)
SELECT
  "id",
  'CUS-' || lpad(row_number() OVER (ORDER BY "createdAt", "id")::text, 6, '0'),
  "type", "name", "nameAr", "firstName", "lastName",
  "legalName", "commercialName", "legalForm", "activity", "sector",
  "email", "phone", "taxId", "rc", "nis", "ai", "vatNumber",
  "address", "wilaya", "commune", "postalCode", "paymentTerms",
  "creditLimit", "notes", "balance", "isActive", "createdAt", "updatedAt",
  "createdById", "updatedById"
FROM "Client"
WHERE "deletedAt" IS NULL
ORDER BY "createdAt", "id";
