import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/rbac";
import { AppShell } from "@/components/shell/app-shell";
import { NoCompanyScreen } from "@/components/shell/no-company-screen";
import { MembershipAccessScreen } from "@/components/shell/membership-access-screen";
import {
  listAssignedCompanies,
  resolveCompanyContext,
} from "@/features/company/resolver";
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
    // SUPER_ADMIN global : plateforme sans société. Un Super Admin (rôle global,
    // hors société) n'a PAS d'adhésion UserCompany. On rend un shell « plateforme »
    // SANS contexte société (context = null) : on ne fabrique ni adhésion ni
    // société, et les pages qui exigent réellement une société échouent encore
    // fail-safe par leur propre requireCompanyContext(). S'il possède au contraire
    // des adhésions actives, il entre par le chemin société normal (multi-société).
    const assigned = await listAssignedCompanies(session.user.id);
    if (session.isSuperAdmin && assigned.length === 0) {
      return (
        <AppShell
          context={null}
          user={session.user}
          permissions={session.permissions}
          isSuperAdmin={session.isSuperAdmin}
        >
          {children}
        </AppShell>
      );
    }

    // Utilisateur authentifié SANS société active (non SUPER_ADMIN) : état
    // valide — message clair au lieu du contenu métier. Jamais de HTTP 500
    // (« Aucune société accessible. ») ni de perte de session.
    if (assigned.length === 0) {
      return <NoCompanyScreen />;
    }

    let context;
    try {
      context = await resolveCompanyContext(session);
    } catch {
      return <NoCompanyScreen />;
    }

    // Adhésion ACTIVE sans rôle valide (invariant violé) : échec sûr.
    // Aucune donnée société n'est rendue — message clair FR/AR au lieu d'un
    // sidebar vide, d'un tableau de bord trompeur ou d'une erreur HTTP 500.
    if (context.permissionSource === "None") {
      return (
        <MembershipAccessScreen
          user={session.user}
          company={context.company}
        />
      );
    }

    return runWithCompanyContext(context, () => (
      <AppShell
        context={context}
        user={context.user}
        permissions={context.permissions}
        isSuperAdmin={session.isSuperAdmin}
      >
        {children}
      </AppShell>
    ));
  });
}
