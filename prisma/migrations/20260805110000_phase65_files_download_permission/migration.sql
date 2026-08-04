-- ============================================================================
-- Phase 6.5 — Security hardening: `files.download` permission
-- ----------------------------------------------------------------------------
-- Ajoute la permission `files.download` au catalogue et l'attribue :
--   - à tous les rôles disposant déjà de `files.upload` (ADMIN, COMPANY_ADMIN,
--     MANAGER, ainsi que tout rôle personnalisé),
--   - au rôle READER (accès en lecture seule aux pièces jointes).
-- ============================================================================

-- 1. Créer la permission (idempotent).
INSERT INTO "Permission" ("id", "key", "module", "name", "nameAr")
SELECT gen_random_uuid(), 'files.download', 'files', 'Télécharger des fichiers', 'تحميل الملفات'
WHERE NOT EXISTS (SELECT 1 FROM "Permission" WHERE "key" = 'files.download');

-- 2. Attribuer aux rôles qui ont déjà `files.upload` (idempotent).
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT uploaders."roleId", p."id"
FROM (
  SELECT DISTINCT rp."roleId"
  FROM "RolePermission" rp
  JOIN "Permission" pu ON pu."id" = rp."permissionId" AND pu."key" = 'files.upload'
) uploaders
JOIN "Permission" p ON p."key" = 'files.download'
WHERE NOT EXISTS (
  SELECT 1 FROM "RolePermission" x
  WHERE x."roleId" = uploaders."roleId" AND x."permissionId" = p."id"
);

-- 3. Attribuer au rôle READER (consultation de pièces jointes).
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "Role" r
JOIN "Permission" p ON p."key" = 'files.download'
WHERE r."key" = 'READER'
AND NOT EXISTS (
  SELECT 1 FROM "RolePermission" x
  WHERE x."roleId" = r.id AND x."permissionId" = p."id"
);
