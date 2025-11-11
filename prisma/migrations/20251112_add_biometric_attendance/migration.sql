-- CreateEnum
CREATE TYPE "AttendanceMethod" AS ENUM ('BIOMETRIC', 'PIN', 'QR', 'MANUAL');

-- AlterTable Staff - Add biometric fields
ALTER TABLE "Staff" ADD COLUMN "biometricEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Staff" ADD COLUMN "biometricPublicKey" TEXT;
ALTER TABLE "Staff" ADD COLUMN "biometricCredentialId" TEXT;
ALTER TABLE "Staff" ADD COLUMN "biometricCounter" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Staff" ADD COLUMN "biometricRegisteredAt" TIMESTAMP(3);
ALTER TABLE "Staff" ADD COLUMN "biometricDeviceType" TEXT;

-- AlterTable AttendanceRecord - Add checkMethod field
ALTER TABLE "AttendanceRecord" ADD COLUMN "checkMethod" "AttendanceMethod";

-- CreateIndex
CREATE INDEX "Staff_biometricEnabled_idx" ON "Staff"("biometricEnabled");
