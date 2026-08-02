import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/rbac";
import { hasPermission } from "@/features/auth/rbac";
import { saveUploadFile } from "@/features/upload/storage";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/features/audit/service";

export const maxDuration = 30;

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json(
      { error: { message: "Non authentifié.", code: "UNAUTHENTICATED" } },
      { status: 401 },
    );
  }
  if (!hasPermission(session.permissions, "files.upload")) {
    return NextResponse.json(
      { error: { message: "Accès refusé.", code: "FORBIDDEN" } },
      { status: 403 },
    );
  }

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
          createdById: session.user.id,
        },
      });
      saved.push(stored);
    }

    await recordAudit({
      action: "UPLOAD",
      entity: "FileAsset",
      actorId: session.user.id,
      changes: { count: saved.length },
    });

    return NextResponse.json({ data: saved }, { status: 201 });
  } catch (error) {
    console.error("upload error:", error);
    return NextResponse.json(
      { error: { message: "Erreur interne.", code: "INTERNAL_ERROR" } },
      { status: 500 },
    );
  }
}
