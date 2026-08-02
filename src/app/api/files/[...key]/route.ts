import { NextResponse } from "next/server";
import { readUploadFile } from "@/features/upload/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
): Promise<NextResponse> {
  const { key } = await params;
  const storageKey = key.join("/");
  const result = await readUploadFile(storageKey);
  if (!result) {
    return new NextResponse("Introuvable", { status: 404 });
  }
  const body = result.buffer.buffer.slice(
    result.buffer.byteOffset,
    result.buffer.byteOffset + result.buffer.byteLength,
  ) as ArrayBuffer;
  return new NextResponse(body, {
    headers: {
      "Content-Type": result.mimeType,
      "Content-Disposition": "inline",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
