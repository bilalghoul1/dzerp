import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import {
  formatSeriesNumber,
  listDocumentSeries,
} from "@/features/documents/series";
import { recordAudit } from "@/features/audit/service";
import { okResponse } from "@/lib/http";

const updateSchema = z.object({
  id: z.string().min(1),
  prefix: z.string().max(20).optional(),
  separator: z.string().max(10).optional(),
  suffix: z.string().max(20).optional(),
  withYear: z.boolean().optional(),
  year: z.number().int().nullable().optional(),
  padLength: z.number().int().min(1).max(12).optional(),
  step: z.number().int().min(1).max(1000).optional(),
  nextValue: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(): Promise<NextResponse> {
  const guard = await apiGuardWithContext("parametres.view");
  if (guard.response) return guard.response;

  return runScoped(guard.context, async () => {
    try {
      const series = await listDocumentSeries();
      const withPreview = series.map((s) => ({
        ...s,
        next: formatSeriesNumber(s, s.nextValue),
      }));
      return okResponse(withPreview);
    } catch (error) {
      console.error("series GET error:", error);
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
      const body = await request.json().catch(() => ({}));
      const parsed = updateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: { message: "Requête invalide.", code: "INVALID_BODY", details: parsed.error.flatten() } },
          { status: 400 },
        );
      }

      const { id, ...data } = parsed.data;
      const existing = await prisma.documentSeries.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json(
          { error: { message: "Série introuvable.", code: "NOT_FOUND" } },
          { status: 404 },
        );
      }

      const nextValue =
        data.nextValue !== undefined ? BigInt(data.nextValue) : undefined;

      const series = await prisma.documentSeries.update({
        where: { id },
        data: { ...data, ...(nextValue !== undefined ? { nextValue } : {}) },
      });

      await recordAudit({
        action: "UPDATE",
        entity: "DocumentSeries",
        entityId: series.id,
        actorId: guard.session.user.id,
      });

      return okResponse(series);
    } catch (error) {
      console.error("series PATCH error:", error);
      return NextResponse.json(
        { error: { message: "Erreur interne.", code: "INTERNAL_ERROR" } },
        { status: 500 },
      );
    }
  });
}
