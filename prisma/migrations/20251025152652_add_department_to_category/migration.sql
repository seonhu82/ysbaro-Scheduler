-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "useAutoAssignment" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "StaffCategory" ADD COLUMN     "departmentId" TEXT;

-- CreateIndex
CREATE INDEX "StaffCategory_departmentId_idx" ON "StaffCategory"("departmentId");

-- AddForeignKey
ALTER TABLE "StaffCategory" ADD CONSTRAINT "StaffCategory_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
