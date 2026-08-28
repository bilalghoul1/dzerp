import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/rbac";
import RegisterForm from "./register-form";

export const dynamic = "force-dynamic";

/**
 * Inscription publique à une période d'essai.
 * Un visiteur déjà authentifié (déjà connecté) est redirigé vers son tableau
 * de bord : l'inscription est réservée aux visiteurs anonymes.
 */
export default async function RegisterPage() {
  const session = await getCurrentUser();
  if (session) {
    redirect("/dashboard");
  }
  return <RegisterForm />;
}
