-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocType" ADD VALUE 'CUSTOMER_ORDER';
ALTER TYPE "DocType" ADD VALUE 'PROFORMA';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentStatus" ADD VALUE 'RECEIVED';
ALTER TYPE "DocumentStatus" ADD VALUE 'UNDER_REVIEW';
ALTER TYPE "DocumentStatus" ADD VALUE 'PROFORMA_CREATED';
ALTER TYPE "DocumentStatus" ADD VALUE 'PROFORMA_SENT';
ALTER TYPE "DocumentStatus" ADD VALUE 'ACCEPTED';
ALTER TYPE "DocumentStatus" ADD VALUE 'COMPLETED';

-- CreateTable
CREATE TABLE "CustomerOrder" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'RECEIVED',
    "clientId" TEXT,
    "branchId" TEXT NOT NULL,
    "issuedById" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedDate" TIMESTAMP(3),
    "customerOrderNumber" TEXT,
    "customerOrderDate" TIMESTAMP(3),
    "requestedDeliveryDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'DZD',
    "conditions" TEXT,
    "notes" TEXT,
    "totalHt" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalTva" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalTtc" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "customerId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "exchangeRate" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "meta" JSONB,

    CONSTRAINT "CustomerOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerOrderLine" (
    "id" TEXT NOT NULL,
    "customerOrderId" TEXT NOT NULL,
    "productId" TEXT,
    "lineNumber" INTEGER NOT NULL DEFAULT 1,
    "label" TEXT NOT NULL,
    "unit" TEXT,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discountPct" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxPct" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "amountHt" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "amountTva" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "amountTtc" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "kind" "DocumentLineKind" NOT NULL DEFAULT 'PRODUCT',
    "customerSpecs" TEXT,

    CONSTRAINT "CustomerOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proforma" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "clientId" TEXT,
    "branchId" TEXT NOT NULL,
    "customerOrderId" TEXT,
    "issuedById" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'DZD',
    "conditions" TEXT,
    "notes" TEXT,
    "totalHt" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalTva" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalTtc" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "customerId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "exchangeRate" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "meta" JSONB,

    CONSTRAINT "Proforma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProformaLine" (
    "id" TEXT NOT NULL,
    "proformaId" TEXT NOT NULL,
    "productId" TEXT,
    "lineNumber" INTEGER NOT NULL DEFAULT 1,
    "label" TEXT NOT NULL,
    "unit" TEXT,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discountPct" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxPct" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "amountHt" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "amountTva" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "amountTtc" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "kind" "DocumentLineKind" NOT NULL DEFAULT 'PRODUCT',
    "customerSpecs" TEXT,

    CONSTRAINT "ProformaLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerOrder_clientId_idx" ON "CustomerOrder"("clientId");

-- CreateIndex
CREATE INDEX "CustomerOrder_customerId_idx" ON "CustomerOrder"("customerId");

-- CreateIndex
CREATE INDEX "CustomerOrder_branchId_idx" ON "CustomerOrder"("branchId");

-- CreateIndex
CREATE INDEX "CustomerOrder_status_idx" ON "CustomerOrder"("status");

-- CreateIndex
CREATE INDEX "CustomerOrder_customerOrderNumber_idx" ON "CustomerOrder"("customerOrderNumber");

-- CreateIndex
CREATE INDEX "CustomerOrder_receivedDate_idx" ON "CustomerOrder"("receivedDate");

-- CreateIndex
CREATE INDEX "CustomerOrder_issuedAt_idx" ON "CustomerOrder"("issuedAt");

-- CreateIndex
CREATE INDEX "CustomerOrder_createdById_idx" ON "CustomerOrder"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerOrder_companyId_number_key" ON "CustomerOrder"("companyId", "number");

-- CreateIndex
CREATE INDEX "CustomerOrderLine_customerOrderId_idx" ON "CustomerOrderLine"("customerOrderId");

-- CreateIndex
CREATE INDEX "CustomerOrderLine_productId_idx" ON "CustomerOrderLine"("productId");

-- CreateIndex
CREATE INDEX "Proforma_clientId_idx" ON "Proforma"("clientId");

-- CreateIndex
CREATE INDEX "Proforma_customerId_idx" ON "Proforma"("customerId");

-- CreateIndex
CREATE INDEX "Proforma_branchId_idx" ON "Proforma"("branchId");

-- CreateIndex
CREATE INDEX "Proforma_status_idx" ON "Proforma"("status");

-- CreateIndex
CREATE INDEX "Proforma_customerOrderId_idx" ON "Proforma"("customerOrderId");

-- CreateIndex
CREATE INDEX "Proforma_validUntil_idx" ON "Proforma"("validUntil");

-- CreateIndex
CREATE INDEX "Proforma_issuedAt_idx" ON "Proforma"("issuedAt");

-- CreateIndex
CREATE INDEX "Proforma_createdById_idx" ON "Proforma"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Proforma_companyId_number_key" ON "Proforma"("companyId", "number");

-- CreateIndex
CREATE INDEX "ProformaLine_proformaId_idx" ON "ProformaLine"("proformaId");

-- CreateIndex
CREATE INDEX "ProformaLine_productId_idx" ON "ProformaLine"("productId");

-- AddForeignKey
ALTER TABLE "CustomerOrder" ADD CONSTRAINT "CustomerOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerOrder" ADD CONSTRAINT "CustomerOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerOrder" ADD CONSTRAINT "CustomerOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerOrder" ADD CONSTRAINT "CustomerOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerOrder" ADD CONSTRAINT "CustomerOrder_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerOrderLine" ADD CONSTRAINT "CustomerOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerOrderLine" ADD CONSTRAINT "CustomerOrderLine_customerOrderId_fkey" FOREIGN KEY ("customerOrderId") REFERENCES "CustomerOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proforma" ADD CONSTRAINT "Proforma_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proforma" ADD CONSTRAINT "Proforma_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proforma" ADD CONSTRAINT "Proforma_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proforma" ADD CONSTRAINT "Proforma_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proforma" ADD CONSTRAINT "Proforma_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proforma" ADD CONSTRAINT "Proforma_customerOrderId_fkey" FOREIGN KEY ("customerOrderId") REFERENCES "CustomerOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProformaLine" ADD CONSTRAINT "ProformaLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProformaLine" ADD CONSTRAINT "ProformaLine_proformaId_fkey" FOREIGN KEY ("proformaId") REFERENCES "Proforma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

