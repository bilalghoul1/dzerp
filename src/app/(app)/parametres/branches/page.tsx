import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getOrResolveCompanyContext } from "@/features/company/context";
import { listWilayas, listCommunes } from "@/features/lookups/config";
import { BranchesManager } from "@/components/settings/branches-manager";
import { getServerI18n } from "@/features/i18n/server";

export const dynamic = "force-dynamic";

export default async function BranchesPage() {
  const context = await getOrResolveCompanyContext();
  if (!context) redirect("/login");

  const { t } = await getServerI18n();

  const [branches, wilayas, communes] = await Promise.all([
    prisma.branch.findMany({
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
        createdAt: true,
      },
    }),
    listWilayas(),
    listCommunes(),
  ]);

  const wilayaOptions = wilayas.map((w) => ({
    code: w.code,
    name: w.name,
    nameAr: w.nameAr,
  }));

  const communeOptions = communes.map((c) => ({
    code: c.code,
    name: c.name,
    nameAr: c.nameAr,
    wilayaCode: c.wilayaCode,
  }));

  return (
    <BranchesManager
      branches={branches.map((b) => ({
        ...b,
        createdAt: b.createdAt.toISOString(),
      }))}
      description={t("parametres.branchesDescription")}
      wilayas={wilayaOptions}
      communes={communeOptions}
    />
  );
}
