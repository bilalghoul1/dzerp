import { setDefaultResultOrder } from "node:dns";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { companyScopeExtension } from "@/lib/db/company-scope";
import {
  softDeleteExtension,
  setSoftDeleteDelegate,
  uncapitalize,
  type SoftDeleteDelegate,
} from "@/lib/db/soft-delete";

// Certaines machines n'ont pas de route IPv6 (réseau/FAI IPv4 uniquement) alors
// que les DNS publics renvoient les enregistrements AAAA (IPv6) AVANT les A
// (IPv4). Node ≥20 résout alors la socket vers une adresse IPv6 injoignable :
// le handshake TCP expire (ETIMEDOUT) ou retarde la connexion de plusieurs
// secondes avant de retomber sur IPv4. On force l'ordre IPv4 d'abord pour que
// l'ouverture de connexion PostgreSQL soit déterministe et rapide.
setDefaultResultOrder("ipv4first");

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
