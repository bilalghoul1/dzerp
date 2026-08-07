import { getOrResolveCompanyContext } from "@/features/company/context";
import { listCompanies } from "@/features/company-admin/service";
import { CompaniesTable } from "@/components/admin/companies-table";

export const dynamic = "force-dynamic";

export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const context = await getOrResolveCompanyContext();
  const includeDeleted = view === "archived";
  const companies = await listCompanies(
    {
      userId: context?.user.id ?? "",
      permissions: context?.permissions ?? [],
      activeCompanyId: context?.company.id ?? null,
    },
    { includeDeleted },
  );

  return (
    <CompaniesTable
      companies={companies}
      view={includeDeleted ? "archived" : "active"}
      canManage={
        context?.permissions.includes("admin.company.archive") ?? false
      }
      canDelete={
        context?.permissions.includes("admin.company.delete") ?? false
      }
      canUpdate={
        context?.permissions.includes("admin.company.update") ?? false
      }
      canRestore={
        context?.permissions.includes("admin.company.restore") ?? false
      }
    />
  );
}
