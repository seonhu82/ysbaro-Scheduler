-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "WorkType" AS ENUM ('WEEK_4', 'WEEK_5');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "setupCompleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "useCategory" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Staff"
  ADD COLUMN IF NOT EXISTS "birthDateStr" TEXT,
  ADD COLUMN IF NOT EXISTS "departmentName" TEXT,
  ADD COLUMN IF NOT EXISTS "categoryName" TEXT,
  ADD COLUMN IF NOT EXISTS "workType" "WorkType",
  ALTER COLUMN "rank" DROP NOT NULL,
  ALTER COLUMN "hireDate" DROP NOT NULL,
  ALTER COLUMN "pin" DROP NOT NULL;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Department" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StaffCategory" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DoctorCategory" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DoctorCombination" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "requiredStaff" INTEGER NOT NULL,
    "doctors" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorCombination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ClosedDaySettings" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "includeHolidays" BOOLEAN NOT NULL DEFAULT true,
    "years" INTEGER[],
    "regularDays" JSONB NOT NULL,
    "specificDates" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClosedDaySettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Department_clinicId_idx" ON "Department"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Department_clinicId_name_key" ON "Department"("clinicId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StaffCategory_clinicId_idx" ON "StaffCategory"("clinicId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StaffCategory_priority_idx" ON "StaffCategory"("priority");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StaffCategory_clinicId_name_key" ON "StaffCategory"("clinicId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DoctorCategory_clinicId_idx" ON "DoctorCategory"("clinicId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DoctorCategory_doctorId_idx" ON "DoctorCategory"("doctorId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DoctorCategory_doctorId_name_key" ON "DoctorCategory"("doctorId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DoctorCombination_clinicId_idx" ON "DoctorCombination"("clinicId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DoctorCombination_dayOfWeek_idx" ON "DoctorCombination"("dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ClosedDaySettings_clinicId_key" ON "ClosedDaySettings"("clinicId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Department" ADD CONSTRAINT "Department_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "StaffCategory" ADD CONSTRAINT "StaffCategory_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "DoctorCategory" ADD CONSTRAINT "DoctorCategory_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "DoctorCategory" ADD CONSTRAINT "DoctorCategory_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "DoctorCombination" ADD CONSTRAINT "DoctorCombination_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ClosedDaySettings" ADD CONSTRAINT "ClosedDaySettings_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
