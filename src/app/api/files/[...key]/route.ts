import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import {
  readUploadFile,
  isInlineSafeMime,
} from "@/features/upload/storage";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
): Promise<NextResponse> {
  const { key } = await params;
  const storageKey = key.join("/");

  // Authentification + résolution du contexte société. Le scoping de la
  // requête FileAsset ci-dessous limite la lecture à la société active :
  // toute tentative d'accès inter-sociétés se solde par un 404. La permission
  // `files.download` est requise (catalogue + migration phase 6.5).
  const guard = await apiGuardWithContext("files.download");
  if (guard.response) return guard.response;

  return runScoped(guard.context, async () => {
    const asset = await prisma.fileAsset.findFirst({
      where: { storageKey },
      select: { storageKey: true, mimeType: true, size: true },
    });
    if (!asset) {
      return new NextResponse("Introuvable", { status: 404 });
    }

    const result = await readUploadFile(asset.storageKey);
    if (!result) {
      return new NextResponse("Introuvable", { status: 404 });
    }

    const body = result.buffer.buffer.slice(
      result.buffer.byteOffset,
      result.buffer.byteOffset + result.buffer.byteLength,
    ) as ArrayBuffer;
    const mimeType = asset.mimeType || "application/octet-stream";
    const disposition = isInlineSafeMime(mimeType) ? "inline" : "attachment";
    return new NextResponse(body, {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(asset.size ?? result.buffer.byteLength),
        "Content-Disposition": disposition,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=3600",
      },
    });
  });
}
