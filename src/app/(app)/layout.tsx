import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/rbac";
import { AppShell } from "@/components/shell/app-shell";
import { prisma } from "@/lib/prisma";
import { getCompanyProfile } from "@/features/settings/config";
import { getActiveBranch } from "@/features/session/active-branch";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/login");
  }

  const [company, branches, activeBranch] = await Promise.all([
    getCompanyProfile(),
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, nameAr: true },
    }),
    getActiveBranch(),
  ]);

  return (
    <AppShell
      user={session.user}
      permissions={session.permissions}
      companyName={company.name}
      branches={branches}
      activeBranch={activeBranch}
    >
      {children}
    </AppShell>
  );
}
