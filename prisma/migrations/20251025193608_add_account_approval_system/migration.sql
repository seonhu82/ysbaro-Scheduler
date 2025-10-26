-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'DELETED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'USER_REGISTERED';
ALTER TYPE "ActivityType" ADD VALUE 'USER_APPROVED';
ALTER TYPE "ActivityType" ADD VALUE 'USER_REJECTED';
ALTER TYPE "ActivityType" ADD VALUE 'USER_SUSPENDED';
ALTER TYPE "ActivityType" ADD VALUE 'USER_RESTORED';
ALTER TYPE "ActivityType" ADD VALUE 'USER_ROLE_CHANGED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'USER_REGISTRATION';
ALTER TYPE "NotificationType" ADD VALUE 'USER_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'USER_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'USER_SUSPENDED';

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountStatus" "AccountStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "rejectedReason" TEXT,
ADD COLUMN     "suspendedReason" TEXT,
ADD COLUMN     "suspendedUntil" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_accountStatus_idx" ON "User"("accountStatus");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
