/*
  Warnings:

  - You are about to drop the `SlotLimit` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `birthDate` to the `Staff` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hireDate` to the `Staff` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CheckType" AS ENUM ('IN', 'OUT');

-- AlterEnum
ALTER TYPE "DayType" ADD VALUE 'SUNDAY';

-- DropForeignKey
ALTER TABLE "SlotLimit" DROP CONSTRAINT "SlotLimit_linkId_fkey";

-- AlterTable
ALTER TABLE "RuleSettings" ADD COLUMN     "defaultWorkDays" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "staffCategories" TEXT[] DEFAULT ARRAY['실팀장', '고년차', '중년차', '저년차']::TEXT[],
ADD COLUMN     "weekBusinessDays" INTEGER NOT NULL DEFAULT 6;

-- AlterTable
-- Step 1: Add nullable columns first
ALTER TABLE "Staff" ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "categories" TEXT[],
ADD COLUMN     "hireDate" TIMESTAMP(3),
ADD COLUMN     "registeredDevices" JSONB,
ADD COLUMN     "totalAnnualDays" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "usedAnnualDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "workDays" INTEGER NOT NULL DEFAULT 4;

-- Step 2: Update existing records with default values
-- Use current date as default for birthDate and hireDate
UPDATE "Staff" SET "birthDate" = '1990-01-01'::timestamp WHERE "birthDate" IS NULL;
UPDATE "Staff" SET "hireDate" = '2020-01-01'::timestamp WHERE "hireDate" IS NULL;

-- Step 3: Make columns NOT NULL
ALTER TABLE "Staff" ALTER COLUMN "birthDate" SET NOT NULL;
ALTER TABLE "Staff" ALTER COLUMN "hireDate" SET NOT NULL;

-- DropTable
DROP TABLE "SlotLimit";

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeekInfo" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "weekStart" DATE NOT NULL,
    "weekEnd" DATE NOT NULL,
    "totalSlots" INTEGER NOT NULL,
    "offTarget" INTEGER NOT NULL,
    "annualAvailable" INTEGER NOT NULL,
    "hasHoliday" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeekInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailySlot" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dayType" "DayType" NOT NULL,
    "doctorSchedule" JSONB NOT NULL,
    "requiredStaff" INTEGER NOT NULL,
    "availableSlots" INTEGER NOT NULL,
    "offAssigned" INTEGER NOT NULL DEFAULT 0,
    "annualAssigned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailySlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QRToken" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "usedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QRToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "checkType" "CheckType" NOT NULL,
    "checkTime" TIMESTAMP(3) NOT NULL,
    "date" DATE NOT NULL,
    "tokenUsed" TEXT,
    "deviceFingerprint" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "wifiSSID" TEXT,
    "gpsLatitude" DOUBLE PRECISION,
    "gpsLongitude" DOUBLE PRECISION,
    "photoPath" TEXT,
    "isSuspicious" BOOLEAN NOT NULL DEFAULT false,
    "suspiciousReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "WeekInfo_clinicId_idx" ON "WeekInfo"("clinicId");

-- CreateIndex
CREATE INDEX "WeekInfo_year_month_idx" ON "WeekInfo"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "WeekInfo_clinicId_year_month_weekNumber_key" ON "WeekInfo"("clinicId", "year", "month", "weekNumber");

-- CreateIndex
CREATE INDEX "DailySlot_weekId_idx" ON "DailySlot"("weekId");

-- CreateIndex
CREATE INDEX "DailySlot_date_idx" ON "DailySlot"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailySlot_weekId_date_key" ON "DailySlot"("weekId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "QRToken_token_key" ON "QRToken"("token");

-- CreateIndex
CREATE INDEX "QRToken_clinicId_idx" ON "QRToken"("clinicId");

-- CreateIndex
CREATE INDEX "QRToken_token_idx" ON "QRToken"("token");

-- CreateIndex
CREATE INDEX "QRToken_expiresAt_idx" ON "QRToken"("expiresAt");

-- CreateIndex
CREATE INDEX "QRToken_used_idx" ON "QRToken"("used");

-- CreateIndex
CREATE INDEX "AttendanceRecord_clinicId_idx" ON "AttendanceRecord"("clinicId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_staffId_idx" ON "AttendanceRecord"("staffId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_date_idx" ON "AttendanceRecord"("date");

-- CreateIndex
CREATE INDEX "AttendanceRecord_checkType_idx" ON "AttendanceRecord"("checkType");

-- CreateIndex
CREATE INDEX "AttendanceRecord_isSuspicious_idx" ON "AttendanceRecord"("isSuspicious");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekInfo" ADD CONSTRAINT "WeekInfo_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySlot" ADD CONSTRAINT "DailySlot_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "WeekInfo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QRToken" ADD CONSTRAINT "QRToken_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
