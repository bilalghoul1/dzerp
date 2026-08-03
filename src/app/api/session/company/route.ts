import { NextResponse } from "next/server";
import { z } from "zod";
import { apiGuard } from "@/features/auth/api-guard";
import { switchCompany } from "@/features/company/resolver";
import { recordAudit } from "@/features/audit/service";
import { errorResponse, okResponse } from "@/lib/http";

const switchSchema = z.object({
  companyId: z.string().trim().min(1),
});

/**
 * Change la société active (POST /api/session/company).
 * - Valide l'authentification et l'appartenance à la société cible.
 * - Persiste la société (session) + cookie, ajuste la succursale.
 * - Le client appelle `router.refresh()` pour rafraîchir le contexte,
 *   le tableau de bord, la navigation, les notifications et la recherche.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const guard = await apiGuard();
  if (guard.response) return guard.response;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = switchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: "Requête invalide.", code: "INVALID_BODY" } },
        { status: 400 },
      );
    }

    const result = await switchCompany(
      guard.session.user.id,
      parsed.data.companyId,
    );

    await recordAudit({
      action: "SETTING_CHANGE",
      entity: "Session",
      entityId: guard.session.user.id,
      actorId: guard.session.user.id,
      changes: { action: "SWITCH_COMPANY", companyId: result.company.id },
    });

    return okResponse(result);
  } catch (error) {
    console.error("session/company POST error:", error);
    return errorResponse(error);
  }
}
