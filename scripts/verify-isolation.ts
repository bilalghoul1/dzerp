/**
 * Multi-Tenant Isolation Regression Tests — DzERP
 *
 * Vérifie le maintien de l'isolation des données entre sociétés en utilisant
 * le VRAI moteur d'isolation du projet (companyScopeExtension), sans mock.
 *
 * Approche (calqué sur scripts/verify-company-scope.ts) :
 *  - contexte société injecté via setFallbackContextResolver (contourne la
 *    résolution par cookies et force le scope réel) ;
 *  - lecture seule de la base existante si deux sociétés sont présentes ;
 *  - SINON, création de fixtures TEMPORAIRES (société B + client + branche)
 *    strictement supprimées dans un `finally` (aucune modification persistante
 *    de la base de production).
 *
 * Tests :
 *  T1 Company Isolation   — le contexte A ne renvoie que les lignes de A.
 *  T2 Direct ID Access    — findUnique(id client B) depuis A → null.
 *  T3 Branch Isolation    — findUnique(id branche B) depuis A → null.
 *  T4 Server-side (fermé) — hors contexte, modèle strict interdit (fail-closed).
 *
 * Exécuter :  npx tsx scripts/verify-isolation.ts   (ou npm run verify:isolation)
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { setFallbackContextResolver } from "../src/features/company/context";
import type { CompanyContext } from "../src/features/company/types";

type Result = { label: string; value: string; ok: boolean };

async function safe(label: string, fn: () => Promise<unknown>): Promise<Result> {
  try {
    const result = await fn();
    return { label, value: String(result), ok: true };
  } catch (e) {
    return { label, value: `THROW: ${(e as Error).message.slice(0, 90)}`, ok: false };
  }
}

async function safeThrow(
  label: string,
  fn: () => Promise<unknown>,
  expected: string,
): Promise<Result> {
  try {
    await fn();
    return { label, value: "no error thrown (attendu: échec fail-closed)", ok: false };
  } catch (e) {
    const message = (e as Error).message;
    return message.includes(expected)
      ? { label, value: message.slice(0, 90), ok: true }
      : { label, value: `THROW (message inattendu): ${message.slice(0, 90)}`, ok: false };
  }
}

function makeContext(company: {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
  currency: string | null;
}): CompanyContext {
  return {
    company: {
      id: company.id,
      code: company.code,
      name: company.name,
      isDefault: company.isDefault,
      currency: company.currency,
    },
  } as unknown as CompanyContext;
}

const TEMP_MARK = "__isolation_verify__";

async function main() {
  const results: Result[] = [];
  let tempCompanyId: string | null = null;
  let tempCustomerId: string | null = null;
  let tempBranchId: string | null = null;

  try {
    // Sociétés existantes (réelles) si au moins deux sont présentes.
    const existing = await prisma.company.findMany({
      orderBy: { createdAt: "asc" },
      take: 2,
    });

    let companyA: { id: string; code: string; name: string; isDefault: boolean; currency: string | null };
    let companyB: { id: string; code: string; name: string; isDefault: boolean; currency: string | null };

    if (existing.length >= 2) {
      companyA = existing[0];
      companyB = existing[1];
    } else {
      // Aucune seconde société : fixture temporaire strictement nettoyée.
      console.warn(
        "⚠️  Une seule société en base : création de fixtures temporaires " +
          "(supprimées en fin de script, aucune modification persistante).",
      );
      const real = existing[0];
      companyA = real ?? {
        id: "isolation-A", code: "ISO-A", name: "Iso A", isDefault: false, currency: "DZD",
      };
      const created = await prisma.company.create({
        data: {
          code: `${TEMP_MARK}${Date.now()}`,
          name: TEMP_MARK,
          currency: "DZD",
        },
      });
      tempCompanyId = created.id;
      companyB = created;
    }

    const ctxA = makeContext(companyA);
    const ctxB = makeContext(companyB);

    // Données de B (réelles ou fixtures) pour tester l'accès direct par ID.
    setFallbackContextResolver(async () => ctxB);
    const customerB = await prisma.customer.findFirst({ where: { companyId: companyB.id } });
    const branchB = await prisma.branch.findFirst({ where: { companyId: companyB.id } });

    // Si B n'a pas de client/branche (fixture ou société vide), on en crée un
    // minimum DANS le contexte B (le scope renseigne companyId = B).
    if (!customerB || !branchB) {
      if (!customerB) {
        const c = await prisma.customer.create({
          data: { companyId: companyB.id, name: TEMP_MARK, code: `${TEMP_MARK}${Date.now()}` },
        });
        tempCustomerId = c.id;
      }
      if (!branchB) {
        const b = await prisma.branch.create({
          data: { companyId: companyB.id, code: `${TEMP_MARK}${Date.now()}`, name: TEMP_MARK },
        });
        tempBranchId = b.id;
      }
      setFallbackContextResolver(async () => ctxB);
    }
    const finalCustomerB =
      customerB ?? (tempCustomerId ? { id: tempCustomerId } : null);
    const finalBranchB =
      branchB ?? (tempBranchId ? { id: tempBranchId } : null);

    // ── T1 — Company Isolation ──────────────────────────────────────────────
    setFallbackContextResolver(async () => ctxA);
    results.push(
      await safe("T1. isolation: tous les clients du contexte A appartiennent à A", async () => {
        const rows = await prisma.customer.findMany();
        const leaked = rows.filter((r) => r.companyId !== companyA.id);
        if (leaked.length > 0) {
          throw new Error(`${leaked.length} client(s) d'une autre société exposé(s)`);
        }
        return `ok (${rows.length} client(s) de A, 0 fuite)`;
      }),
    );

    // ── T2 — Direct ID Access ───────────────────────────────────────────────
    if (finalCustomerB) {
      results.push(
        await safe("T2. accès direct par ID (client B) depuis contexte A → null", async () => {
          const found = await prisma.customer.findUnique({ where: { id: finalCustomerB.id } });
          if (found) throw new Error("client d'une autre société accessible par ID !");
          return "null (accès refusé)";
        }),
      );
    } else {
      results.push({ label: "T2. accès direct par ID (client B)", value: "ignoré (aucun client B)", ok: true });
    }

    // ── T3 — Branch Isolation ────────────────────────────────────────────────
    if (finalBranchB) {
      results.push(
        await safe("T3. branche B invisible depuis contexte A → null", async () => {
          const found = await prisma.branch.findUnique({ where: { id: finalBranchB.id } });
          if (found) throw new Error("branche d'une autre société accessible !");
          return "null (branche isolée)";
        }),
      );
    } else {
      results.push({ label: "T3. branche B invisible depuis contexte A", value: "ignoré (aucune branche B)", ok: true });
    }

    // ── T4 — Server-side enforcement (fail-closed) ──────────────────────────
    setFallbackContextResolver(null);
    results.push(
      await safeThrow(
        "T4. hors contexte: lecture modèle strict interdite (fail-closed)",
        () => prisma.customer.findMany(),
        "companyScope: accès au modèle métier",
      ),
    );
  } finally {
    // Nettoyage strict des fixtures temporaires (aucune trace en base).
    setFallbackContextResolver(null);
    if (tempCustomerId) {
      await prisma.customer.deleteMany({ where: { id: tempCustomerId } }).catch(() => {});
    }
    if (tempBranchId) {
      await prisma.branch.deleteMany({ where: { id: tempBranchId } }).catch(() => {});
    }
    if (tempCompanyId) {
      // Supprime d'abord d'éventuels enfants résiduels, puis la société.
      await prisma.customer.deleteMany({ where: { companyId: tempCompanyId } }).catch(() => {});
      await prisma.branch.deleteMany({ where: { companyId: tempCompanyId } }).catch(() => {});
      await prisma.company.delete({ where: { id: tempCompanyId } }).catch(() => {});
    }
  }

  let passed = 0;
  for (const r of results) {
    console.log(`  ${r.ok ? "✓" : "✗"} ${r.label}: ${r.value}`);
    if (r.ok) passed++;
  }
  console.log(`\nRésultat: ${passed}/${results.length} tests OK`);

  if (passed !== results.length) process.exit(1);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
