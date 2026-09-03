import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  registerTrialCompany,
} from "@/features/registration/service";
import {
  createSession,
} from "@/features/auth/session";
import { checkRateLimit, clientIp } from "@/features/auth/rate-limit";
import { COMPANY_COOKIE } from "@/lib/constants";

const registerSchema = z.object({
  fullName: z.string().trim().min(1, "Nom complet requis").max(160),
  username: z
    .string()
    .trim()
    .min(3, "Identifiant (3 caractères minimum)")
    .max(60)
    .regex(/^\S+$/, "L'identifiant ne doit pas contenir d'espaces."),
  email: z.string().trim().email("Email invalide").max(160).optional().nullable(),
  password: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
    .max(256),
  companyName: z.string().trim().min(1, "Nom de société requis").max(160),
  phone: z.string().trim().max(40).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
});

const REGISTER_PER_WINDOW = 5;
const REGISTER_WINDOW_MS = 60 * 60 * 1000; // 5 inscriptions / IP / heure

/**
 * Inscription publique à une période d'essai.
 * Crée atomiquement société + propriétaire puis connecte l'utilisateur :
 * il atterrit directement dans le tableau de bord (mot de passe à changer).
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: "Requête invalide ou champs manquants.",
            code: "INVALID_BODY",
          },
        },
        { status: 400 },
      );
    }

    // Anti-abus : limite d'inscriptions par IP.
    const ip = clientIp(request);
    if (!checkRateLimit(`register:ip:${ip}`, REGISTER_PER_WINDOW, REGISTER_WINDOW_MS)) {
      return NextResponse.json(
        {
          error: {
            message: "Trop d'inscriptions depuis cette adresse. Réessayez plus tard.",
            code: "TOO_MANY_ATTEMPTS",
          },
        },
        { status: 429 },
      );
    }

    const data = parsed.data;
    const meta = {
      ip,
      userAgent: request.headers.get("user-agent"),
    };

    const result = await registerTrialCompany({
      fullName: data.fullName,
      username: data.username,
      email: data.email,
      password: data.password,
      companyName: data.companyName,
      phone: data.phone,
      city: data.city,
    });

    // Connecte directement l'utilisateur dans sa nouvelle société.
    await createSession(
      result.userId,
      meta,
      {
        activeCompanyId: result.companyId,
        activeBranchId: null,
      },
    );

    const cookieStore = await cookies();
    const cookieOptions = {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax" as const,
      httpOnly: true,
      secure:
        process.env.COOKIE_SECURE === "false"
          ? false
          : process.env.NODE_ENV === "production",
    };
    cookieStore.set(COMPANY_COOKIE, result.companyId, cookieOptions);

    return NextResponse.json(
      {
        data: {
          mustChangePassword: false,
          companyName: result.companyName,
          trialEndsAt: result.expiresAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const status =
      typeof (error as { status?: number }).status === "number"
        ? (error as { status: number }).status
        : 500;
    const message =
      (error as { message?: string }).message ??
      "Erreur interne lors de l'inscription.";
    const code =
      (error as { code?: string }).code ?? "INTERNAL_ERROR";
    console.error("register error:", error);
    return NextResponse.json({ error: { message, code } }, { status });
  }
}
