import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Inspecteur générique d'un utilisateur : `npx tsx scripts/inspect-user.ts <username>`.
// Plus AUCUNE valeur par défaut (« admin » a été supprimé de la plateforme).

const connectionString = process.env["DATABASE_URL"] ?? "";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const username = process.argv[2];
  if (!username) {
    console.error("Usage : npx tsx scripts/inspect-user.ts <username>");
    process.exitCode = 1;
    return;
  }
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      status: true,
      roles: { select: { role: { select: { key: true } } } },
      userCompanies: {
        select: {
          company: { select: { code: true } },
          active: true,
          isDefault: true,
          roleAssignments: {
            select: {
              active: true,
              role: { select: { key: true, name: true } },
            },
          },
        },
      },
    },
  });
  console.log(JSON.stringify(user, null, 2));
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("DONE");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
