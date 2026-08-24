-- ============================================================================
-- Phase 7.1 — Module Devis : permissions du moteur documentaire (`documents.*`)
-- ----------------------------------------------------------------------------
-- Le Document Engine, les pages (`/documents/...`) et les API utilisent les
-- clés génériques `documents.read/create/update/delete/approve/convert/print`
-- (catalogue `src/features/auth/permissions.ts`). Les rôles seedés ne
-- disposaient que des clés héritées `ventes.*` / `achats.*` (utilisées par la
-- navigation). Résultat : aucun utilisateur société ne pouvait ouvrir le
-- module Devis (`/documents/quotation` → 404 « notFound » sur
-- `requirePermission("documents.read")`).
-- Cette migration accorde `documents.*` aux rôles opérationnels SYSTEM
-- (MANAGER, READER). Opération additive et idempotente — aucune suppression.
-- ============================================================================

-- 1. Garantir la présence des clés `documents.*` au catalogue (idempotent).
INSERT INTO "Permission" ("id", "key", "module", "name", "nameAr")
SELECT gen_random_uuid(), v."key", 'documents', v."name", v."nameAr"
FROM (VALUES
  ('documents.read', 'Consulter les documents commerciaux', 'عرض الوثائق التجارية'),
  ('documents.create', 'Créer un document commercial', 'إنشاء وثيقة تجارية'),
  ('documents.update', 'Modifier un document commercial', 'تعديل وثيقة تجارية'),
  ('documents.delete', 'Supprimer un document commercial', 'حذف وثيقة تجارية'),
  ('documents.approve', 'Approuver un document commercial', 'الموافقة على وثيقة تجارية'),
  ('documents.convert', 'Convertir un document commercial', 'تحويل وثيقة تجارية'),
  ('documents.print', 'Imprimer un document commercial', 'طباعة وثيقة تجارية')
) AS v ("key", "name", "nameAr")
WHERE NOT EXISTS (SELECT 1 FROM "Permission" p WHERE p."key" = v."key");

-- 2. MANAGER : accès opérationnel complet au moteur documentaire.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
JOIN "Permission" p ON p."key" IN (
  'documents.read', 'documents.create', 'documents.update',
  'documents.delete', 'documents.approve', 'documents.convert', 'documents.print'
)
WHERE r."key" = 'MANAGER'
  AND NOT EXISTS (
    SELECT 1 FROM "RolePermission" x
    WHERE x."roleId" = r."id" AND x."permissionId" = p."id"
  );

-- 3. READER : lecture seule + impression.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
JOIN "Permission" p ON p."key" IN ('documents.read', 'documents.print')
WHERE r."key" = 'READER'
  AND NOT EXISTS (
    SELECT 1 FROM "RolePermission" x
    WHERE x."roleId" = r."id" AND x."permissionId" = p."id"
  );
