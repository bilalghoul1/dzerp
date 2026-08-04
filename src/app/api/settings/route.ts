import { NextResponse } from "next/server";
import { z } from "zod";
import { apiGuard } from "@/features/auth/api-guard";
import { listSettings, setSetting, type SettingValue } from "@/features/settings/server";
import { ALLOWED_SETTING_KEYS } from "@/features/settings/keys";
import { okResponse } from "@/lib/http";

const updateItemSchema = z.object({
  key: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown()), z.array(z.unknown())]),
  type: z.enum(["STRING", "NUMBER", "BOOLEAN", "JSON", "SECRET"]).optional(),
});

const updateSchema = z.object({
  settings: z.array(updateItemSchema).min(1),
});

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

    await Promise.all(
      parsed.data.settings.map((item) =>
        setSetting({
          key: item.key,
          value: item.value as SettingValue,
          type: item.type,
          updatedById: guard.session.user.id,
        }),
      ),
    );

    return okResponse({ updated: parsed.data.settings.length });
  } catch (error) {
    console.error("settings PUT error:", error);
    return NextResponse.json(
      { error: { message: "Erreur interne.", code: "INTERNAL_ERROR" } },
      { status: 500 },
    );
  }
}
