-- CreateEnum
CREATE TYPE "ProductionStatus" AS ENUM ('DRAFT', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "DocType" ADD VALUE 'PRODUCTION_ORDER';

-- CreateTable
CREATE TABLE "ProductBOM" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "productId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "notes" TEXT,
    "companyId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductBOM_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductBOMItem" (
    "id" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitId" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductBOMItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkCenter" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "workCenterId" TEXT NOT NULL,
    "capacity" DECIMAL(18,4),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOrder" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "bomId" TEXT,
    "plannedQty" DECIMAL(18,4) NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "workCenterId" TEXT,
    "status" "ProductionStatus" NOT NULL DEFAULT 'DRAFT',
    "plannedStart" TIMESTAMP(3),
    "plannedEnd" TIMESTAMP(3),
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "notes" TEXT,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitId" TEXT,
    "bomItemId" TEXT,

    CONSTRAINT "ProductionOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionConsumption" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4),
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOutput" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4),
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionOutput_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductBOM_productId_idx" ON "ProductBOM"("productId");

-- CreateIndex
CREATE INDEX "ProductBOM_isActive_idx" ON "ProductBOM"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProductBOM_companyId_code_key" ON "ProductBOM"("companyId", "code");

-- CreateIndex
CREATE INDEX "ProductBOMItem_bomId_idx" ON "ProductBOMItem"("bomId");

-- CreateIndex
CREATE INDEX "ProductBOMItem_productId_idx" ON "ProductBOMItem"("productId");

-- CreateIndex
CREATE INDEX "WorkCenter_isActive_idx" ON "WorkCenter"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "WorkCenter_companyId_code_key" ON "WorkCenter"("companyId", "code");

-- CreateIndex
CREATE INDEX "Machine_workCenterId_idx" ON "Machine"("workCenterId");

-- CreateIndex
CREATE INDEX "Machine_isActive_idx" ON "Machine"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Machine_companyId_code_key" ON "Machine"("companyId", "code");

-- CreateIndex
CREATE INDEX "ProductionOrder_productId_idx" ON "ProductionOrder"("productId");

-- CreateIndex
CREATE INDEX "ProductionOrder_status_idx" ON "ProductionOrder"("status");

-- CreateIndex
CREATE INDEX "ProductionOrder_bomId_idx" ON "ProductionOrder"("bomId");

-- CreateIndex
CREATE INDEX "ProductionOrder_warehouseId_idx" ON "ProductionOrder"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOrder_companyId_number_key" ON "ProductionOrder"("companyId", "number");

-- CreateIndex
CREATE INDEX "ProductionOrderItem_orderId_idx" ON "ProductionOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "ProductionOrderItem_productId_idx" ON "ProductionOrderItem"("productId");

-- CreateIndex
CREATE INDEX "ProductionConsumption_orderId_idx" ON "ProductionConsumption"("orderId");

-- CreateIndex
CREATE INDEX "ProductionConsumption_productId_idx" ON "ProductionConsumption"("productId");

-- CreateIndex
CREATE INDEX "ProductionConsumption_warehouseId_idx" ON "ProductionConsumption"("warehouseId");

-- CreateIndex
CREATE INDEX "ProductionOutput_orderId_idx" ON "ProductionOutput"("orderId");

-- CreateIndex
CREATE INDEX "ProductionOutput_productId_idx" ON "ProductionOutput"("productId");

-- CreateIndex
CREATE INDEX "ProductionOutput_warehouseId_idx" ON "ProductionOutput"("warehouseId");

-- AddForeignKey
ALTER TABLE "ProductBOM" ADD CONSTRAINT "ProductBOM_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBOM" ADD CONSTRAINT "ProductBOM_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBOMItem" ADD CONSTRAINT "ProductBOMItem_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "ProductBOM"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBOMItem" ADD CONSTRAINT "ProductBOMItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBOMItem" ADD CONSTRAINT "ProductBOMItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkCenter" ADD CONSTRAINT "WorkCenter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "WorkCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "ProductBOM"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "WorkCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrderItem" ADD CONSTRAINT "ProductionOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrderItem" ADD CONSTRAINT "ProductionOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrderItem" ADD CONSTRAINT "ProductionOrderItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionConsumption" ADD CONSTRAINT "ProductionConsumption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionConsumption" ADD CONSTRAINT "ProductionConsumption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionConsumption" ADD CONSTRAINT "ProductionConsumption_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOutput" ADD CONSTRAINT "ProductionOutput_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOutput" ADD CONSTRAINT "ProductionOutput_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOutput" ADD CONSTRAINT "ProductionOutput_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ============================================================================
-- Phase 9 — MRP : amorçage idempotent (séries + permissions + rôles)
-- Toutes les opérations sont ADDITIVES et idempotentes (aucune suppression).
-- ============================================================================

-- Série de numérotation PRODUCTION_ORDER pour CHAQUE société existante
-- (DocumentSeries est scopé par companyId ; nextDocumentNumber filtre sur docType).
INSERT INTO "DocumentSeries" ("id", "companyId", "key", "docType", "label", "labelAr", "prefix", "separator", "suffix", "withYear", "year", "nextValue", "padLength", "step", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), c."id", 'PRODUCTION_ORDER', 'PRODUCTION_ORDER', 'Ordre de fabrication', 'أمر إنتاج', 'OF', '-', '', true, EXTRACT(YEAR FROM CURRENT_DATE)::int, 1, 5, 1, true, now(), now()
FROM "Company" c
WHERE NOT EXISTS (
  SELECT 1 FROM "DocumentSeries" ds WHERE ds."companyId" = c."id" AND ds."key" = 'PRODUCTION_ORDER'
);

INSERT INTO "Permission" ("id", "key", "module", "name", "nameAr", "createdAt")
SELECT gen_random_uuid(), v."key", 'production', v."name", v."nameAr", now()
FROM (VALUES
  ('production.view', 'Consulter la production', 'عرض الإنتاج'),
  ('production.create', 'Créer une production', 'إنشاء إنتاج'),
  ('production.update', 'Modifier une production', 'تعديل إنتاج'),
  ('production.plan', 'Planifier un ordre de fabrication', 'تخطيط أمر الإنتاج'),
  ('production.start', 'Démarrer un ordre de fabrication', 'بدء أمر الإنتاج'),
  ('production.complete', 'Terminer un ordre de fabrication', 'إتمام أمر الإنتاج'),
  ('production.cancel', 'Annuler un ordre de fabrication', 'إلغاء أمر الإنتاج'),
  ('production.bom.view', 'Consulter les nomenclatures', 'عرض البيانات'),
  ('production.bom.create', 'Créer une nomenclature', 'إنشاء بيان'),
  ('production.bom.update', 'Modifier une nomenclature', 'تعديل بيان'),
  ('production.machine.view', 'Consulter les machines', 'عرض الآلات'),
  ('production.machine.create', 'Créer une machine', 'إنشاء آلة'),
  ('production.workcenter.view', 'Consulter les centres de charge', 'عرض مراكز العمل'),
  ('production.workcenter.create', 'Créer un centre de charge', 'إنشاء مركز عمل')
) AS v ("key", "name", "nameAr")
WHERE NOT EXISTS (SELECT 1 FROM "Permission" p WHERE p."key" = v."key");

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r, "Permission" p
WHERE r."key" = 'OWNER' AND p."key" IN (
  'production.view', 'production.create', 'production.update', 'production.plan',
  'production.start', 'production.complete', 'production.cancel',
  'production.bom.view', 'production.bom.create', 'production.bom.update',
  'production.machine.view', 'production.machine.create',
  'production.workcenter.view', 'production.workcenter.create'
)
AND NOT EXISTS (SELECT 1 FROM "RolePermission" x WHERE x."roleId" = r."id" AND x."permissionId" = p."id");

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r, "Permission" p
WHERE r."key" = 'MANAGER' AND p."key" IN (
  'production.view', 'production.create', 'production.update', 'production.plan',
  'production.start', 'production.complete', 'production.cancel',
  'production.bom.view', 'production.bom.create', 'production.bom.update',
  'production.machine.view', 'production.machine.create',
  'production.workcenter.view', 'production.workcenter.create'
)
AND NOT EXISTS (SELECT 1 FROM "RolePermission" x WHERE x."roleId" = r."id" AND x."permissionId" = p."id");

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r, "Permission" p
WHERE r."key" = 'READER' AND p."key" IN (
  'production.view', 'production.bom.view', 'production.machine.view', 'production.workcenter.view'
)
AND NOT EXISTS (SELECT 1 FROM "RolePermission" x WHERE x."roleId" = r."id" AND x."permissionId" = p."id");
