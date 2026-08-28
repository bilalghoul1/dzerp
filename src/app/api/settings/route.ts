import { NextResponse } from "next/server";
import { z } from "zod";
import { apiGuard } from "@/features/auth/api-guard";
import { listSettings, setSetting, type SettingValue } from "@/features/settings/server";
import { ALLOWED_SETTING_KEYS } from "@/features/settings/keys";
import { okResponse } from "@/lib/http";
import { prismaBase } from "@/lib/prisma";
import { resolveCompanyContext } from "@/features/company/resolver";
import { COMPANY_KEY_MAP } from "./keys-shared";

const updateItemSchema = z.object({
  key: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown()), z.array(z.unknown())]),
  type: z.enum(["STRING", "NUMBER", "BOOLEAN", "JSON", "SECRET"]).optional(),
});

const updateSchema = z.object({
  settings: z.array(updateItemSchema).min(1),
});

/** Sérialise une valeur pour la colonne `Setting.value` (string). */
function stringifyValue(value: SettingValue): string {
  if (typeof value === "string") return value;
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  return JSON.stringify(value);
}

export async function GET(): Promise<NextResponse> {
  const guard = await apiGuard("parametres.view");
  if (guard.response) return guard.response;

  try {
    const settings = await listSettings({
      includeSecrets: guard.session.permissions.includes("parametres.manage"),
    });
    return okResponse(settings);
  } catch (error) {
    console.error("settings GET error:", error);
    return NextResponse.json(
      { error: { message: "Erreur interne.", code: "INTERNAL_ERROR" } },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  const guard = await apiGuard("parametres.manage");
  if (guard.response) return guard.response;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: "Requête invalide.", code: "INVALID_BODY", details: parsed.error.flatten() } },
        { status: 400 },
      );
    }

    for (const item of parsed.data.settings) {
      if (!ALLOWED_SETTING_KEYS.has(item.key)) {
        return NextResponse.json(
          {
            error: {
              message: `Clé de paramètre inconnue : ${item.key}.`,
              code: "INVALID_SETTING_KEY",
            },
          },
          { status: 400 },
        );
      }
    }

    const companySettings = parsed.data.settings.filter(
      (item) => item.key.startsWith("company."),
    );

    // Map company.* settings to Company model columns.
    let companyData: Record<string, unknown> = {};
    for (const item of companySettings) {
      const field = COMPANY_KEY_MAP[item.key];
      if (field) {
        companyData[field] =
          typeof item.value === "string" && item.value === ""
            ? null
            : item.value;
      }
    }

    // establishedAt is stored as a Date on Company but sent as an ISO string.
    if ("establishedAt" in companyData) {
      const raw = companyData.establishedAt as string | null;
      const parsedDate = raw ? new Date(raw) : null;
      companyData.establishedAt =
        parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;
    }

    // Resolve the CURRENT company for the authenticated user (multi-tenant safety).
    let companyId: string | null = null;
    if (Object.keys(companyData).length > 0) {
      const companyCtx = await resolveCompanyContext(guard.session);
      companyId = companyCtx.company.id;
    }

    // Apply all settings AND the Company model update in a single transaction so
    // a failure on either source never leaves them out of sync (no silent drift).
    await prismaBase.$transaction(async (tx) => {
      for (const item of parsed.data.settings) {
        await tx.setting.upsert({
          where: { key: item.key },
          update: {
            value: stringifyValue(item.value as SettingValue),
            type: item.type,
            description: undefined,
            updatedById: guard.session.user.id,
          },
          create: {
            key: item.key,
            value: stringifyValue(item.value as SettingValue),
            type: item.type ?? "STRING",
            updatedById: guard.session.user.id,
          },
        });
      }

      if (companyId && Object.keys(companyData).length > 0) {
        await tx.company.update({
          where: { id: companyId },
          data: {
            ...companyData,
            updatedById: guard.session.user.id,
          },
        });
      }
    });

    return okResponse({ updated: parsed.data.settings.length });
  } catch (error) {
    console.error("settings PUT error:", error);
    return NextResponse.json(
      {
        error: {
          message: "Erreur lors de l'enregistrement des paramètres. Aucune modification n'a été appliquée.",
          code: "INTERNAL_ERROR",
        },
      },
      { status: 500 },
    );
  }
}
