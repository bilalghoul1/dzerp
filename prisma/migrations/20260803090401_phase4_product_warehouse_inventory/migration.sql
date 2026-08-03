-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('PRODUCT', 'SERVICE', 'RAW_MATERIAL', 'SEMI_FINISHED', 'FINISHED_PRODUCT');

-- CreateEnum
CREATE TYPE "CostingMethod" AS ENUM ('AVERAGE', 'FIFO', 'LIFO', 'STANDARD', 'MANUFACTURING');

-- CreateEnum
CREATE TYPE "AttributeInputType" AS ENUM ('TEXT', 'NUMBER', 'OPTION');

-- CreateEnum
CREATE TYPE "WarehouseLocationType" AS ENUM ('ZONE', 'LOCATION', 'SHELF', 'BIN');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('PURCHASE', 'SALE', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'PRODUCTION', 'CONSUMPTION', 'RETURN_IN', 'RETURN_OUT', 'INVENTORY_COUNT', 'OPENING_BALANCE', 'CLOSING_BALANCE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocType" ADD VALUE 'PRODUCT';
ALTER TYPE "DocType" ADD VALUE 'WAREHOUSE';
ALTER TYPE "DocType" ADD VALUE 'INVENTORY_MOVEMENT';

-- DropIndex
DROP INDEX "Product_category_idx";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "brandId" TEXT,
ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "costPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "costingMethod" "CostingMethod" NOT NULL DEFAULT 'AVERAGE',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "height" DECIMAL(65,30),
ADD COLUMN     "internalReference" TEXT,
ADD COLUMN     "inventoryUnitId" TEXT,
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "length" DECIMAL(65,30),
ADD COLUMN     "manufacturerId" TEXT,
ADD COLUMN     "maximumQuantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "meta" JSONB,
ADD COLUMN     "minimumQuantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "minimumSellingPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "preferredSupplierId" TEXT,
ADD COLUMN     "purchasePrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "purchaseUnitId" TEXT,
ADD COLUMN     "reorderPoint" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "retailPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "salesUnitId" TEXT,
ADD COLUMN     "sellingPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "subcategoryId" TEXT,
ADD COLUMN     "trackInventory" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "type" "ProductType" NOT NULL DEFAULT 'PRODUCT',
ADD COLUMN     "vatCategoryId" TEXT,
ADD COLUMN     "volume" DECIMAL(65,30),
ADD COLUMN     "weight" DECIMAL(65,30),
ADD COLUMN     "wholesalePrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "width" DECIMAL(65,30);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manufacturer" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "country" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "Manufacturer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "symbol" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VatCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "rate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "VatCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAttribute" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "inputType" "AttributeInputType" NOT NULL DEFAULT 'TEXT',
    "options" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "ProductAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAttributeValue" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,

    CONSTRAINT "ProductAttributeValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSupplier" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplierSku" TEXT,
    "supplierPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "leadTimeDays" INTEGER,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,

    CONSTRAINT "ProductSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "branchId" TEXT,
    "address" TEXT,
    "managerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseLocation" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "parentId" TEXT,
    "type" "WarehouseLocationType" NOT NULL DEFAULT 'LOCATION',
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(65,30),
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referenceDocType" "DocType",
    "referenceDocId" TEXT,
    "referenceNumber" TEXT,
    "counterpartId" TEXT,
    "notes" TEXT,
    "meta" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_code_key" ON "ProductCategory"("code");

-- CreateIndex
CREATE INDEX "ProductCategory_parentId_idx" ON "ProductCategory"("parentId");

-- CreateIndex
CREATE INDEX "ProductCategory_isActive_idx" ON "ProductCategory"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_code_key" ON "Brand"("code");

-- CreateIndex
CREATE INDEX "Brand_isActive_idx" ON "Brand"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Manufacturer_code_key" ON "Manufacturer"("code");

-- CreateIndex
CREATE INDEX "Manufacturer_isActive_idx" ON "Manufacturer"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_code_key" ON "Unit"("code");

-- CreateIndex
CREATE INDEX "Unit_isActive_idx" ON "Unit"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "VatCategory_code_key" ON "VatCategory"("code");

-- CreateIndex
CREATE INDEX "VatCategory_isActive_idx" ON "VatCategory"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAttribute_code_key" ON "ProductAttribute"("code");

-- CreateIndex
CREATE INDEX "ProductAttribute_isActive_idx" ON "ProductAttribute"("isActive");

-- CreateIndex
CREATE INDEX "ProductAttributeValue_attributeId_idx" ON "ProductAttributeValue"("attributeId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAttributeValue_productId_attributeId_key" ON "ProductAttributeValue"("productId", "attributeId");

-- CreateIndex
CREATE INDEX "ProductSupplier_supplierId_idx" ON "ProductSupplier"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSupplier_productId_supplierId_key" ON "ProductSupplier"("productId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE INDEX "Warehouse_branchId_idx" ON "Warehouse"("branchId");

-- CreateIndex
CREATE INDEX "Warehouse_managerId_idx" ON "Warehouse"("managerId");

-- CreateIndex
CREATE INDEX "Warehouse_deletedAt_idx" ON "Warehouse"("deletedAt");

-- CreateIndex
CREATE INDEX "Warehouse_createdById_idx" ON "Warehouse"("createdById");

-- CreateIndex
CREATE INDEX "WarehouseLocation_warehouseId_idx" ON "WarehouseLocation"("warehouseId");

-- CreateIndex
CREATE INDEX "WarehouseLocation_parentId_idx" ON "WarehouseLocation"("parentId");

-- CreateIndex
CREATE INDEX "WarehouseLocation_type_idx" ON "WarehouseLocation"("type");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_number_key" ON "InventoryMovement"("number");

-- CreateIndex
CREATE INDEX "InventoryMovement_productId_warehouseId_idx" ON "InventoryMovement"("productId", "warehouseId");

-- CreateIndex
CREATE INDEX "InventoryMovement_productId_idx" ON "InventoryMovement"("productId");

-- CreateIndex
CREATE INDEX "InventoryMovement_warehouseId_idx" ON "InventoryMovement"("warehouseId");

-- CreateIndex
CREATE INDEX "InventoryMovement_type_idx" ON "InventoryMovement"("type");

-- CreateIndex
CREATE INDEX "InventoryMovement_occurredAt_idx" ON "InventoryMovement"("occurredAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_referenceDocId_idx" ON "InventoryMovement"("referenceDocId");

-- CreateIndex
CREATE INDEX "InventoryMovement_createdById_idx" ON "InventoryMovement"("createdById");

-- CreateIndex
CREATE INDEX "Product_nameAr_idx" ON "Product"("nameAr");

-- CreateIndex
CREATE INDEX "Product_type_idx" ON "Product"("type");

-- CreateIndex
CREATE INDEX "Product_barcode_idx" ON "Product"("barcode");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_subcategoryId_idx" ON "Product"("subcategoryId");

-- CreateIndex
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");

-- CreateIndex
CREATE INDEX "Product_manufacturerId_idx" ON "Product"("manufacturerId");

-- CreateIndex
CREATE INDEX "Product_vatCategoryId_idx" ON "Product"("vatCategoryId");

-- CreateIndex
CREATE INDEX "Product_preferredSupplierId_idx" ON "Product"("preferredSupplierId");

-- CreateIndex
CREATE INDEX "Product_parentId_idx" ON "Product"("parentId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_purchaseUnitId_fkey" FOREIGN KEY ("purchaseUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_salesUnitId_fkey" FOREIGN KEY ("salesUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_inventoryUnitId_fkey" FOREIGN KEY ("inventoryUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_vatCategoryId_fkey" FOREIGN KEY ("vatCategoryId") REFERENCES "VatCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_preferredSupplierId_fkey" FOREIGN KEY ("preferredSupplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProductCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeValue" ADD CONSTRAINT "ProductAttributeValue_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeValue" ADD CONSTRAINT "ProductAttributeValue_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "ProductAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSupplier" ADD CONSTRAINT "ProductSupplier_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSupplier" ADD CONSTRAINT "ProductSupplier_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseLocation" ADD CONSTRAINT "WarehouseLocation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseLocation" ADD CONSTRAINT "WarehouseLocation_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WarehouseLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
