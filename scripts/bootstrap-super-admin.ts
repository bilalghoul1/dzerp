import "dotenv/config";
import { randomBytes } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/features/auth/password";

/**
 * Bootstrap sécurisé et idempotent du SUPER_ADMIN global de plateforme.
 *
 * Règles :
 *  - Ne crée QU'UN SEUL Super Admin si aucun n'existe (aucun si déjà présent).
 *  - Le mot de passe est généré aléatoirement (non prédictible) et n'est
 *    affiché qu'UNE seule fois ; `mustChangePassword` est forcé à true.
 *  - Le Super Admin n'est PAS lié à une société : aucun UserCompany créé.
 *  - Idempotent : relançable sans doublon ni écrasement.
 *
 * Usage : npm run db:bootstrap:super
 */
async function main() {
  const role = await prisma.role.findUnique({ where: { key: "SUPER_ADMIN" } });
  if (!role) {
    throw new Error(
      "Rôle SUPER_ADMIN introuvable — lancez d'abord `npm run db:seed` (catalogue).",
    );
  }

  const existing = await prisma.user.findFirst({
    where: { roles: { some: { roleId: role.id } } },
  });
  if (existing) {
    console.log(`→ Un Super Admin existe déjà : « ${existing.username} » (${existing.id}).`);
    console.log("   Aucune action — bootstrap idempotent. Sortie.");
    return;
  }

  // Nom d'utilisateur déterministe mais sans doublon ; ajustable via env.
  const username =
    process.env.SUPER_ADMIN_USERNAME?.trim() || "superadmin";
  const existingUsername = await prisma.user.findUnique({ where: { username } });
  if (existingUsername) {
    console.error(`→ Un compte « ${username} » existe déjà sans rôle SUPER_ADMIN.`);
    console.error("   Choisissez un autre SUPER_ADMIN_USERNAME ou corrigez le compte existant.");
    process.exit(1);
  }

  const temporaryPassword = randomBytes(18).toString("base64url");
  const passwordHash = await hashPassword(temporaryPassword);

  const superAdmin = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        username,
        email: process.env.SUPER_ADMIN_EMAIL?.trim() || "superadmin@dzerp.dz",
        passwordHash,
        fullName: "Super Administrateur",
        title: "Administration de la plateforme",
        mustChangePassword: true,
      },
    });
    // Aucun UserCompany ni RoleAssignment : le Super Admin est hors société.
    await tx.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });
    return user;
  });

  console.log(`✓ Super Admin créé : « ${superAdmin.username} » (${superAdmin.id}).`);
  console.log("  Les identifiants temporaires suivants ne sont affichés qu'une seule fois :");
  console.log(`    Identifiant : ${superAdmin.username}`);
  console.log(`    Mot de passe : ${temporaryPassword}`);
  console.log("  Le changement de mot de passe est requis à la première connexion (mustChangePassword).");
  console.log("  Ce compte n'est rattaché à aucune société (rôle global de plateforme).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());