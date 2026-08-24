import { getAdminActor } from "@/features/company-admin/api";
import { listPlatformAudit } from "@/features/company-admin/service";
import { AuditLogTable } from "@/components/admin/audit-log-table";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const actor = await getAdminActor();
  if (!actor) return null;

  const entries = await listPlatformAudit(actor);

  return <AuditLogTable entries={entries} />;
}
