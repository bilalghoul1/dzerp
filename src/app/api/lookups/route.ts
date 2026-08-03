import { NextResponse } from "next/server";
import { z } from "zod";
import { apiGuard } from "@/features/auth/api-guard";
import { recordAudit } from "@/features/audit/service";
import { okResponse } from "@/lib/http";
import {
  LOOKUP_KINDS,
  createLookupRow,
  listCommunes,
  listLookups,
  listWilayas,
  setLookupActive,
  updateLookupRow,
  type LookupKind,
} from "@/features/lookups/config";

const kindSchema = z.enum(LOOKUP_KINDS as [LookupKind, ...LookupKind[]]);

const createSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
  nameAr: z.string().trim().max(160).optional().nullable(),
  days: z.number().int().min(0).max(3650).optional().nullable(),
  swift: z.string().trim().max(20).optional().nullable(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  nameAr: z.string().trim().max(160).optional().nullable(),
  days: z.number().int().min(0).max(3650).optional().nullable(),
  swift: z.string().trim().max(20).optional().nullable(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: Request): Promise<NextResponse> {
  const guard = await apiGuard("parametres.view");
  if (guard.response) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const wilaya = searchParams.get("wilaya") ?? undefined;

    if (type === "wilayas") {
      return okResponse(await listWilayas());
    }
    if (type === "communes") {
      return okResponse(await listCommunes(wilaya || undefined));
    }
    return okResponse(await listLookups());
  } catch (error) {
    console.error("lookups GET error:", error);
    return NextResponse.json(
      { error: { message: "Erreur interne.", code: "INTERNAL_ERROR" } },
      { status: 500 },
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await apiGuard("parametres.manage");
  if (guard.response) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const parsedType = kindSchema.safeParse(searchParams.get("type"));
    if (!parsedType.success) {
      return NextResponse.json(
        { error: { message: "Type de référentiel invalide.", code: "INVALID_TYPE" } },
        { status: 400 },
      );
    }
    const body = await request.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: "Requête invalide.", code: "INVALID_BODY", details: parsed.error.flatten() } },
        { status: 400 },
      );
    }

    const row = await createLookupRow(
      parsedType.data,
      parsed.data,
      guard.session.user.id,
    );

    await recordAudit({
      action: "CREATE",
      entity: parsedType.data,
      entityId: row.id,
      actorId: guard.session.user.id,
    });

    return okResponse(row, { status: 201 });
  } catch (error) {
    console.error("lookups POST error:", error);
    return NextResponse.json(
      { error: { message: "Erreur interne.", code: "INTERNAL_ERROR" } },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const guard = await apiGuard("parametres.manage");
  if (guard.response) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const parsedType = kindSchema.safeParse(searchParams.get("type"));
    const id = searchParams.get("id");
    if (!parsedType.success || !id) {
      return NextResponse.json(
        { error: { message: "Type ou identifiant manquant.", code: "INVALID_BODY" } },
        { status: 400 },
      );
    }
    const body = await request.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: "Requête invalide.", code: "INVALID_BODY", details: parsed.error.flatten() } },
        { status: 400 },
      );
    }

    const row = await updateLookupRow(
      parsedType.data,
      id,
      parsed.data,
      guard.session.user.id,
    );

    await recordAudit({
      action: "UPDATE",
      entity: parsedType.data,
      entityId: row.id,
      actorId: guard.session.user.id,
    });

    return okResponse(row);
  } catch (error) {
    console.error("lookups PATCH error:", error);
    return NextResponse.json(
      { error: { message: "Erreur interne.", code: "INTERNAL_ERROR" } },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const guard = await apiGuard("parametres.manage");
  if (guard.response) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const parsedType = kindSchema.safeParse(searchParams.get("type"));
    const id = searchParams.get("id");
    if (!parsedType.success || !id) {
      return NextResponse.json(
        { error: { message: "Type ou identifiant manquant.", code: "INVALID_BODY" } },
        { status: 400 },
      );
    }

    const row = await setLookupActive(parsedType.data, id, false, guard.session.user.id);

    await recordAudit({
      action: "DELETE",
      entity: parsedType.data,
      entityId: row.id,
      actorId: guard.session.user.id,
    });

    return okResponse(row);
  } catch (error) {
    console.error("lookups DELETE error:", error);
    return NextResponse.json(
      { error: { message: "Erreur interne.", code: "INTERNAL_ERROR" } },
      { status: 500 },
    );
  }
}
