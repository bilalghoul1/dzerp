-- ============================================================================
-- Phase 6.5 — Security hardening: `admin.company.restore` permission
-- ----------------------------------------------------------------------------
-- Ajoute la permission `admin.company.restore` au catalogue et l'attribue
-- aux rôles disposant déjà des opérations globales sur les sociétés
-- (`admin.company.archive` ou `admin.company.delete`), c'est-à-dire le rôle
-- ADMIN (Super Administrateur) et tout rôle personnalisé équivalent.
-- La restauration est une opération globale : elle n'est jamais accordée au
-- rôle COMPANY_ADMIN (périmètre limité à sa société active).
-- ============================================================================

-- 1. Créer la permission (idempotent).
INSERT INTO "Permission" ("id", "key", "module", "name", "nameAr")
SELECT gen_random_uuid(), 'admin.company.restore', 'admin', 'Restaurer une société', 'استعادة شركة'
WHERE NOT EXISTS (SELECT 1 FROM "Permission" WHERE "key" = 'admin.company.restore');

-- 2. Attribuer aux rôles ayant une opération globale sur les sociétés (idempotent).
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT admins."roleId", p."id"
FROM (
  SELECT DISTINCT rp."roleId"
  FROM "RolePermission" rp
  JOIN "Permission" pa ON pa."id" = rp."permissionId"
    AND pa."key" IN ('admin.company.archive', 'admin.company.delete')
) admins
JOIN "Permission" p ON p."key" = 'admin.company.restore'
WHERE NOT EXISTS (
  SELECT 1 FROM "RolePermission" x
  WHERE x."roleId" = admins."roleId" AND x."permissionId" = p."id"
);
