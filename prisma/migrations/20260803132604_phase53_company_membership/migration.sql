-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'FALLBACK';

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "legalName" TEXT,
    "legalForm" TEXT,
    "activity" TEXT,
    "taxId" TEXT,
    "rc" TEXT,
    "nis" TEXT,
    "ai" TEXT,
    "vatNumber" TEXT,
    "address" TEXT,
    "country" TEXT,
    "wilaya" TEXT,
    "commune" TEXT,
    "postalCode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'DZD',
    "fiscalYear" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCompany" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleAssignment" (
    "id" TEXT NOT NULL,
    "userCompanyId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "assignedBy" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");

-- CreateIndex
CREATE INDEX "Company_isActive_idx" ON "Company"("isActive");

-- CreateIndex
CREATE INDEX "Company_isDefault_idx" ON "Company"("isDefault");

-- CreateIndex
CREATE INDEX "UserCompany_userId_idx" ON "UserCompany"("userId");

-- CreateIndex
CREATE INDEX "UserCompany_companyId_idx" ON "UserCompany"("companyId");

-- CreateIndex
CREATE INDEX "UserCompany_active_idx" ON "UserCompany"("active");

-- CreateIndex
CREATE UNIQUE INDEX "UserCompany_userId_companyId_key" ON "UserCompany"("userId", "companyId");

-- CreateIndex
CREATE INDEX "RoleAssignment_roleId_idx" ON "RoleAssignment"("roleId");

-- CreateIndex
CREATE INDEX "RoleAssignment_active_idx" ON "RoleAssignment"("active");

-- CreateIndex
CREATE UNIQUE INDEX "RoleAssignment_userCompanyId_roleId_key" ON "RoleAssignment"("userCompanyId", "roleId");

-- AddForeignKey
ALTER TABLE "UserCompany" ADD CONSTRAINT "UserCompany_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCompany" ADD CONSTRAINT "UserCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_userCompanyId_fkey" FOREIGN KEY ("userCompanyId") REFERENCES "UserCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ==========================================================================
-- Phase 5.3 — Rétrocompatibilité : migration des données multi-sociétés
--   1. Crée la société par défaut (si absente) depuis le profil entreprise.
--   2. Rattache chaque utilisateur existant à la société (adhésion par défaut).
--   3. Migre les UserRole existants vers RoleAssignment (même rôle, société
--      par défaut). Préserve l'accès administrateur et toutes les permissions.
--   4. Met à jour les sessions dont la société active pointait vers l'ancien
--      sentinelle 5.2 "company-default".
-- ==========================================================================
DO $$
DECLARE
  company_id TEXT;
  company_name TEXT;
  company_currency TEXT;
BEGIN
  SELECT value INTO company_name FROM "Setting" WHERE "key" = 'company.name';
  SELECT value INTO company_currency FROM "Setting" WHERE "key" = 'company.currency';
  IF company_name IS NULL OR company_name = '' THEN company_name := 'DzERP Algérie'; END IF;
  IF company_currency IS NULL OR company_currency = '' THEN company_currency := 'DZD'; END IF;

  INSERT INTO "Company" ("id", "code", "name", "currency", "isDefault", "isActive", "createdAt", "updatedAt")
  VALUES (gen_random_uuid()::text, 'MAIN', company_name, company_currency, true, true, now(), now())
  RETURNING "id" INTO company_id;

  -- Société implicite héritée : adhésion par défaut pour chaque utilisateur.
  INSERT INTO "UserCompany" ("id", "userId", "companyId", "active", "isDefault", "joinedAt", "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text, u."id", company_id, true, true, now(), now(), now()
  FROM "User" u
  ON CONFLICT ("userId", "companyId") DO NOTHING;

  -- Migration des rôles globaux (UserRole) vers RoleAssignment.
  INSERT INTO "RoleAssignment" ("id", "userCompanyId", "roleId", "active", "assignedAt", "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text, uc."id", ur."roleId", true, now(), now(), now()
  FROM "UserRole" ur
  JOIN "UserCompany" uc ON uc."userId" = ur."userId" AND uc."companyId" = company_id
  ON CONFLICT ("userCompanyId", "roleId") DO NOTHING;

  -- Ancien sentinelle 5.2 → vraie société.
  UPDATE "Session" SET "activeCompanyId" = company_id WHERE "activeCompanyId" = 'company-default';

  RAISE NOTICE 'Phase 5.3 : société "%" (id %) créée, adhésions et rôles migrés.', company_name, company_id;
END $$;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_activeCompanyId_fkey" FOREIGN KEY ("activeCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_activeBranchId_fkey" FOREIGN KEY ("activeBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
