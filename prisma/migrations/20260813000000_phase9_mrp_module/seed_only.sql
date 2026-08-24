-- Phase 9 — MRP : amorçage idempotent (séries + permissions + rôles)
-- À exécuter APRÈS le DDL (idempotent : aucune suppression).

-- Série de numérotation PRODUCTION_ORDER pour CHAQUE société existante.
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
