-- Add QR_DISPLAY role to UserRole enum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'QR_DISPLAY';

-- Add rejectionReason field to LeaveApplication
ALTER TABLE "LeaveApplication" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

-- Add comment
COMMENT ON COLUMN "LeaveApplication"."rejectionReason" IS '거절 사유 (REJECTED 상태일 때)';
