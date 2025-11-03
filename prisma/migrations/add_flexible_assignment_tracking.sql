-- Add flexible assignment tracking fields to StaffAssignment
ALTER TABLE "StaffAssignment" ADD COLUMN "isFlexible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StaffAssignment" ADD COLUMN "originalCategory" TEXT;
ALTER TABLE "StaffAssignment" ADD COLUMN "assignedCategory" TEXT;
