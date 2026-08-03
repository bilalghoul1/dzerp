import { NextResponse } from "next/server";
import { apiGuard } from "@/features/auth/api-guard";
import { resolveCompanyContext } from "@/features/company/resolver";
import {
  runWithCompanyContext,
  runWithResolveCache,
} from "@/features/company/context";
import { ApiError, isApiError } from "@/lib/http";
import type { PermissionKey } from "@/features/auth/permissions";
import type { SessionContext } from "@/features/auth/types";
import type { CompanyContext } from "@/features/company/types";

export type ApiCompanyGuardResult =
  | { session: SessionContext; context: CompanyContext; response?: never }
  | { session?: never; context?: never; response: NextResponse };

/**
 * Garde d'API + résolution du contexte société. Les routes API ne s'exécutent
 * pas dans le contexte ALS posé par le layout : ce garde résout la société
 * active une fois par requête, puis `runScoped` exécute le handler dedans.
 */
export async function apiGuardWithContext(
  permission?: PermissionKey,
): Promise<ApiCompanyGuardResult> {
  const guard = await apiGuard(permission);
  if (guard.response) return { response: guard.response };

  try {
    const context = await runWithResolveCache(() =>
      resolveCompanyContext(guard.session),
    );
    return { session: guard.session, context };
  } catch (error) {
    if (isApiError(error)) {
      return { response: errorResponse(error) };
    }
    return {
      response: NextResponse.json(
        { error: { message: "Aucune société accessible.", code: "FORBIDDEN" } },
        { status: 403 },
      ),
    };
  }
}

function errorResponse(error: ApiError): NextResponse {
  return NextResponse.json(
    {
      error: { message: error.message, code: error.code ?? "API_ERROR" },
    },
    { status: error.status },
  );
}

/**
 * Exécute `fn` dans le contexte société résolu par `apiGuardWithContext`,
 * avec le cache de résolution (permissions) disponible pour la requête.
 */
export function runScoped<T>(context: CompanyContext, fn: () => T): T {
  return runWithResolveCache(() => runWithCompanyContext(context, fn));
}
