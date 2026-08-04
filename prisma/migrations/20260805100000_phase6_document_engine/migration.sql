-- ============================================================================
-- Phase 6 — Commercial Document Engine
-- ============================================================================
-- 1) Extended DocumentStatus enum (spec-mandated values)
-- 2) New enums: DocumentLineKind, DocumentRelationType
-- 3) New fields on existing 9 document + 9 line models
-- 4) New DocumentRelation model (cross-document links + conversion history)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extend DocumentStatus enum
-- ---------------------------------------------------------------------------
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'CONFIRMED';
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_PROCESSED';
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'PROCESSED';
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'CLOSED';

-- ---------------------------------------------------------------------------
-- 2. New enums
-- ---------------------------------------------------------------------------
CREATE TYPE "DocumentLineKind" AS ENUM ('PRODUCT', 'SERVICE', 'COMMENT', 'SECTION');
CREATE TYPE "DocumentRelationType" AS ENUM ('CONVERSION', 'REFERENCE', 'CREDIT', 'AMENDMENT');

-- ---------------------------------------------------------------------------
-- 3a. Add `kind` to all 9 line models
-- ---------------------------------------------------------------------------
ALTER TABLE "QuotationLine"       ADD COLUMN "kind" "DocumentLineKind" NOT NULL DEFAULT 'PRODUCT';
ALTER TABLE "SalesOrderLine"      ADD COLUMN "kind" "DocumentLineKind" NOT NULL DEFAULT 'PRODUCT';
ALTER TABLE "DeliveryNoteLine"    ADD COLUMN "kind" "DocumentLineKind" NOT NULL DEFAULT 'PRODUCT';
ALTER TABLE "InvoiceLine"         ADD COLUMN "kind" "DocumentLineKind" NOT NULL DEFAULT 'PRODUCT';
ALTER TABLE "CreditNoteLine"      ADD COLUMN "kind" "DocumentLineKind" NOT NULL DEFAULT 'PRODUCT';
ALTER TABLE "PurchaseRequestLine" ADD COLUMN "kind" "DocumentLineKind" NOT NULL DEFAULT 'PRODUCT';
ALTER TABLE "PurchaseOrderLine"   ADD COLUMN "kind" "DocumentLineKind" NOT NULL DEFAULT 'PRODUCT';
ALTER TABLE "GoodsReceiptLine"    ADD COLUMN "kind" "DocumentLineKind" NOT NULL DEFAULT 'PRODUCT';
ALTER TABLE "SupplierInvoiceLine" ADD COLUMN "kind" "DocumentLineKind" NOT NULL DEFAULT 'PRODUCT';

-- ---------------------------------------------------------------------------
-- 3b. Add `exchangeRate` + `meta` to all 9 header models
-- ---------------------------------------------------------------------------
ALTER TABLE "Quotation"         ADD COLUMN "exchangeRate" DECIMAL(65,30) NOT NULL DEFAULT 1, ADD COLUMN "meta" JSONB;
ALTER TABLE "SalesOrder"        ADD COLUMN "exchangeRate" DECIMAL(65,30) NOT NULL DEFAULT 1, ADD COLUMN "meta" JSONB;
ALTER TABLE "DeliveryNote"      ADD COLUMN "exchangeRate" DECIMAL(65,30) NOT NULL DEFAULT 1, ADD COLUMN "meta" JSONB;
ALTER TABLE "Invoice"           ADD COLUMN "exchangeRate" DECIMAL(65,30) NOT NULL DEFAULT 1, ADD COLUMN "meta" JSONB;
ALTER TABLE "CreditNote"        ADD COLUMN "exchangeRate" DECIMAL(65,30) NOT NULL DEFAULT 1, ADD COLUMN "meta" JSONB;
ALTER TABLE "PurchaseRequest"   ADD COLUMN "exchangeRate" DECIMAL(65,30) NOT NULL DEFAULT 1, ADD COLUMN "meta" JSONB;
ALTER TABLE "PurchaseOrder"     ADD COLUMN "exchangeRate" DECIMAL(65,30) NOT NULL DEFAULT 1, ADD COLUMN "meta" JSONB;
ALTER TABLE "GoodsReceipt"      ADD COLUMN "exchangeRate" DECIMAL(65,30) NOT NULL DEFAULT 1, ADD COLUMN "meta" JSONB;
ALTER TABLE "SupplierInvoice"   ADD COLUMN "exchangeRate" DECIMAL(65,30) NOT NULL DEFAULT 1, ADD COLUMN "meta" JSONB;

-- ---------------------------------------------------------------------------
-- 4. DocumentRelation — cross-document links + conversion history
-- ---------------------------------------------------------------------------
CREATE TABLE "DocumentRelation" (
  "id"              TEXT NOT NULL,
  "companyId"       TEXT NOT NULL,
  "sourceDocType"   "DocType" NOT NULL,
  "sourceDocId"     TEXT NOT NULL,
  "sourceDocNumber" TEXT,
  "targetDocType"   "DocType" NOT NULL,
  "targetDocId"     TEXT NOT NULL,
  "targetDocNumber" TEXT,
  "relationType"    "DocumentRelationType" NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'FULL',
  "lineMapping"     JSONB,
  "notes"           TEXT,
  "createdById"     TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DocumentRelation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentRelation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "DocumentRelation_companyId_idx" ON "DocumentRelation"("companyId");
CREATE INDEX "DocumentRelation_sourceDocId_idx" ON "DocumentRelation"("sourceDocId");
CREATE INDEX "DocumentRelation_targetDocId_idx" ON "DocumentRelation"("targetDocId");
CREATE INDEX "DocumentRelation_sourceDocType_sourceDocId_idx" ON "DocumentRelation"("sourceDocType", "sourceDocId");
CREATE INDEX "DocumentRelation_targetDocType_targetDocId_idx" ON "DocumentRelation"("targetDocType", "targetDocId");
CREATE INDEX "DocumentRelation_relationType_idx" ON "DocumentRelation"("relationType");
CREATE INDEX "DocumentRelation_createdById_idx" ON "DocumentRelation"("createdById");
