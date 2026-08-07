import { NextResponse } from "next/server";
import { handlePdfRequest } from "../pdf/handle";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Aperçu : Content-Disposition=inline pour l'affichage dans l'iframe.
 * Utilisé aussi pour l'impression navigateur (window.print sur le même PDF).
 */
export async function GET(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  return handlePdfRequest(request, context, "inline");
}
