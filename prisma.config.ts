// Prisma config — used by the Prisma CLI (migrate, generate, studio...).
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Direct connection for DDL; falls back to the pooled URL.
    url: process.env["DATABASE_URL_DIRECT"] ?? process.env["DATABASE_URL"],
  },
});
