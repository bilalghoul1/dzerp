-- Phase 9b — WorkCenter ↔ Branch relation (additive).
ALTER TABLE "WorkCenter" ADD CONSTRAINT "WorkCenter_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "WorkCenter_branchId_idx" ON "WorkCenter"("branchId");
