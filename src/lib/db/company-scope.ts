import { Prisma } from "@/generated/prisma/client";
import {
  getOrResolveCompanyContext,
  isUnscopedContext,
} from "@/features/company/context";
import type { CompanyContext } from "@/features/company/types";

/**
 * Modèles métier strictement rattachés à une société : toute requête est
 * automatiquement filtrée par `companyId` (lecture) ou renseigne `companyId`
 * (écriture). Requérir un contexte société, sinon l'accès est refusé.
 */
export const COMPANY_SCOPED_MODELS = new Set<string>([
  "Branch",
  "DocumentSeries",
  "DocumentApproval",
  "Customer",
  "Supplier",
  "Product",
  "ProductCategory",
  "Brand",
  "Manufacturer",
  "Warehouse",
  "InventoryMovement",
  "Quotation",
  "SalesOrder",
  "DeliveryNote",
  "Invoice",
  "CreditNote",
  "PurchaseRequest",
  "PurchaseOrder",
  "GoodsReceipt",
  "SupplierInvoice",
  "FileAsset",
]);

/**
 * Modèles rattachés à une société mais acceptant les lignes hors contexte
 * (journalisation / timeline). En contexte, ils sont filtrés et renseignés
 * comme les autres ; hors contexte, ils restent accessibles (companyId null).
 */
export const COMPANY_OPTIONAL_MODELS = new Set<string>([
  "AuditLog",
  "ActivityEvent",
]);

type QueryArgs = Record<string, unknown>;

type AllModelsQueryArgs = {
  model: string;
  args: QueryArgs;
  query: (args: QueryArgs) => Promise<unknown>;
};

function isScoped(model: string): boolean {
  return COMPANY_SCOPED_MODELS.has(model) || COMPANY_OPTIONAL_MODELS.has(model);
}

function isStrict(model: string): boolean {
  return COMPANY_SCOPED_MODELS.has(model);
}

/**
 * Contexte société pour l'opération : contexte ALS (API routes via
 * `apiGuardWithContext` / `runScoped`) sinon résolution de secours par requête
 * (pages RSC via `React.cache`, enregistrée par le layout racine). Les modèles
 * stricts échouent sans contexte (fail-closed).
 */
async function resolveContext(model: string): Promise<CompanyContext | null> {
  const context = await getOrResolveCompanyContext();
  if (!context && isStrict(model)) {
    throw new Error(
      `companyScope: accès au modèle métier "${model}" sans contexte société ` +
        "(runWithCompanyContext / apiGuardWithContext requis).",
    );
  }
  return context;
}

/**
 * Filtrer par société : ajoute `companyId` au filtre `where` des lectures et
 * des écritures ciblées. Un `where` explicitant déjà `companyId` est laissé
 * intact (scoping explicite, ex. résolution des succursales d'une société).
 */
async function scopeWhere(model: string, args: QueryArgs): Promise<QueryArgs> {
  if (!isScoped(model)) return args;
  if (isUnscopedContext()) return args;

  const where = (args.where ?? {}) as Record<string, unknown>;
  if (where && typeof where === "object" && "companyId" in where) {
    return args;
  }

  const context = await resolveContext(model);
  if (!context) return args;

  return { ...args, where: { companyId: context.company.id, ...where } };
}

/** Renseigne `companyId` sur les créations de données métier. */
async function scopeCreate(model: string, data: QueryArgs): Promise<QueryArgs> {
  if (!isScoped(model)) return data;
  if (isUnscopedContext()) return data;
  if (data && typeof data === "object" && "companyId" in data) return data;

  const context = await resolveContext(model);
  if (!context) return data;

  return { companyId: context.company.id, ...data };
}

/**
 * Extension client Prisma : isolation des données par société.
 *
 * - Lecturures (`findMany`, `findFirst`, `findUnique`, `count`, `aggregate`,
 *   `groupBy`...) : filtre automatique `companyId` = société active.
 * - Écritures (`create`, `createMany`, `upsert`, `update`, `updateMany`,
 *   `delete`, `deleteMany`) : `companyId` renseigné / scoping du filtre.
 * - `runUnscoped()` (contexte administrateur) désactive le filtrage.
 * - Modèles stricts hors contexte société : accès refusé (fail-closed).
 * - `where` contenant déjà `companyId` : scoping explicite, non modifié.
 * - Contexte : ALS (API routes) ou résolution par requête (pages RSC).
 */
export const companyScopeExtension = Prisma.defineExtension({
  name: "companyScope",
  query: {
    $allModels: {
      async findMany(params: AllModelsQueryArgs) {
        return params.query(await scopeWhere(params.model, params.args));
      },
      async findFirst(params: AllModelsQueryArgs) {
        return params.query(await scopeWhere(params.model, params.args));
      },
      async findUnique(params: AllModelsQueryArgs) {
        return params.query(await scopeWhere(params.model, params.args));
      },
      async findFirstOrThrow(params: AllModelsQueryArgs) {
        return params.query(await scopeWhere(params.model, params.args));
      },
      async findUniqueOrThrow(params: AllModelsQueryArgs) {
        return params.query(await scopeWhere(params.model, params.args));
      },
      async count(params: AllModelsQueryArgs) {
        return params.query(await scopeWhere(params.model, params.args));
      },
      async aggregate(params: AllModelsQueryArgs) {
        return params.query(await scopeWhere(params.model, params.args));
      },
      async groupBy(params: AllModelsQueryArgs) {
        return params.query(await scopeWhere(params.model, params.args));
      },
      async create(params: AllModelsQueryArgs) {
        const args = {
          ...params.args,
          data: await scopeCreate(
            params.model,
            (params.args.data ?? {}) as QueryArgs,
          ),
        };
        return params.query(args);
      },
      async createMany(params: AllModelsQueryArgs) {
        const args = { ...params.args };
        const data = (args.data ?? []) as QueryArgs | QueryArgs[];
        if (Array.isArray(data)) {
          args.data = await Promise.all(
            data.map((row) => scopeCreate(params.model, row)),
          );
        } else {
          args.data = await scopeCreate(params.model, data);
        }
        return params.query(args);
      },
      async createManyAndReturn(params: AllModelsQueryArgs) {
        const args = { ...params.args };
        const data = (args.data ?? []) as QueryArgs | QueryArgs[];
        if (Array.isArray(data)) {
          args.data = await Promise.all(
            data.map((row) => scopeCreate(params.model, row)),
          );
        } else {
          args.data = await scopeCreate(params.model, data);
        }
        return params.query(args);
      },
      async update(params: AllModelsQueryArgs) {
        return params.query(await scopeWhere(params.model, params.args));
      },
      async updateMany(params: AllModelsQueryArgs) {
        return params.query(await scopeWhere(params.model, params.args));
      },
      async updateManyAndReturn(params: AllModelsQueryArgs) {
        return params.query(await scopeWhere(params.model, params.args));
      },
      async delete(params: AllModelsQueryArgs) {
        return params.query(await scopeWhere(params.model, params.args));
      },
      async deleteMany(params: AllModelsQueryArgs) {
        return params.query(await scopeWhere(params.model, params.args));
      },
      async upsert(params: AllModelsQueryArgs) {
        const args = await scopeWhere(params.model, params.args);
        const create = (args.create ?? {}) as QueryArgs;
        args.create = await scopeCreate(params.model, create);
        return params.query(args);
      },
    },
  },
});
