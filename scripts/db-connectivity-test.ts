/**
 * Diagnostic de connectivité — reproduit la pile Prisma réelle de l'app
 * (adapter + extensions) pour isoler ETIMEDOUT hors de Next.js/Turbopack.
 *
 * Usage: npx tsx scripts/db-connectivity-test.ts
 */
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("=== 1) $queryRaw`SELECT 1` ===");
  const t0 = Date.now();
  try {
    const r = await prisma.$queryRaw`SELECT 1 AS ok`;
    console.log(`OK in ${Date.now() - t0}ms →`, JSON.stringify(r));
  } catch (e: unknown) {
    const err = e as { code?: string; name?: string; message?: string };
    console.log(`FAIL in ${Date.now() - t0}ms →`, err?.code || err?.name, "|", err?.message?.slice(0, 300));
  }

  console.log("\n=== 2) prisma.session.count() ===");
  const t1 = Date.now();
  try {
    const n = await prisma.session.count();
    console.log(`OK in ${Date.now() - t1}ms → count=${n}`);
  } catch (e: unknown) {
    const err = e as { code?: string; name?: string; message?: string };
    console.log(`FAIL in ${Date.now() - t1}ms →`, err?.code || err?.name, "|", err?.message?.slice(0, 300));
  }

  console.log("\n=== 3) prisma.session.findFirst() ===");
  const t2 = Date.now();
  try {
    const s = await prisma.session.findFirst({ select: { id: true, userId: true } });
    console.log(`OK in ${Date.now() - t2}ms →`, s ? JSON.stringify(s) : "(none)");
  } catch (e: unknown) {
    const err = e as { code?: string; name?: string; message?: string };
    console.log(`FAIL in ${Date.now() - t2}ms →`, err?.code || err?.name, "|", err?.message?.slice(0, 300));
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Unhandled:", e);
    process.exit(1);
  });
