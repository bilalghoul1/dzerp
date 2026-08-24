import { requireSuperAdmin } from "@/features/auth/rbac";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { getServerI18n } from "@/features/i18n/server";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // L'administration de plateforme est réservée au rôle global SUPER_ADMIN.
  // Un administrateur de société (même porteur de `admin.company.*` via son
  // RoleAssignment) reçoit un 404 : ces permissions restent confinées à sa société.
  const session = await requireSuperAdmin();
  const { locale } = await getServerI18n();

  const dateLocale =
    locale === "ar" ? "ar-DZ" : locale === "en" ? "en-US" : "fr-FR";
  const formattedDate = new Intl.DateTimeFormat(dateLocale, {
    dateStyle: "full",
  }).format(new Date());

  return (
    <div>
      <AdminPageHeader
        user={session.user}
        isSuperAdmin={session.isSuperAdmin}
        formattedDate={formattedDate}
      />
      <div className="mt-6">{children}</div>
    </div>
  );
}
