import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import type { CommercialDocType, InputDocument, InputLine } from "./types";
import { getDocConfig } from "./config";

/**
 * Valide que les références rattachées au document (succursale, tiers)
 * appartiennent bien à la société du contexte. Les requêtes passent par
 * l'extension companyScope (filtrage automatique par `companyId`) : toute
 * référence d'une autre société est introuvable → rejetée (fail-closed).
 */
async function assertCompanyReference(
  model: "branch" | "customer" | "supplier",
  id: string,
  companyId: string,
  label: string,
): Promise<void> {
  const delegate = (prisma as unknown as Record<string, { count: (args: unknown) => Promise<number> }>)[model];
  const count = await delegate.count({
    where: { id, companyId },
  });
  if (count === 0) {
    throw new ApiError(
      422,
      `${label} invalide ou ne faisant pas partie de la société courante.`,
      "VALIDATION",
      { [model]: "not_found_in_company" },
    );
  }
}

export async function validateDocumentReferences(
  data: InputDocument,
  docType: CommercialDocType,
  companyId: string,
): Promise<void> {
  const config = getDocConfig(docType);
  if (data.branchId) {
    await assertCompanyReference("branch", data.branchId, companyId, "La succursale");
  }
  if (config.partyField === "customerId" && data.customerId) {
    await assertCompanyReference("customer", data.customerId, companyId, "Le client");
  }
  if (config.partyField === "supplierId" && data.supplierId) {
    await assertCompanyReference("supplier", data.supplierId, companyId, "Le fournisseur");
  }

  // Les produits des lignes doivent appartenir à la société active (fail-closed).
  const productIds = (data.lines ?? [])
    .map((line) => line.productId)
    .filter((id): id is string => Boolean(id));

  if (productIds.length > 0) {
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, companyId },
      select: { id: true },
    });
    const found = new Set(products.map((product) => product.id));
    const missing = productIds.find((id) => !found.has(id));
    if (missing) {
      throw new ApiError(
        422,
        "Produit invalide ou ne faisant pas partie de la société courante.",
        "VALIDATION",
        { productId: "not_found_in_company" },
      );
    }
  }
}

export function validateDocumentInput(
  data: InputDocument,
  docType: CommercialDocType,
): void {
  const config = getDocConfig(docType);

  if (!data.branchId) {
    throw new ApiError(422, "La succursale est obligatoire", "VALIDATION", {
      branchId: "required",
    });
  }

  if (config.partyField === "customerId" && !data.customerId) {
    throw new ApiError(422, "Le client est obligatoire", "VALIDATION", {
      customerId: "required",
    });
  }

  if (config.partyField === "supplierId" && !data.supplierId) {
    throw new ApiError(422, "Le fournisseur est obligatoire", "VALIDATION", {
      supplierId: "required",
    });
  }

  if (!data.lines || data.lines.length === 0) {
    throw new ApiError(422, "Au moins une ligne est requise", "VALIDATION", {
      lines: "required",
    });
  }

  validateLines(data.lines);
}

export function validateLines(lines: InputLine[]): void {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const kind = line.kind ?? "PRODUCT";

    if (!line.label || line.label.trim().length === 0) {
      throw new ApiError(422, `Ligne ${i + 1}: le libellé est obligatoire`, "VALIDATION");
    }

    if (kind === "PRODUCT" || kind === "SERVICE") {
      if (line.quantity !== undefined && line.quantity <= 0) {
        throw new ApiError(422, `Ligne ${i + 1}: la quantité doit être supérieure à 0`, "VALIDATION");
      }
      if (line.unitPrice !== undefined && line.unitPrice < 0) {
        throw new ApiError(422, `Ligne ${i + 1}: le prix unitaire ne peut pas être négatif`, "VALIDATION");
      }
      if (line.discountPct !== undefined && (line.discountPct < 0 || line.discountPct > 100)) {
        throw new ApiError(422, `Ligne ${i + 1}: la remise doit être entre 0 et 100%`, "VALIDATION");
      }
      if (line.taxPct !== undefined && (line.taxPct < 0 || line.taxPct > 100)) {
        throw new ApiError(422, `Ligne ${i + 1}: la TVA doit être entre 0 et 100%`, "VALIDATION");
      }
    }
  }
}
