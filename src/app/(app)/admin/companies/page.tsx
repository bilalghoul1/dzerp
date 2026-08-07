import { getOrResolveCompanyContext } from "@/features/company/context";
import { listCompanies } from "@/features/company-admin/service";
import { CompaniesTable } from "@/components/admin/companies-table";

export const dynamic = "force-dynamic";

export default async function AdminCompaniesPage() {
  const context = await getOrResolveCompanyContext();
  const companies = await listCompanies({
    userId: context?.user.id ?? "",
    permissions: context?.permissions ?? [],
    activeCompanyId: context?.company.id ?? null,
  });

  return (
    <CompaniesTable
      companies={companies}
      canManage={
        context?.permissions.includes("admin.company.archive") ?? false
      }
      canDelete={
        context?.permissions.includes("admin.company.delete") ?? false
      }
    />
  );
}
