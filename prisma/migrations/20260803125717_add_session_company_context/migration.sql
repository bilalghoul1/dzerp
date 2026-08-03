-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "activeBranchId" TEXT,
ADD COLUMN     "activeCompanyId" TEXT;

-- CreateIndex
CREATE INDEX "Session_activeCompanyId_idx" ON "Session"("activeCompanyId");

-- CreateIndex
CREATE INDEX "Session_activeBranchId_idx" ON "Session"("activeBranchId");
