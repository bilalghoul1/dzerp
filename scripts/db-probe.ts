import "dotenv/config";
import { prismaBase } from "../src/lib/prisma";

async function main() {
  const r = await prismaBase.$queryRawUnsafe("SELECT 1 AS ok");
  console.log("DB OK:", JSON.stringify(r));
}

main()
  .catch((e) => {
    console.error("DB FAIL:", e.message ?? e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prismaBase.$disconnect();
  });