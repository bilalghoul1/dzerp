import { requireSuperAdmin } from "@/features/auth/rbac";
import { listPlatformUsers } from "@/features/company-admin/service";
import { PlatformUsersTable } from "@/components/admin/platform-users-table";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  // Le layout `/admin` impose déjà `requireSuperAdmin` : ici l'acteur est
  // construit explicitement en mode plateforme (activeCompanyId: null).
  const session = await requireSuperAdmin();
  const actor = {
    userId: session.user.id,
    permissions: session.permissions,
    activeCompanyId: null,
    isSuperAdmin: true,
  };

  const users = await listPlatformUsers(actor);

  return <PlatformUsersTable users={users} currentUserId={session.user.id} />;
}
