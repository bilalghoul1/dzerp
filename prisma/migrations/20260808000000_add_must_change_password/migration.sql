-- AlterTable: forced password change on first login (Super Admin / Owner bootstrap).
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;