import { prisma, prismaBase } from "@/lib/prisma";
import { ApiError } from "@/lib/http";
import { runUnscoped } from "@/features/company/unscoped";
import { recordAudit } from "@/features/audit/service";
import { recordActivity } from "@/features/activity/service";
import { hashPassword } from "@/features/auth/password";
import type {
  ActivityType,
  AuditAction,
} from "@/generated/prisma/enums";
import { DEFAULT_SERIES, DEFAULT_HEADQUARTER_BRANCH } from "@/features/company-admin/defaults";

/** Clé du rôle de société attribué au propriétaire (administrateur de société). */
const COMPANY_ADMIN_ROLE_KEY = "COMPANY_ADMIN";

/** Durée de la période d'essai en jours (surchargeable via TRYAL_DAYS). */
function trialDays(): number {
  const raw = Number(process.env.TRIAL_DAYS);
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  return 14;
}

/**
 * Compte Public : inscription à une période d'essai. Contrairement à la
 * création de société par le Super Administrateur (`createCompany`), ce chemin
 * est PUBLIC (aucune autorisation requise) : n'importe quel visiteur peut
 * ouvrir un compte d'essai avec sa propre société.
 *
 * Règles de sécurité :
 *  - Chiffrement fort du mot de passe (bcrypt) ; `mustChangePassword` true.
 *  - Nom d'utilisateur et email uniques (détection avant écriture, atomique).
 *  - Code de société généré automatiquement et rendu unique.
 *  - Toute l'écriture est ATOMIQUE dans une seule transaction : société,
 *    succursale, séries, propriétaire, adhésion, rôle. Aucun état partiel.
 *  - /!\ Le nom d'utilisateur / la société ne sont jamais dérivés de champs
 *    non validés ni d'un code contrôlé par le client : tout est construit
 *    serveur.
 */
export async function registerTrialCompany(input: {
  fullName: string;
  username: string;
  email?: string | null;
  password: string;
  companyName: string;
  phone?: string | null;
  city?: string | null;
}): Promise<{
  userId: string;
  companyId: string;
  companyName: string;
  expiresAt: Date;
}> {
  return runUnscoped(async () => {
    const username = input.username.trim();
    const companyName = input.companyName.trim();
    const email = input.email?.trim() || null;

    if (!username || !companyName || !input.fullName?.trim() || !input.password) {
      throw new ApiError(
        400,
        "Nombre, identifiant, nom de société et mot de passe sont obligatoires.",
        "VALIDATION",
      );
    }
    if (input.password.length < 8) {
      throw new ApiError(
        400,
        "Le mot de passe doit contenir au moins 8 caractères.",
        "VALIDATION",
      );
    }

    // Code société unique : dérivé du nom, complété par un suffixe si nécessaire.
    const code = await generateUniqueCompanyCode(companyName);

    // Durée de l'essai : expiration appliquée au RoleAssignment du propriétaire.
    const now = new Date();
    const expiresAt = new Date(now.getTime() + trialDays() * 24 * 60 * 60 * 1000);

    const txResult = await prismaBase.$transaction(
      async (tx) => {
      // Unicité avant écriture : identifiant et email.
      const takenUser = await tx.user.findUnique({
        where: { username },
        select: { id: true },
      });
      if (takenUser) {
        throw new ApiError(
          409,
          `L'identifiant ${username} est déjà utilisé.`,
          "CONFLICT",
        );
      }
      if (email) {
        const takenEmail = await tx.user.findUnique({
          where: { email },
          select: { id: true },
        });
        if (takenEmail) {
          throw new ApiError(
            409,
            "Cet email est déjà associé à un autre compte.",
            "CONFLICT",
          );
        }
      }

      // Société d'essai (statut ACTIVE par défaut) : la société est utilisable
      // immédiatement (expérience instant), et `expiryDate` porte la fin de
      // l'essai. Elle alimente la surface d'administration : le Super
      // Administrateur y voit les essais et leur échéance pour les vérifier /
      // prolonger / suspendre.
      const created = await tx.company.create({
        data: {
          code,
          name: companyName,
          legalName: companyName,
          commercialName: companyName,
          phone: input.phone?.trim() || null,
          commune: input.city?.trim() || null,
          status: "ACTIVE",
          isActive: true,
          currency: "DZD",
          language: "fr",
          printFormat: "A4",
          expiryDate: expiresAt,
        },
      });

      // Succursale principale (siège) + société par défaut.
      const branch = await tx.branch.create({
        data: {
          ...DEFAULT_HEADQUARTER_BRANCH,
          code: DEFAULT_HEADQUARTER_BRANCH.code,
          type: "HEADQUARTER",
          city: input.city?.trim() || "",
          companyId: created.id,
        },
      });
      await tx.company.update({
        where: { id: created.id },
        data: { defaultBranchId: branch.id },
      });

      // Séries documentaires par défaut.
      for (const series of DEFAULT_SERIES) {
        await tx.documentSeries.create({
          data: {
            companyId: created.id,
            key: series.docType,
            docType: series.docType,
            label: series.label,
            labelAr: series.labelAr,
            prefix: series.prefix,
            separator: series.separator ?? "-",
            suffix: series.suffix ?? "",
            withYear: series.withYear,
            padLength: series.padLength,
            step: series.step ?? 1,
            nextValue: BigInt(series.nextValue ?? 1),
          },
        });
      }

      // Compte Propriétaire : User + UserCompany(default) + RoleAssignment(COMPANY_ADMIN).
      const ownerRole = await tx.role.findUnique({
        where: { key: COMPANY_ADMIN_ROLE_KEY },
        select: { id: true },
      });
      if (!ownerRole) {
        throw new ApiError(
          500,
          "Le rôle COMPANY_ADMIN n'existe pas — exécutez la migration des rôles.",
          "MISSING_COMPANY_ADMIN_ROLE",
        );
      }

      const owner = await tx.user.create({
        data: {
          username,
          email,
          fullName: input.fullName.trim(),
          passwordHash: await hashPassword(input.password),
          // L'utilisateur choisit son propre mot de passe lors de l'inscription :
          // pas de changement forcé au premier accès.
          mustChangePassword: false,
        },
      });

      const ownerUserCompany = await tx.userCompany.create({
        data: {
          userId: owner.id,
          companyId: created.id,
          active: true,
          isDefault: true,
          defaultBranchId: branch.id,
        },
      });

      // L'essai expire via `expiresAt` : date passée → aucune permission
      // (échec sûr), la période d'essai est automatiquement close.
      await tx.roleAssignment.create({
        data: {
          userCompanyId: ownerUserCompany.id,
          roleId: ownerRole.id,
          active: true,
          expiresAt,
          assignedBy: owner.id,
        },
      });

      return { company: created, owner };
    }, { timeout: 60000 });

    const company = txResult.company;

    await recordAudit({
      action: "CREATE" as AuditAction,
      entity: "Company",
      entityId: company.id,
      actorId: txResult.owner.id,
      companyId: company.id,
      changes: { code, name: company.name, trial: true },
    });
    await recordActivity({
      type: "CREATE" as ActivityType,
      entity: "Company",
      entityId: company.id,
      actorId: txResult.owner.id,
      companyId: company.id,
      title: `Société d'essai créée : ${company.name}`,
      titleAr: `تم إنشاء شركة تجريبية: ${company.name}`,
    });

    return {
      userId: txResult.owner.id,
      companyId: company.id,
      companyName: company.name,
      expiresAt,
    };
  });
}

/** Génère un code société unique (DOIT être appelé dans `runUnscoped`). */
async function generateUniqueCompanyCode(base: string): Promise<string> {
  const cleaned =
    base
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "")
      .toUpperCase()
      .slice(0, 4) || "ESS";

  for (let attempt = 0; attempt < 20; attempt++) {
    const suffix = attempt === 0 ? "" : String(attempt + 1);
    const candidate = `${cleaned}${suffix}`.slice(0, 20);
    const existing = await prisma.company.findFirst({
      where: { code: candidate, deletedAt: null },
      select: { id: true },
    });
    if (!existing) return candidate;
  }

  // Repli ultime : identifiant aléatoire.
  return `ESS${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}
