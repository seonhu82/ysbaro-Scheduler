-- Add PIN and security question fields to Staff table
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "pinCode" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "securityQuestion" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "securityAnswer" TEXT;

-- Create index on pinCode
CREATE INDEX IF NOT EXISTS "Staff_pinCode_idx" ON "Staff"("pinCode");

-- Drop old pin index if exists
DROP INDEX IF EXISTS "Staff_pin_idx";

-- Remove old pin column if exists (migrate data first if needed)
-- Note: This will be handled manually if there's existing data
-- ALTER TABLE "Staff" DROP COLUMN IF EXISTS "pin";
