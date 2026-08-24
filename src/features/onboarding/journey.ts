/**
 * Logique de parcours d'amorçage (onboarding) de l'entreprise.
 *
 * 100 % dérivé des DONNÉES réelles de la société — aucune valeur « complétée »
 * n'est stockée en dehors des données sous-jacentes. Si l'utilisateur supprime
 * une donnée, l'étape redevient automatiquement incomplète (système véridique).
 *
 * Le seul état persistant est le RENONCEMENT (dismiss), stocké dans la
 * configuration globale existante `onboarding.dismissed` (pas de nouveau champ
 * Prisma — réutilisation du mécanisme Setting déjà en place).
 */

export type MilestoneKey =
  | "company"
  | "partners"
  | "products"
  | "stock"
  | "documents";

export type Milestone = {
  key: MilestoneKey;
  optional: boolean;
  complete: boolean;
  href: string;
  labelKey: string;
};

export type JourneyState = {
  /** Afficher le parcours complet (entreprise non finalisée + non ignoré). */
  show: boolean;
  /** Afficher le bandeau subtil « prêt » (finalisée + non ignoré). */
  showReady: boolean;
  milestones: Milestone[];
  completedCount: number;
  totalCount: number;
  /** Action unique et déterministe vers la prochaine étape (ou null si prêt). */
  nextAction: { labelKey: string; href: string } | null;
  foundationComplete: boolean;
};

export type JourneyInput = {
  companyName: string;
  branchCount: number;
  customerCount: number;
  supplierCount: number;
  productCount: number;
  warehouseCount: number;
  documentCount: number;
  dismissed: boolean;
};

export function computeJourney(input: JourneyInput): JourneyState {
  const milestones: Milestone[] = [
    {
      key: "company",
      optional: false,
      complete: input.companyName.trim().length > 0,
      href: "/parametres",
      labelKey: "onboarding.milestone.company",
    },
    {
      key: "partners",
      optional: false,
      complete: input.customerCount > 0 || input.supplierCount > 0,
      href: "/crm/customers",
      labelKey: "onboarding.milestone.partners",
    },
    {
      key: "products",
      optional: false,
      complete: input.productCount > 0,
      href: "/stock",
      labelKey: "onboarding.milestone.products",
    },
    {
      key: "stock",
      optional: true,
      complete: input.warehouseCount > 0,
      href: "/stock/entrepots",
      labelKey: "onboarding.milestone.stock",
    },
    {
      key: "documents",
      optional: false,
      complete: input.documentCount > 0,
      href: "/documents",
      labelKey: "onboarding.milestone.documents",
    },
  ];

  const completedCount = milestones.filter((m) => m.complete).length;
  const foundationComplete = milestones
    .filter((m) => !m.optional)
    .every((m) => m.complete);
  const firstIncomplete = milestones.find((m) => !m.complete);
  const nextAction = firstIncomplete
    ? { labelKey: `onboarding.next.${firstIncomplete.key}`, href: firstIncomplete.href }
    : null;

  return {
    show: !input.dismissed && !foundationComplete,
    showReady: !input.dismissed && foundationComplete,
    milestones,
    completedCount,
    totalCount: milestones.length,
    nextAction,
    foundationComplete,
  };
}
