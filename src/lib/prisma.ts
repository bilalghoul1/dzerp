import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { companyScopeExtension } from "@/lib/db/company-scope";
import {
  softDeleteExtension,
  setSoftDeleteDelegate,
  uncapitalize,
  type SoftDeleteDelegate,
} from "@/lib/db/soft-delete";

function resolveConnectionUrl(): string {
  return (
    process.env.DATABASE_URL ??
    "postgresql://localhost:5432/dzerp"
  );
}

const adapter = new PrismaPg({ connectionString: resolveConnectionUrl() });

const baseClient = new PrismaClient({ adapter });
const extendedClient = baseClient
  .$extends(companyScopeExtension)
  .$extends(softDeleteExtension);

type PrismaClientExtended = typeof extendedClient;
type PrismaClientBase = typeof baseClient;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClientExtended;
  prismaBase?: PrismaClientBase;
};

export const prisma = globalForPrisma.prisma ?? extendedClient;

/**
 * Client Prisma brut (sans les extensions `companyScope` / `softDelete`).
 * Accès global administrateur : les requêtes ne sont pas filtrées par le
 * contexte société (l'extension `companyScope` ne voit pas le contexte ALS
 * du caller, `runUnscoped` est donc inopérant pour les modèles stricts).
 * À n'utiliser que dans l'administration globale.
 */
export const prismaBase = globalForPrisma.prismaBase ?? baseClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaBase = prismaBase;
}

// L'extension softDelete ne peut pas accéder au client directement (pas de
// dépendance circulaire) : on lui fournit un délégué qui y accède.
setSoftDeleteDelegate((model: string) => {
  const delegate = (prisma as unknown as Record<string, SoftDeleteDelegate>)[
    uncapitalize(model)
  ];
  return delegate;
});
