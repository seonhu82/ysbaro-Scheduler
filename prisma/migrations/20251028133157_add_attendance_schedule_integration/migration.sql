-- AlterTable: Add attendance check times to StaffAssignment
ALTER TABLE "StaffAssignment" ADD COLUMN "actualCheckInTime" TIMESTAMP(3),
ADD COLUMN "actualCheckOutTime" TIMESTAMP(3);

-- AlterTable: Add schedule integration fields to AttendanceRecord
ALTER TABLE "AttendanceRecord" ADD COLUMN "staffAssignmentId" TEXT,
ADD COLUMN "isScheduled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "scheduleNote" TEXT;

-- CreateIndex
CREATE INDEX "AttendanceRecord_staffAssignmentId_idx" ON "AttendanceRecord"("staffAssignmentId");

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_staffAssignmentId_fkey" FOREIGN KEY ("staffAssignmentId") REFERENCES "StaffAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
