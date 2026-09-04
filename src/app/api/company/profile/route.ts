import { NextResponse } from "next/server";
import { z } from "zod";
import { apiGuardWithContext } from "@/features/company/api";
import { okResponse } from "@/lib/http";
import {
  getCompanySettings,
  updateCompanySettings,
  COMPANY_FIELDS,
  CompanySettingsError,
} from "@/features/company/settings";

/**
 * GET /api/company/profile
 *
 * Read company settings for the authenticated user's active company.
 * Auth: parametres.view
 * Data: Company model (per-company, company-scoped)
 */
export async function GET(): Promise<NextResponse> {
  const guard = await apiGuardWithContext("parametres.view");
  if (guard.response) return guard.response;

  try {
    const settings = await getCompanySettings(guard.context.company.id);
    return okResponse(settings);
  } catch (error) {
    if (error instanceof CompanySettingsError) {
      return NextResponse.json(
        { error: { message: error.message, code: error.code } },
        { status: error.code === "NOT_FOUND" ? 404 : 500 },
      );
    }
    console.error("company/profile GET error:", error);
    return NextResponse.json(
      { error: { message: "Erreur interne.", code: "INTERNAL_ERROR" } },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PUT schema
// ---------------------------------------------------------------------------

const putItemSchema = z.record(z.string(), z.unknown());

const putSchema = z.object({
  settings: putItemSchema.refine(
    (obj) => Object.keys(obj).length > 0,
    { message: "Au moins requis un champ." },
  ),
});

/**
 * PUT /api/company/profile
 *
 * Update company settings for the authenticated user's active company.
 * Auth: parametres.manage
 * Data: Company model (per-company, company-scoped) + AuditLog
 *
 * Accepts: { settings: { name: "...", taxId: "...", ... } }
 * Flat field names (not company.* prefixed).
 */
export async function PUT(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("parametres.manage");
  if (guard.response) return guard.response;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: "Requête invalide.",
            code: "INVALID_BODY",
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      );
    }

    // Validate all keys are allowed
    const input = parsed.data.settings;
    const invalidKeys = Object.keys(input).filter((k) => !COMPANY_FIELDS.has(k));
    if (invalidKeys.length > 0) {
      return NextResponse.json(
        {
          error: {
            message: `Champs non autorisés: ${invalidKeys.join(", ")}.`,
            code: "INVALID_FIELD",
          },
        },
        { status: 400 },
      );
    }

    await updateCompanySettings(
      guard.context.company.id,
      input,
      guard.session.user.id,
    );

    return okResponse({ updated: Object.keys(input).length });
  } catch (error) {
    if (error instanceof CompanySettingsError) {
      return NextResponse.json(
        { error: { message: error.message, code: error.code } },
        {
          status:
            error.code === "NOT_FOUND"
              ? 404
              : error.code === "VALIDATION"
                ? 400
                : 500,
        },
      );
    }
    console.error("company/profile PUT error:", error);
    return NextResponse.json(
      {
        error: {
          message: "Erreur lors de l'enregistrement. Aucune modification n'a été appliquée.",
          code: "INTERNAL_ERROR",
        },
      },
      { status: 500 },
    );
  }
}
