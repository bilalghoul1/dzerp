-- AlterTable
ALTER TABLE "ProductionConsumption" ADD COLUMN     "consumedById" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "referenceDocId" TEXT,
ADD COLUMN     "referenceDocType" TEXT;

-- AlterTable
ALTER TABLE "ProductionOutput" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "producedById" TEXT,
ADD COLUMN     "referenceDocId" TEXT,
ADD COLUMN     "referenceDocType" TEXT;

