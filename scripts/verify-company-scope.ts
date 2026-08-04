import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import {
  runWithCompanyContext,
  runUnscoped,
  setFallbackContextResolver,
} from "../src/features/company/context";
import type { CompanyContext } from "../src/features/company/types";

type Result = { label: string; value: string; ok: boolean };

async function safe(label: string, fn: () => Promise<unknown>): Promise<Result> {
  try {
    const result = await fn();
    return { label, value: String(result), ok: true };
  } catch (e) {
    return { label, value: `THROW: ${(e as Error).message.slice(0, 80)}`, ok: false };
  }
}

async function safeThrow(label: string, fn: () => Promise<unknown>, expected: string): Promise<Result> {
  try {
    await fn();
    return { label, value: "no error thrown (attendu: échec fail-closed)", ok: false };
  } catch (e) {
    const message = (e as Error).message;
    return message.includes(expected)
      ? { label, value: message.slice(0, 80), ok: true }
      : { label, value: `THROW (message inattendu): ${message.slice(0, 80)}`, ok: false };
  }
}

async function main() {
  const company = await prisma.company.findFirst({ where: { code: "MAIN" } });
  if (!company) throw new Error("Société MAIN introuvable");

  const context = {
    company: {
      id: company.id,
      code: company.code,
      name: company.name,
      isDefault: company.isDefault,
      currency: company.currency,
    },
  } as unknown as CompanyContext;

  const results: { label: string; value: string; ok: boolean }[] = [];

  results.push(await safe("1. in-context count", () =>
    runWithCompanyContext(context, async () => {
      return await prisma.branch.count();
    }),
  ));

  results.push(await safeThrow(
    "2. out-of-context count (fail-closed)",
    () => prisma.branch.count(),
    "companyScope: accès au modèle métier",
  ));

  results.push(await safe("3. explicit companyId", () =>
    prisma.branch.findMany({ where: { companyId: company.id } }).then((r) => r.length),
  ));

  results.push(await safe("4. optional auditLog count", () => prisma.auditLog.count()));

  results.push(await safe("5. runUnscoped count", () =>
    runUnscoped(async () => {
      return await prisma.branch.count();
    }),
  ));

  results.push(await safe("6. scoped write injection", () =>
    runWithCompanyContext(context, async () => {
      const a = await prisma.auditLog.create({ data: { action: "VIEW", entity: "company-scope-verify" } });
      return a.companyId;
    }),
  ));

  results.push(await safe("7. explicit companyId write", () =>
    prisma.auditLog.create({ data: { action: "VIEW", entity: "company-scope-verify", companyId: company.id } }).then((a) => a.companyId),
  ));

  results.push(await safe("8. fallback resolver (RSC pages)", () => {
    setFallbackContextResolver(async () => context);
    return prisma.branch.count();
  }));

  setFallbackContextResolver(null);

  await safe("cleanup", () =>
    prisma.auditLog.deleteMany({ where: { entity: "company-scope-verify" } }),
  );

  for (const r of results) {
    console.log(`  ${r.ok ? "✓" : "✗"} ${r.label}: ${r.value}`);
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
