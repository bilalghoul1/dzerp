import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/rbac";

/**
 * Léger indicateur d'authentification pour la page d'accueil marketing :
 * permet d'afficher « Tableau de bord » au lieu de « Connexion » quand une
 * session valide est déjà présente. Ne renvoie aucune donnée sensible.
 */
export async function GET(): Promise<NextResponse> {
  const session = await getCurrentUser();
  return NextResponse.json({ data: { authenticated: !!session } });
}
