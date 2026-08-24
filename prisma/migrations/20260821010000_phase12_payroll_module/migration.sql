-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "housingBonus" DECIMAL(18,4),
ADD COLUMN     "otherBonus" DECIMAL(18,4),
ADD COLUMN     "seniorityBonus" DECIMAL(18,4),
ADD COLUMN     "transportBonus" DECIMAL(18,4);

-- AlterTable
ALTER TABLE "EmploymentContract" ADD COLUMN     "housingBonus" DECIMAL(18,4),
ADD COLUMN     "otherBonus" DECIMAL(18,4),
ADD COLUMN     "seniorityBonus" DECIMAL(18,4),
ADD COLUMN     "transportBonus" DECIMAL(18,4);

