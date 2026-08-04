import { Prisma } from "@/generated/prisma/client";

/**
 * Modèles utilisant la suppression logique (soft delete).
 * Ajouter un modèle ici implique un champ `deletedAt DateTime?` dans le schéma.
 */
export const SOFT_DELETABLE_MODELS = new Set<string>([
  "Client",
  "Product",
  "Warehouse",
  "Company",
]);

type QueryArgs = Record<string, unknown>;

type AllModelsQueryArgs = {
  model: string;
  args: QueryArgs;
  query: (args: QueryArgs) => Promise<unknown>;
};

export type SoftDeleteDelegate = {
  update: (args: QueryArgs) => Promise<unknown>;
  updateMany: (args: QueryArgs) => Promise<unknown>;
};

function isSoftDeletable(model: string): boolean {
  return SOFT_DELETABLE_MODELS.has(model);
}

export function uncapitalize(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

/**
 * Ajoute `deletedAt: null` au filtre quand le modèle est à suppression logique,
 * sauf si le filtre gère explicitement `deletedAt`.
 */
function filterDeleted(model: string, args: QueryArgs): QueryArgs {
  if (!isSoftDeletable(model)) return args;
  const where = (args.where ?? {}) as Record<string, unknown>;
  if ("deletedAt" in where) return args;
  return { ...args, where: { deletedAt: null, ...where } };
}

/**
 * Fournisseur du client étendu, injecté par `src/lib/prisma.ts` pour éviter une
 * dépendance circulaire. Nécessaire pour transformer delete/deleteMany en
 * suppression logique sans accéder au client directement dans l'extension.
 */
let delegateProvider: ((model: string) => SoftDeleteDelegate) | null = null;

export function setSoftDeleteDelegate(
  provider: (model: string) => SoftDeleteDelegate,
): void {
  delegateProvider = provider;
}

function resolveDelegate(model: string): SoftDeleteDelegate {
  if (!delegateProvider) {
    throw new Error(
      "softDeleteExtension: aucun client lié (setSoftDeleteDelegate requis).",
    );
  }
  return delegateProvider(model);
}

/**
 * Extension client Prisma :
 *  - filtrage automatique `deletedAt IS NULL` sur les lectures pour les modèles
 *    à suppression logique ;
 *  - transformation de `delete`/`deleteMany` en mise à jour `deletedAt`.
 */
export const softDeleteExtension = Prisma.defineExtension({
  name: "softDelete",
  query: {
    $allModels: {
      async findMany(params: AllModelsQueryArgs) {
        return params.query(filterDeleted(params.model, params.args));
      },
      async findFirst(params: AllModelsQueryArgs) {
        return params.query(filterDeleted(params.model, params.args));
      },
      async findUnique(params: AllModelsQueryArgs) {
        return params.query(filterDeleted(params.model, params.args));
      },
      async findFirstOrThrow(params: AllModelsQueryArgs) {
        return params.query(filterDeleted(params.model, params.args));
      },
      async findUniqueOrThrow(params: AllModelsQueryArgs) {
        return params.query(filterDeleted(params.model, params.args));
      },
      async count(params: AllModelsQueryArgs) {
        return params.query(filterDeleted(params.model, params.args));
      },
      async update(params: AllModelsQueryArgs) {
        return params.query(filterDeleted(params.model, params.args));
      },
      async updateMany(params: AllModelsQueryArgs) {
        return params.query(filterDeleted(params.model, params.args));
      },
      async delete(params: AllModelsQueryArgs) {
        if (!isSoftDeletable(params.model)) return params.query(params.args);
        const delegate = resolveDelegate(params.model);
        return delegate.update({
          where: params.args.where,
          data: { deletedAt: new Date() },
        });
      },
      async deleteMany(params: AllModelsQueryArgs) {
        if (!isSoftDeletable(params.model)) return params.query(params.args);
        const delegate = resolveDelegate(params.model);
        return delegate.updateMany({
          where: (params.args.where as Record<string, unknown>) ?? {},
          data: { deletedAt: new Date() },
        });
      },
    },
  },
});
