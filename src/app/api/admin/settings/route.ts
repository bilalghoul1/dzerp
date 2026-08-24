import { NextResponse } from "next/server";
import { z } from "zod";
import { adminGuard, superAdminOnly } from "@/features/company-admin/api";
import {
  listSettings,
  setSetting,
} from "@/features/settings/server";
import { prismaBase } from "@/lib/prisma";
import { okResponse, errorResponse } from "@/lib/http";

/**
 * Paramètres PLATEFORME (Phase 7.5 — Paramètres). Réservés au SUPER_ADMIN
 * global : `adminGuard()` (authentification) puis `superAdminOnly` (403 pour
 * les administrateurs de société). Les secrets sont renvoyés pour la lecture
 * mais le client les affiche masqués.
 */
export async function GET(): Promise<NextResponse> {
  const guard = await adminGuard();
  const admin = superAdminOnly(guard);
  if (admin.response) return admin.response;

  try {
    const settings = await listSettings({ includeSecrets: true });
    return okResponse(settings);
  } catch (error) {
    return errorResponse(error);
  }
}

const updateItemSchema = z.object({
  key: z.string().min(1),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.record(z.string(), z.unknown()),
    z.array(z.unknown()),
  ]),
});

const updateSchema = z.object({
  settings: z.array(updateItemSchema).min(1),
});

const SETTING_TYPES = ["STRING", "NUMBER", "BOOLEAN", "JSON", "SECRET"] as const;

export async function PUT(request: Request): Promise<NextResponse> {
  const guard = await adminGuard();
  const admin = superAdminOnly(guard);
  if (admin.response) return admin.response;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
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

    const existing = await prismaBase.setting.findMany({
      where: { key: { in: parsed.data.settings.map((s) => s.key) } },
    });
    const byKey = new Map(existing.map((s) => [s.key, s]));

    for (const item of parsed.data.settings) {
      const setting = byKey.get(item.key);
      if (!setting) {
        return NextResponse.json(
          {
            error: {
              message: `Paramètre inconnu : ${item.key}.`,
              code: "UNKNOWN_SETTING_KEY",
            },
          },
          { status: 400 },
        );
      }
      if (!SETTING_TYPES.includes(setting.type)) {
        return NextResponse.json(
          {
            error: {
              message: `Type de paramètre non géré : ${setting.type}.`,
              code: "UNSUPPORTED_SETTING_TYPE",
            },
          },
          { status: 400 },
        );
      }
    }

    await Promise.all(
      parsed.data.settings.map((item) => {
        const type = byKey.get(item.key)!.type;
        return setSetting({
          key: item.key,
          value: item.value,
          type,
          updatedById: admin.actor.userId,
        });
      }),
    );

    return okResponse({ updated: parsed.data.settings.length });
  } catch (error) {
    return errorResponse(error);
  }
}
