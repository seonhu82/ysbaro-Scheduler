/*
  Warnings:

  - You are about to drop the column `categories` on the `Staff` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ApplicationLink" ADD COLUMN     "staffId" TEXT;

-- AlterTable
ALTER TABLE "Staff" DROP COLUMN "categories",
ALTER COLUMN "flexibleForCategories" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WeekInfo" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "DailyStaffAssignment" (
    "id" TEXT NOT NULL,
    "dailySlotId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyStaffAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnresolvedIssue" (
    "id" TEXT NOT NULL,
    "weekInfoId" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "staffId" TEXT,
    "category" TEXT,
    "date" DATE,
    "message" TEXT NOT NULL,
    "suggestion" TEXT,
    "status" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnresolvedIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FairnessAdjustment" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "adjustmentType" TEXT NOT NULL,
    "adjustmentDays" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FairnessAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyStaffAssignment_dailySlotId_idx" ON "DailyStaffAssignment"("dailySlotId");

-- CreateIndex
CREATE INDEX "DailyStaffAssignment_staffId_idx" ON "DailyStaffAssignment"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStaffAssignment_dailySlotId_staffId_key" ON "DailyStaffAssignment"("dailySlotId", "staffId");

-- CreateIndex
CREATE INDEX "UnresolvedIssue_weekInfoId_idx" ON "UnresolvedIssue"("weekInfoId");

-- CreateIndex
CREATE INDEX "UnresolvedIssue_staffId_idx" ON "UnresolvedIssue"("staffId");

-- CreateIndex
CREATE INDEX "UnresolvedIssue_status_idx" ON "UnresolvedIssue"("status");

-- CreateIndex
CREATE INDEX "FairnessAdjustment_staffId_idx" ON "FairnessAdjustment"("staffId");

-- CreateIndex
CREATE INDEX "FairnessAdjustment_year_month_idx" ON "FairnessAdjustment"("year", "month");

-- CreateIndex
CREATE INDEX "FairnessAdjustment_status_idx" ON "FairnessAdjustment"("status");

-- CreateIndex
CREATE INDEX "ApplicationLink_staffId_idx" ON "ApplicationLink"("staffId");

-- AddForeignKey
ALTER TABLE "ApplicationLink" ADD CONSTRAINT "ApplicationLink_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyStaffAssignment" ADD CONSTRAINT "DailyStaffAssignment_dailySlotId_fkey" FOREIGN KEY ("dailySlotId") REFERENCES "DailySlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyStaffAssignment" ADD CONSTRAINT "DailyStaffAssignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnresolvedIssue" ADD CONSTRAINT "UnresolvedIssue_weekInfoId_fkey" FOREIGN KEY ("weekInfoId") REFERENCES "WeekInfo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnresolvedIssue" ADD CONSTRAINT "UnresolvedIssue_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FairnessAdjustment" ADD CONSTRAINT "FairnessAdjustment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
