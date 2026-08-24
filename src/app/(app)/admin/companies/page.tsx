import { getAdminActor } from "@/features/company-admin/api";
import { listCompanies } from "@/features/company-admin/service";
import { CompaniesTable } from "@/components/admin/companies-table";

export const dynamic = "force-dynamic";

export default async function AdminCompaniesPage() {
  // `getAdminActor` rend l'acteur correct selon le profil :
  //  - SUPER_ADMIN (rôle global, aucune société) : permissions globales
  //    `admin.company.*` + `activeCompanyId: null` → liste TOUTES les sociétés.
  //  - Admin de société : permissions scoped de sa société active → ne voit que la sienne.
  const actor = await getAdminActor();

  const companies = await listCompanies({
    userId: actor?.userId ?? "",
    permissions: actor?.permissions ?? [],
    activeCompanyId: actor?.activeCompanyId ?? null,
    isSuperAdmin: actor?.isSuperAdmin ?? false,
  });

  return (
    <CompaniesTable
      companies={companies}
      canManage={actor?.permissions.includes("admin.company.archive") ?? false}
      canUpdate={actor?.permissions.includes("admin.company.update") ?? false}
      canDelete={actor?.permissions.includes("admin.company.delete") ?? false}
    />
  );
}
