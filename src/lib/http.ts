import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function errorResponse(error: unknown): NextResponse {
  if (isApiError(error)) {
    return NextResponse.json(
      {
        error: {
          message: error.message,
          code: error.code ?? "API_ERROR",
          details: error.details,
        },
      },
      { status: error.status },
    );
  }

  const message =
    error instanceof Error ? error.message : "Unexpected internal error.";

  return NextResponse.json(
    { error: { message, code: "INTERNAL_ERROR" } },
    { status: 500 },
  );
}

export function okResponse<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, init);
}

export function json<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}
