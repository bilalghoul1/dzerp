import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env["DATABASE_URL"] ?? "";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const user = await prisma.user.findUnique({
    where: { username: "admin" },
    select: {
      id: true,
      username: true,
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
      },    },
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
