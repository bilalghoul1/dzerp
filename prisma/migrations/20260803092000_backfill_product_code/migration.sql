-- Backfill du champ obligatoire `code` sur les produits existants.
-- Les codes sont attribués dans l'ordre de création (PRD-000001, ...).
-- Ils seront ensuite réassignés via le compteur de série lors du seed.

WITH numbered AS (
  SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS rn
  FROM "Product"
)
UPDATE "Product" p
SET "code" = 'PRD-' || lpad(numbered.rn::text, 6, '0')
FROM numbered
WHERE p."id" = numbered."id";

-- Sécurité : aucun code ne doit rester NULL (parallélisme / races improbables).
UPDATE "Product"
SET "code" = 'PRD-' || lpad(substring("id" FROM 1 FOR 8)::int::text, 6, '0')
WHERE "code" IS NULL;

ALTER TABLE "Product" ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");
