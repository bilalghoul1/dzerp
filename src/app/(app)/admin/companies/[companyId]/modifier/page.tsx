import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/features/auth/rbac";
import { getAdminActor } from "@/features/company-admin/api";
import { getCompanyDetail } from "@/features/company-admin/service";
import { getCurrencies } from "@/features/settings/config";
import {
  listCommunes,
  listLookups,
  listWilayas,
} from "@/features/lookups/config";
import { CompanyEditForm } from "@/components/admin/company-edit-form";

export const dynamic = "force-dynamic";

export default async function EditCompanyPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  await requirePermission("admin.company.update");
  const { companyId } = await params;
  const actor = await getAdminActor();
  if (!actor) notFound();

  const company = await getCompanyDetail(actor, companyId);
  if (!company) notFound();
  // Lecture seule : pas d'édition d'une société archivée.
  if (company.status === "ARCHIVED") redirect(`/admin/companies/${companyId}`);

  const [currencies, lookups, wilayas, communes] = await Promise.all([
    getCurrencies(),
    listLookups(),
    listWilayas(),
    listCommunes(),
  ]);

  const currencyOptions = currencies
    .filter((c) => c.isActive !== false)
    .map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }));
  const countryOptions = lookups.countries
    .filter((c) => c.isActive)
    .map((c) => ({ value: c.code, label: c.name, labelAr: c.nameAr }));
  const legalFormOptions = lookups.legalForms
    .filter((f) => f.isActive)
    .map((f) => ({ value: f.code, label: f.name, labelAr: f.nameAr }));
  const bankOptions = lookups.banks
    .filter((b) => b.isActive)
    .map((b) => ({ value: b.code, label: b.name, labelAr: b.nameAr }));
  const wilayaOptions = wilayas.map((w) => ({
    value: w.code,
    label: w.name,
    labelAr: w.nameAr,
  }));
  const communeOptions = communes.map((c) => ({
    wilayaCode: c.wilayaCode,
    value: c.code,
    label: c.name,
    labelAr: c.nameAr,
  }));

  return (
    <CompanyEditForm
      company={company}
      currencies={currencyOptions}
      countries={countryOptions}
      legalForms={legalFormOptions}
      banks={bankOptions}
      wilayas={wilayaOptions}
      communes={communeOptions}
    />
  );
}
