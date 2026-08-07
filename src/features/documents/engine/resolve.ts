import { prisma } from "@/lib/prisma";
import type { CommercialDocType } from "./types";
import { getDocConfig, getAllDocTypes } from "./config";

/**
 * Résout le type d'un document à partir de son id et vérifie qu'il appartient
 * bien à la société courante. Retourne null si aucun modèle ne le contient.
 */
export async function resolveDocType(
  docId: string,
  companyId: string,
): Promise<CommercialDocType | null> {
  const checks = await Promise.all(
    getAllDocTypes().map(async (t) => {
      const config = getDocConfig(t);
      const delegate = (prisma as Record<string, unknown>)[config.prismaModel] as {
        findUnique: (args: {
          where: { id: string };
          select: { id: boolean; companyId: boolean };
        }) => Promise<{ id: string; companyId: string } | null>;
      };
      const found = await delegate.findUnique({
        where: { id: docId },
        select: { id: true, companyId: true },
      });
      return found && found.companyId === companyId ? t : null;
    }),
  );
  return checks.find((t): t is CommercialDocType => t !== null) ?? null;
}
