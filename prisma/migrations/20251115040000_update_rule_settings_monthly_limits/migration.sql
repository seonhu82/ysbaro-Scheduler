-- AlterTable: Remove old night shift related columns and add monthly application limits
ALTER TABLE "RuleSettings" DROP COLUMN IF EXISTS "maxConsecutiveNights";
ALTER TABLE "RuleSettings" DROP COLUMN IF EXISTS "minRestAfterNight";
ALTER TABLE "RuleSettings" ADD COLUMN "maxMonthlyOffApplications" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "RuleSettings" ADD COLUMN "maxMonthlyAnnualApplications" INTEGER NOT NULL DEFAULT 4;
