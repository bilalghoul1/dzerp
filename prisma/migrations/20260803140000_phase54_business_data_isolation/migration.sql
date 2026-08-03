-- Phase 5.4 — Isolation des données par société
-- Ajout de companyId sur les modèles métier, contraintes uniques par société,
-- et rétrocompatibilité : rattachement des données existantes à la société par défaut.

-- DropIndex (les codes/numéros deviennent uniques par société)
DROP INDEX "Branch_code_key";
DROP INDEX "Brand_code_key";
DROP INDEX "CreditNote_number_key";
DROP INDEX "Customer_code_key";
DROP INDEX "DeliveryNote_number_key";
DROP INDEX "DocumentSeries_docType_key";
DROP INDEX "DocumentSeries_key_key";
DROP INDEX "GoodsReceipt_number_key";
DROP INDEX "Invoice_number_key";
DROP INDEX "Manufacturer_code_key";
DROP INDEX "Product_code_key";
DROP INDEX "Product_sku_key";
DROP INDEX "ProductCategory_code_key";
DROP INDEX "PurchaseOrder_number_key";
DROP INDEX "PurchaseRequest_number_key";
DROP INDEX "Quotation_number_key";
DROP INDEX "SalesOrder_number_key";
DROP INDEX "Supplier_code_key";
DROP INDEX "SupplierInvoice_number_key";
DROP INDEX "Warehouse_code_key";

-- AlterTable — colonnes companyId (nullable dans un premier temps)
ALTER TABLE "ActivityEvent" ADD COLUMN "companyId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Branch" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Brand" ADD COLUMN "companyId" TEXT;
ALTER TABLE "CreditNote" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Customer" ADD COLUMN "companyId" TEXT;
ALTER TABLE "DeliveryNote" ADD COLUMN "companyId" TEXT;
ALTER TABLE "DocumentApproval" ADD COLUMN "companyId" TEXT;
ALTER TABLE "DocumentSeries" ADD COLUMN "companyId" TEXT;
ALTER TABLE "FileAsset" ADD COLUMN "companyId" TEXT;
ALTER TABLE "GoodsReceipt" ADD COLUMN "companyId" TEXT;
ALTER TABLE "InventoryMovement" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Manufacturer" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Product" ADD COLUMN "companyId" TEXT;
ALTER TABLE "ProductCategory" ADD COLUMN "companyId" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN "companyId" TEXT;
ALTER TABLE "PurchaseRequest" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Quotation" ADD COLUMN "companyId" TEXT;
ALTER TABLE "SalesOrder" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "companyId" TEXT;
ALTER TABLE "SupplierInvoice" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Warehouse" ADD COLUMN "companyId" TEXT;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Manufacturer" ADD CONSTRAINT "Manufacturer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentSeries" ADD CONSTRAINT "DocumentSeries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentApproval" ADD CONSTRAINT "DocumentApproval_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryNote" ADD CONSTRAINT "DeliveryNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ==========================================================================
-- Phase 5.4 — Rétrocompatibilité : rattachement des données existantes
--   à la société par défaut (créée en Phase 5.3).
-- ==========================================================================
DO $$
DECLARE
  company_id TEXT;
BEGIN
  -- Société par défaut, sinon première société existante, sinon création.
  IF NOT EXISTS (SELECT 1 FROM "Company") THEN
    INSERT INTO "Company" ("id", "code", "name", "currency", "isDefault", "isActive", "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, 'MAIN', 'DzERP Algérie', 'DZD', true, true, now(), now());
  END IF;

  SELECT id INTO company_id FROM "Company" WHERE "isDefault" = true ORDER BY "createdAt" LIMIT 1;
  IF company_id IS NULL THEN
    SELECT id INTO company_id FROM "Company" ORDER BY "createdAt" LIMIT 1;
  END IF;

  UPDATE "Branch" SET "companyId" = company_id;
  UPDATE "Brand" SET "companyId" = company_id;
  UPDATE "CreditNote" SET "companyId" = company_id;
  UPDATE "Customer" SET "companyId" = company_id;
  UPDATE "DeliveryNote" SET "companyId" = company_id;
  UPDATE "DocumentApproval" SET "companyId" = company_id;
  UPDATE "DocumentSeries" SET "companyId" = company_id;
  UPDATE "FileAsset" SET "companyId" = company_id;
  UPDATE "GoodsReceipt" SET "companyId" = company_id;
  UPDATE "InventoryMovement" SET "companyId" = company_id;
  UPDATE "Invoice" SET "companyId" = company_id;
  UPDATE "Manufacturer" SET "companyId" = company_id;
  UPDATE "Product" SET "companyId" = company_id;
  UPDATE "ProductCategory" SET "companyId" = company_id;
  UPDATE "PurchaseOrder" SET "companyId" = company_id;
  UPDATE "PurchaseRequest" SET "companyId" = company_id;
  UPDATE "Quotation" SET "companyId" = company_id;
  UPDATE "SalesOrder" SET "companyId" = company_id;
  UPDATE "Supplier" SET "companyId" = company_id;
  UPDATE "SupplierInvoice" SET "companyId" = company_id;
  UPDATE "Warehouse" SET "companyId" = company_id;
  -- Tables à companyId nullable : les lignes existantes restent rattachées aussi.
  UPDATE "ActivityEvent" SET "companyId" = company_id;
  UPDATE "AuditLog" SET "companyId" = company_id;

  RAISE NOTICE 'Phase 5.4 : données rattachées à la société % (id %).', company_id, company_id;
END $$;

-- AlterTable — companyId devient obligatoire sur les tables métier strictes.
-- (ActivityEvent et AuditLog restent nullable pour les événements hors contexte.)
ALTER TABLE "Branch" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Brand" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "CreditNote" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Customer" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "DeliveryNote" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "DocumentApproval" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "DocumentSeries" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "FileAsset" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "GoodsReceipt" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "InventoryMovement" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Manufacturer" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "ProductCategory" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "PurchaseOrder" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "PurchaseRequest" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Quotation" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "SalesOrder" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Supplier" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "SupplierInvoice" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Warehouse" ALTER COLUMN "companyId" SET NOT NULL;

-- CreateIndex — index par société
CREATE INDEX "ActivityEvent_companyId_idx" ON "ActivityEvent"("companyId");
CREATE INDEX "AuditLog_companyId_idx" ON "AuditLog"("companyId");
CREATE UNIQUE INDEX "Branch_companyId_code_key" ON "Branch"("companyId", "code");
CREATE UNIQUE INDEX "Brand_companyId_code_key" ON "Brand"("companyId", "code");
CREATE UNIQUE INDEX "CreditNote_companyId_number_key" ON "CreditNote"("companyId", "number");
CREATE UNIQUE INDEX "Customer_companyId_code_key" ON "Customer"("companyId", "code");
CREATE UNIQUE INDEX "DeliveryNote_companyId_number_key" ON "DeliveryNote"("companyId", "number");
CREATE INDEX "DocumentApproval_companyId_idx" ON "DocumentApproval"("companyId");
CREATE UNIQUE INDEX "DocumentSeries_companyId_key_key" ON "DocumentSeries"("companyId", "key");
CREATE UNIQUE INDEX "DocumentSeries_companyId_docType_key" ON "DocumentSeries"("companyId", "docType");
CREATE INDEX "FileAsset_companyId_idx" ON "FileAsset"("companyId");
CREATE UNIQUE INDEX "GoodsReceipt_companyId_number_key" ON "GoodsReceipt"("companyId", "number");
CREATE UNIQUE INDEX "InventoryMovement_companyId_number_key" ON "InventoryMovement"("companyId", "number");
CREATE UNIQUE INDEX "Invoice_companyId_number_key" ON "Invoice"("companyId", "number");
CREATE UNIQUE INDEX "Manufacturer_companyId_code_key" ON "Manufacturer"("companyId", "code");
CREATE UNIQUE INDEX "Product_companyId_code_key" ON "Product"("companyId", "code");
CREATE UNIQUE INDEX "Product_companyId_sku_key" ON "Product"("companyId", "sku");
CREATE UNIQUE INDEX "ProductCategory_companyId_code_key" ON "ProductCategory"("companyId", "code");
CREATE UNIQUE INDEX "PurchaseOrder_companyId_number_key" ON "PurchaseOrder"("companyId", "number");
CREATE UNIQUE INDEX "PurchaseRequest_companyId_number_key" ON "PurchaseRequest"("companyId", "number");
CREATE UNIQUE INDEX "Quotation_companyId_number_key" ON "Quotation"("companyId", "number");
CREATE UNIQUE INDEX "SalesOrder_companyId_number_key" ON "SalesOrder"("companyId", "number");
CREATE UNIQUE INDEX "Supplier_companyId_code_key" ON "Supplier"("companyId", "code");
CREATE UNIQUE INDEX "SupplierInvoice_companyId_number_key" ON "SupplierInvoice"("companyId", "number");
CREATE UNIQUE INDEX "Warehouse_companyId_code_key" ON "Warehouse"("companyId", "code");
