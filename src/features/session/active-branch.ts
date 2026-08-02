import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { BRANCH_COOKIE } from "@/lib/constants";

export type ActiveBranch = {
  id: string;
  code: string;
  name: string;
  nameAr: string | null;
};

/**
 * Succursale active pour la requête courante : priorité au cookie défini par
 * l'utilisateur, sinon `null`. Les composants serveur filtrent les données par
 * cette succursale quand elle est définie.
 */
export async function getActiveBranch(): Promise<ActiveBranch | null> {
  const store = await cookies();
  const id = store.get(BRANCH_COOKIE)?.value;
  if (!id) return null;

  const branch = await prisma.branch.findFirst({
    where: { id, isActive: true },
    select: { id: true, code: true, name: true, nameAr: true },
  });
  return branch;
}
