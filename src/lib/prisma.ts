import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
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
const extendedClient = baseClient.$extends(softDeleteExtension);

type PrismaClientExtended = typeof extendedClient;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClientExtended;
};

export const prisma = globalForPrisma.prisma ?? extendedClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// L'extension softDelete ne peut pas accéder au client directement (pas de
// dépendance circulaire) : on lui fournit un délégué qui y accède.
setSoftDeleteDelegate((model: string) => {
  const delegate = (prisma as unknown as Record<string, SoftDeleteDelegate>)[
    uncapitalize(model)
  ];
  return delegate;
});
