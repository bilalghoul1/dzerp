import { prisma } from "@/lib/prisma";
import { BranchesManager } from "@/components/settings/branches-manager";
import { getServerI18n } from "@/features/i18n/server";

export const dynamic = "force-dynamic";

export default async function BranchesPage() {
  const branches = await prisma.branch.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      nameAr: true,
      type: true,
      city: true,
      address: true,
      phone: true,
      email: true,
      isActive: true,
    },
  });
  const { t } = await getServerI18n();

  return (
    <BranchesManager
      branches={branches}
      description={t("parametres.branchesDescription")}
    />
  );
}
