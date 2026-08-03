import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { recordAudit } from "@/features/audit/service";
import { recordActivity } from "@/features/activity/service";
import { okResponse } from "@/lib/http";

const createSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1),
  nameAr: z.string().trim().max(120).optional().nullable(),
  type: z.enum(["HEADQUARTER", "DIRECTION", "AGENCY"]).optional(),
  city: z.string().trim().max(120).optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  manager: z.string().trim().max(120).optional().nullable(),
  country: z.string().trim().max(20).optional().nullable(),
  wilaya: z.string().trim().max(20).optional().nullable(),
  commune: z.string().trim().max(20).optional().nullable(),
  postalCode: z.string().trim().max(20).optional().nullable(),
  rc: z.string().trim().max(40).optional().nullable(),
  nif: z.string().trim().max(40).optional().nullable(),
  nis: z.string().trim().max(40).optional().nullable(),
  ai: z.string().trim().max(40).optional().nullable(),
  isActive: z.boolean().optional(),
});

const updateSchema = createSchema
  .omit({ code: true })
  .extend({ isActive: z.boolean().optional() });

export async function GET(): Promise<NextResponse> {
  const guard = await apiGuardWithContext("parametres.view");
  if (guard.response) return guard.response;

  return runScoped(guard.context, async () => {
    try {
      const branches = await prisma.branch.findMany({
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        select: {
          id: true,
          code: true,
          name: true,
          nameAr: true,
          type: true,
          city: true,
          address: true,
          phone: true,
          email: true,
          manager: true,
          country: true,
          wilaya: true,
          commune: true,
          postalCode: true,
          rc: true,
          nif: true,
          nis: true,
          ai: true,
          isActive: true,
          createdAt: true,
        },
      });
      return okResponse(branches);
    } catch (error) {
      console.error("branches GET error:", error);
      return NextResponse.json(
        { error: { message: "Erreur interne.", code: "INTERNAL_ERROR" } },
        { status: 500 },
      );
    }
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("parametres.manage");
  if (guard.response) return guard.response;

  return runScoped(guard.context, async () => {
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = createSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: { message: "Requête invalide.", code: "INVALID_BODY", details: parsed.error.flatten() } },
          { status: 400 },
        );
      }

      const existing = await prisma.branch.findFirst({ where: { code: parsed.data.code } });
      if (existing) {
        return NextResponse.json(
          { error: { message: "Ce code de succursale existe déjà.", code: "DUPLICATE_CODE" } },
          { status: 409 },
        );
      }

      const branch = await prisma.branch.create({
        data: {
          ...parsed.data,
          companyId: guard.context.company.id,
          createdById: guard.session.user.id,
        },
      });

      await recordAudit({
        action: "CREATE",
        entity: "Branch",
        entityId: branch.id,
        actorId: guard.session.user.id,
      });
      await recordActivity({
        type: "CREATE",
        entity: "Branch",
        entityId: branch.id,
        actorId: guard.session.user.id,
        title: `Succursale créée : ${branch.name}`,
        titleAr: `تم إنشاء الفرع: ${branch.name}`,
      });

      return okResponse(branch, { status: 201 });
    } catch (error) {
      console.error("branches POST error:", error);
      return NextResponse.json(
        { error: { message: "Erreur interne.", code: "INTERNAL_ERROR" } },
        { status: 500 },
      );
    }
  });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("parametres.manage");
  if (guard.response) return guard.response;

  return runScoped(guard.context, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get("id");
      if (!id) {
        return NextResponse.json(
          { error: { message: "Identifiant manquant.", code: "MISSING_ID" } },
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

      const existing = await prisma.branch.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json(
          { error: { message: "Succursale introuvable.", code: "NOT_FOUND" } },
          { status: 404 },
        );
      }

      const branch = await prisma.branch.update({
        where: { id },
        data: { ...parsed.data, updatedById: guard.session.user.id },
      });

      await recordAudit({
        action: "UPDATE",
        entity: "Branch",
        entityId: branch.id,
        actorId: guard.session.user.id,
      });

      return okResponse(branch);
    } catch (error) {
      console.error("branches PATCH error:", error);
      return NextResponse.json(
        { error: { message: "Erreur interne.", code: "INTERNAL_ERROR" } },
        { status: 500 },
      );
    }
  });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("parametres.manage");
  if (guard.response) return guard.response;

  return runScoped(guard.context, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get("id");
      if (!id) {
        return NextResponse.json(
          { error: { message: "Identifiant manquant.", code: "MISSING_ID" } },
          { status: 400 },
        );
      }

      const existing = await prisma.branch.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json(
          { error: { message: "Succursale introuvable.", code: "NOT_FOUND" } },
          { status: 404 },
        );
      }

      if (existing.type === "HEADQUARTER") {
        return NextResponse.json(
          { error: { message: "La succursale siège ne peut pas être désactivée.", code: "PROTECTED" } },
          { status: 400 },
        );
      }

      const branch = await prisma.branch.update({
        where: { id },
        data: { isActive: false, updatedById: guard.session.user.id },
      });

      await recordAudit({
        action: "DELETE",
        entity: "Branch",
        entityId: branch.id,
        actorId: guard.session.user.id,
      });

      return okResponse(branch);
    } catch (error) {
      console.error("branches DELETE error:", error);
      return NextResponse.json(
        { error: { message: "Erreur interne.", code: "INTERNAL_ERROR" } },
        { status: 500 },
      );
    }
  });
}
