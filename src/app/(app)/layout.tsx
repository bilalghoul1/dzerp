import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/rbac";
import { AppShell } from "@/components/shell/app-shell";
import { resolveCompanyContext } from "@/features/company/resolver";
import {
  runWithCompanyContext,
  runWithResolveCache,
} from "@/features/company/context";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/login");
  }

  return runWithResolveCache(async () => {
    const context = await resolveCompanyContext(session);
    return runWithCompanyContext(context, () => (
      <AppShell context={context}>{children}</AppShell>
    ));
  });
}
