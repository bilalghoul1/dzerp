import { requireSuperAdmin } from "@/features/auth/rbac";
import { listPlatformSessions } from "@/features/company-admin/service";
import { PlatformSessionsTable } from "@/components/admin/platform-sessions-table";

export const dynamic = "force-dynamic";

export default async function AdminSessionsPage() {
  const session = await requireSuperAdmin();
  const actor = {
    userId: session.user.id,
    permissions: session.permissions,
    activeCompanyId: null,
    isSuperAdmin: true,
  };

  const sessions = await listPlatformSessions(actor);

  return <PlatformSessionsTable sessions={sessions} />;
}
