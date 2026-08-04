import { requirePermission } from "@/features/auth/rbac";
import { getCompanyContext } from "@/features/company/context";
import { getCurrencies } from "@/features/settings/config";
import {
  listLookups,
  listWilayas,
  listCommunes,
} from "@/features/lookups/config";
import {
  getDraft,
  listAssignableRoles,
  listAssignableUsers,
} from "@/features/company-admin/service";
import { CompanyWizard } from "@/components/admin/company-wizard";

export const dynamic = "force-dynamic";

export default async function NewCompanyPage() {
  await requirePermission("admin.company.create");
  const context = getCompanyContext();
  const userId = context?.user.id ?? "";

  const [currencies, lookups, wilayas, communes, users, roles, draft] =
    await Promise.all([
      getCurrencies(),
      listLookups(),
      listWilayas(),
      listCommunes(),
      listAssignableUsers(),
      listAssignableRoles(),
      userId ? getDraft(userId) : null,
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
    <CompanyWizard
      initialDraft={draft}
      currencies={currencyOptions}
      countries={countryOptions}
      legalForms={legalFormOptions}
      banks={bankOptions}
      wilayas={wilayaOptions}
      communes={communeOptions}
      users={users}
      roles={roles}
    />
  );
}
