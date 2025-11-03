-- Add deployed date range fields to Schedule table
ALTER TABLE "Schedule" ADD COLUMN "deployedStartDate" DATE;
ALTER TABLE "Schedule" ADD COLUMN "deployedEndDate" DATE;

-- Add index for deployed date range queries
CREATE INDEX "Schedule_deployedStartDate_deployedEndDate_idx" ON "Schedule"("deployedStartDate", "deployedEndDate");
