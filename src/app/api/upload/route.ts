import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import {
  saveUploadFile,
  MAX_UPLOAD_BYTES,
} from "@/features/upload/storage";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/features/audit/service";
import { errorResponse } from "@/lib/http";

export const maxDuration = 30;

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("files.upload");
  if (guard.response) return guard.response;

  return runScoped(guard.context, async () => {
    try {
      const formData = await request.formData();
      const files = formData.getAll("files").filter((f): f is File => f instanceof File);
      const entity = (formData.get("entity") as string | null) ?? null;
      const entityId = (formData.get("entityId") as string | null) ?? null;

      if (files.length === 0) {
        return NextResponse.json(
          { error: { message: "Aucun fichier reçu.", code: "NO_FILES" } },
          { status: 400 },
        );
      }

      const tooLarge = files.find((f) => f.size > MAX_UPLOAD_BYTES);
      if (tooLarge) {
        return NextResponse.json(
          {
            error: {
              message: `Fichier trop volumineux (max ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} Mo).`,
              code: "FILE_TOO_LARGE",
            },
          },
          { status: 413 },
        );
      }

      const saved = [];
      for (const file of files) {
        const stored = await saveUploadFile(file);
        await prisma.fileAsset.create({
          data: {
            originalName: stored.originalName,
            storageKey: stored.storageKey,
            mimeType: stored.mimeType,
            size: stored.size,
            kind: "ATTACHMENT",
            entity: entity ?? "general",
            entityId,
            companyId: guard.context.company.id,
            createdById: guard.session.user.id,
          },
        });
        saved.push(stored);
      }

      await recordAudit({
        action: "UPLOAD",
        entity: "FileAsset",
        actorId: guard.session.user.id,
        changes: { count: saved.length },
      });

      return NextResponse.json({ data: saved }, { status: 201 });
    } catch (error) {
      console.error("upload error:", error);
      return errorResponse(error);
    }
  });
}
