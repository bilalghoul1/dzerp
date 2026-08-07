/**
 * Loop le vrai stack prisma (src/lib/prisma.ts) N fois en processus froid
 * pour caractériser l'intermittence du ETIMEDOUT.
 * Usage: npx tsx --env-file=.env scripts/flakiness-test.ts [count]
 */
import { prisma } from "@/lib/prisma";

const N = Number(process.argv[2] ?? 10);

async function run(i: number): Promise<string> {
  const t = Date.now();
  try {
    await prisma.session.count();
    return `run ${String(i).padStart(2, " ")}: OK   ${Date.now() - t}ms`;
  } catch (e: unknown) {
    const err = e as { code?: string; name?: string };
    return `run ${String(i).padStart(2, " ")}: FAIL ${Date.now() - t}ms  ${err?.code ?? err?.name}`;
  }
}

async function main() {
  const results: string[] = [];
  for (let i = 1; i <= N; i++) {
    results.push(await run(i));
  }
  console.log(results.join("\n"));
  const ok = results.filter((r) => r.includes("OK")).length;
  console.log(`\n→ ${ok}/${N} OK`);
}

main().then(() => process.exit(0));
