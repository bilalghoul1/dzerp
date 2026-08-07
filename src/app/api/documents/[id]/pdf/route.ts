import { NextResponse } from "next/server";
import { handlePdfRequest } from "./handle";

type RouteContext = { params: Promise<{ id: string }> };

/** Téléchargement : Content-Disposition=attachment. */
export async function GET(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  return handlePdfRequest(request, context, "attachment");
}
