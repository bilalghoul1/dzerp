-- AlterTable
ALTER TABLE "SalesOrderLine" ADD COLUMN     "remainingQty" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- Backfill: une commande existante n'a encore rien livré.
UPDATE "SalesOrderLine" SET "remainingQty" = "quantity";
