-- AlterTable
ALTER TABLE "StaffAssignment" ADD COLUMN "leaveApplicationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "StaffAssignment_leaveApplicationId_key" ON "StaffAssignment"("leaveApplicationId");

-- AddForeignKey
ALTER TABLE "StaffAssignment" ADD CONSTRAINT "StaffAssignment_leaveApplicationId_fkey" FOREIGN KEY ("leaveApplicationId") REFERENCES "LeaveApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
