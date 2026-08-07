import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getOrResolveCompanyContext } from "@/features/company/context";
import { BranchesManager } from "@/components/settings/branches-manager";
import { getServerI18n } from "@/features/i18n/server";

export const dynamic = "force-dynamic";

export default async function BranchesPage() {
  const context = await getOrResolveCompanyContext();
  if (!context) redirect("/login");

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
      manager: true,
      country: true,
      wilaya: true,
      commune: true,
      postalCode: true,
      rc: true,
      nif: true,
      nis: true,
      ai: true,
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
