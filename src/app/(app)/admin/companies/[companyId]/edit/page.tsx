import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePermission } from "@/features/auth/rbac";
import { getOrResolveCompanyContext } from "@/features/company/context";
import { getCompanyDetail } from "@/features/company-admin/service";
import { PageHeader } from "@/components/page/page-header";
import { Button } from "@/components/ui/button";
import { CompanyEditForm } from "@/components/admin/company-edit-form";
import { getServerI18n } from "@/features/i18n/server";

export const dynamic = "force-dynamic";

export default async function CompanyEditPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  await requirePermission("admin.company.update");
  const { companyId } = await params;
  const context = await getOrResolveCompanyContext();
  const actor = {
    userId: context?.user.id ?? "",
    permissions: context?.permissions ?? [],
    activeCompanyId: context?.company.id ?? null,
  };
  if (!context) notFound();

  const company = await getCompanyDetail(actor, companyId);
  if (!company) notFound();

  const { t } = await getServerI18n();

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: t("admin.title"), href: "/admin/companies" },
          {
            label: company.name,
            href: `/admin/companies/${company.id}`,
          },
          { label: t("admin.editCompany") },
        ]}
        title={t("admin.editCompany")}
        description={t("admin.editCompanyDescription")}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/companies/${companyId}`}>
              <span
                className="material-symbols-outlined text-[18px]"
                aria-hidden="true"
              >
                arrow_back
              </span>
              {t("common.back")}
            </Link>
          </Button>
        }
      />
      <CompanyEditForm company={company} companyId={companyId} />
    </div>
  );
}
