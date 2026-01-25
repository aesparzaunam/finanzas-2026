-- AlterTable
ALTER TABLE "Budget" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "MSIPlan" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "deletedAt" DATETIME;
